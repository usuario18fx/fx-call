"""Rooms, invitations, guest admission, LiveKit media tokens, privacy shield events, moderation, chat."""
import asyncio
import json
import logging
import os
import secrets
from datetime import datetime, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from livekit import api as lk
from pydantic import BaseModel, EmailStr, Field

from auth_routes import consume_challenge, issue_challenge
from core import (PUBLIC_APP_URL, audit, aware, clean, client_ip, current_user, db, decode_token, hub,
                  make_guest_token, new_id, now, ok, optional_user, rate_limit, sha256)

router = APIRouter(prefix="/api", tags=["rooms"])
log = logging.getLogger("fxcall.rooms")

# LiveKit credentials stay server-side only.
LK_URL = os.environ.get("LIVEKIT_URL", "")
LK_KEY = os.environ.get("LIVEKIT_API_KEY", "")
LK_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")
# Only camera + microphone may ever be published. Screen share sources are never granted.
ALLOWED_SOURCES = ["camera", "microphone"]

# Genuine OS capture signals accepted per platform. Browsers have none.
NATIVE_SOURCES = {
    "ios": {"ios.UIApplication.userDidTakeScreenshotNotification", "ios.UIScreen.capturedDidChangeNotification"},
    "android": {"android.Activity.ScreenCaptureCallback", "android.WindowManager.ScreenRecordingCallback"},
}
PENALTY_EVENTS = {"screenshot", "recording_started"}

PRIVACY_RULES = [
    "Screen sharing is disabled on every FX CALL platform.",
    "Screenshots and screen recordings reported by your device's operating system are shown to the host.",
    "The host may warn, restrict or remove participants after a device-reported capture event.",
    "External cameras and some apps cannot be detected. Respect the privacy of everyone in this room.",
    "Browsers cannot detect screenshots or screen recording.",
]


def lk_configured() -> bool:
    return bool(LK_URL and LK_KEY and LK_SECRET)


async def lk_call(fn) -> None:
    """Run a LiveKit RoomService call; moderation state in our DB stays authoritative even if this fails."""
    if not lk_configured():
        return
    client = lk.LiveKitAPI(url=LK_URL.replace("wss://", "https://").replace("ws://", "http://"), api_key=LK_KEY, api_secret=LK_SECRET)
    try:
        await fn(client)
    except Exception as e:
        log.warning("LiveKit call failed: %s", type(e).__name__)
    finally:
        await client.aclose()


async def lk_remove(room_id: str, pid: str) -> None:
    await lk_call(lambda c: c.room.remove_participant(lk.RoomParticipantIdentity(room=room_id, identity=pid)))


async def lk_set_subscribe(room_id: str, pid: str, can_subscribe: bool) -> None:
    perm = lk.ParticipantPermission(can_subscribe=can_subscribe, can_publish=True, can_publish_data=False,
                                    can_publish_sources=[lk.TrackSource.CAMERA, lk.TrackSource.MICROPHONE])
    await lk_call(lambda c: c.room.update_participant(lk.UpdateParticipantRequest(room=room_id, identity=pid, permission=perm)))


async def lk_mute_audio(room_id: str, pid: str) -> None:
    async def run(c):
        info = await c.room.get_participant(lk.RoomParticipantIdentity(room=room_id, identity=pid))
        for t in info.tracks:
            if t.type == lk.TrackType.AUDIO:
                await c.room.mute_published_track(lk.MuteRoomTrackRequest(room=room_id, identity=pid, track_sid=t.sid, muted=True))
    await lk_call(run)


# ---------------------------------------------------------------- models
class RoomSettings(BaseModel):
    notify_host: bool = True
    warn_participant: bool = True
    restrict_video_on_capture: bool = False
    auto_remove_on_capture: bool = False
    block_rejoin_after_removal: bool = True
    watermark: bool = True
    capture_protection: bool = False


class CaptureCaps(BaseModel):
    screenshot: bool = False
    recording: bool = False
    source: str = Field(default="none", max_length=80)


class DeviceIn(BaseModel):
    platform: Literal["ios", "android", "web"]
    os: str = Field(default="", max_length=60)
    model: str = Field(default="", max_length=80)
    capture: CaptureCaps = CaptureCaps()


class RoomIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    settings: RoomSettings = RoomSettings()


class LockIn(BaseModel):
    locked: bool


class RoomRenameIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)


class InviteIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    require_approval: bool = True
    max_uses: Optional[int] = Field(default=None, ge=1, le=1000)  # None = unlimited, 1 = one-time
    expires: Literal["1h", "1d", "1w", "never", "custom"] = "1d"
    custom_expires_at: Optional[datetime] = None


class GuestEmailIn(BaseModel):
    email: EmailStr


class GuestConfirmIn(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class JoinIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=40)
    accept_rules: bool
    guest_token: Optional[str] = Field(default=None, max_length=1024)
    device: DeviceIn


class StateIn(BaseModel):
    camera_on: Optional[bool] = None
    mic_on: Optional[bool] = None
    capture: Optional[CaptureCaps] = None


class EventIn(BaseModel):
    event_type: Literal["screenshot", "recording_started", "recording_stopped"]
    detection_source: str = Field(max_length=80)


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


# ---------------------------------------------------------------- helpers
async def host_room(room_id: str, user: dict) -> dict:
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room or room["host_id"] != user["id"]:
        raise HTTPException(404, "Room not found")
    return room


async def participant_auth(room_id: str, x_participant_key: str = Header(..., max_length=128)) -> dict:
    p = await db.participants.find_one({"room_id": room_id, "key_hash": sha256(x_participant_key)}, {"_id": 0})
    if not p:
        raise HTTPException(401, "Invalid participant credentials")
    return p


def pub_participant(p: dict) -> dict:
    return clean(p, drop=("email",)) | {"email_masked": mask(p.get("email"))}


def mask(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    name, _, dom = email.partition("@")
    return f"{name[:2]}***@{dom}"


def invite_state(inv: dict, room: dict) -> str:
    if room["status"] != "active":
        return "ended"
    if inv["revoked"]:
        return "revoked"
    if inv.get("expires_at") and aware(inv["expires_at"]) <= now():
        return "expired"
    if inv.get("max_uses") and inv["uses"] >= inv["max_uses"]:
        return "used_up"
    if room["locked"]:
        return "locked"
    return "valid"


def pub_invite(inv: dict, room: dict) -> dict:
    return clean(inv) | {"state": invite_state(inv, room)}


async def notify(room_id: str, kind: str, **data) -> None:
    await hub.send(room_id, {"type": kind, **data})


async def get_invite(token: str) -> tuple[dict, dict]:
    inv = await db.invites.find_one({"token_hash": sha256(token)}, {"_id": 0})
    room = inv and await db.rooms.find_one({"id": inv["room_id"]}, {"_id": 0})
    if not inv or not room:
        raise HTTPException(404, "Invitation not found")
    return inv, room


async def new_participant_key(pid: str) -> str:
    key = secrets.token_urlsafe(32)
    await db.participants.update_one({"id": pid}, {"$set": {"key_hash": sha256(key)}})
    return key


# ---------------------------------------------------------------- rooms (host)
@router.post("/rooms", status_code=201)
async def create_room(body: RoomIn, user=Depends(current_user)):
    await rate_limit(f"room-create:{user['id']}", 30, 3600)
    room = {"id": new_id(), "host_id": user["id"], "host_name": user["display_name"], "title": body.title.strip(),
            "status": "active", "locked": False, "settings": body.settings.model_dump(), "created_at": now(), "ended_at": None}
    await db.rooms.insert_one(dict(room))
    await audit(room["id"], user["id"], "room_created")
    return clean(room)


@router.get("/rooms")
async def list_rooms(user=Depends(current_user)):
    rooms = await db.rooms.find({"host_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    out = []
    for r in rooms:
        pending = await db.participants.count_documents({"room_id": r["id"], "status": "pending"})
        active = await db.participants.count_documents({"room_id": r["id"], "status": "approved", "in_call": True})
        alerts = await db.security_events.count_documents({"room_id": r["id"]})
        out.append(clean(r) | {"pending_count": pending, "active_count": active, "alert_count": alerts})
    return out


@router.patch("/rooms/{room_id}")
async def rename_room(room_id: str, body: RoomRenameIn, user=Depends(current_user)):
    # Ownership is checked before any mutation, including ended rooms.
    room = await host_room(room_id, user)
    title = body.title.strip()
    if not title:
        raise HTTPException(422, "Room name cannot be empty")
    if title != room["title"]:
        await db.rooms.update_one(
            {"id": room_id, "host_id": user["id"]},
            {"$set": {"title": title}},
        )
        await audit(room_id, user["id"], "room_renamed")
        await notify(room_id, "room_update")
    return {"id": room_id, "title": title}


@router.get("/rooms/{room_id}/dashboard")
async def dashboard(room_id: str, user=Depends(current_user)):
    room = await host_room(room_id, user)
    parts = await db.participants.find({"room_id": room_id, "status": {"$ne": "left"}}, {"_id": 0}).sort("created_at", 1).to_list(500)
    events = await db.security_events.find({"room_id": room_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    invites = await db.invites.find({"room_id": room_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    blocks = await db.blocks.find({"host_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    logs = await db.audit_logs.find({"room_id": room_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {
        "room": clean(room),
        "participants": [clean(p) for p in parts],
        "events": [clean(e) for e in events],
        "invites": [pub_invite(i, room) for i in invites],
        "blocks": [clean(b) for b in blocks],
        "audit": [clean(a) for a in logs],
        "video_configured": lk_configured(),
    }


@router.patch("/rooms/{room_id}/settings")
async def update_settings(room_id: str, body: RoomSettings, user=Depends(current_user)):
    await host_room(room_id, user)
    await db.rooms.update_one({"id": room_id}, {"$set": {"settings": body.model_dump()}})
    await audit(room_id, user["id"], "settings_updated", meta=body.model_dump())
    await notify(room_id, "room_update")
    return ok(settings=body.model_dump())


@router.post("/rooms/{room_id}/lock")
async def lock_room(room_id: str, body: LockIn, user=Depends(current_user)):
    await host_room(room_id, user)
    await db.rooms.update_one({"id": room_id}, {"$set": {"locked": body.locked}})
    await audit(room_id, user["id"], "room_locked" if body.locked else "room_unlocked")
    await notify(room_id, "room_update")
    return ok(locked=body.locked)


@router.post("/rooms/{room_id}/end")
async def end_room(room_id: str, user=Depends(current_user)):
    await host_room(room_id, user)
    await db.rooms.update_one({"id": room_id}, {"$set": {"status": "ended", "ended_at": now()}})
    await db.participants.update_many({"room_id": room_id, "status": {"$in": ["approved", "pending"]}}, {"$set": {"in_call": False, "status": "left"}})
    await lk_call(lambda c: c.room.delete_room(lk.DeleteRoomRequest(room=room_id)))
    await audit(room_id, user["id"], "room_ended")
    await notify(room_id, "room_ended")
    return ok()


@router.post("/rooms/{room_id}/host-key")
async def host_key(room_id: str, device: DeviceIn, user=Depends(current_user)):
    room = await host_room(room_id, user)
    if room["status"] != "active":
        raise HTTPException(410, "This meeting has ended")
    p = await db.participants.find_one({"room_id": room_id, "user_id": user["id"], "role": "host"})
    fields = {"platform": device.platform, "os": device.os, "model": device.model, "capture": device.capture.model_dump(),
              "display_name": user["display_name"], "status": "approved"}
    if p:
        await db.participants.update_one({"id": p["id"]}, {"$set": fields})
        pid = p["id"]
    else:
        pid = new_id()
        await db.participants.insert_one({"id": pid, "room_id": room_id, "user_id": user["id"], "email": user["email"], "role": "host",
                                          "verified_identity": "account", "camera_on": True, "mic_on": True, "in_call": False,
                                          "video_restricted": False, "warnings": 0, "created_at": now(), **fields})
    return {"participant_id": pid, "participant_key": await new_participant_key(pid)}


# ---------------------------------------------------------------- invitations
@router.post("/rooms/{room_id}/invites", status_code=201)
async def create_invite(room_id: str, body: InviteIn, user=Depends(current_user)):
    room = await host_room(room_id, user)
    if room["status"] != "active":
        raise HTTPException(410, "This meeting has ended")
    delta = {"1h": timedelta(hours=1), "1d": timedelta(days=1), "1w": timedelta(weeks=1)}.get(body.expires)
    expires_at = now() + delta if delta else None
    if body.expires == "custom":
        if not body.custom_expires_at or aware(body.custom_expires_at) <= now():
            raise HTTPException(422, "Custom expiration must be in the future")
        expires_at = aware(body.custom_expires_at)
    token = secrets.token_urlsafe(24)
    inv = {"id": new_id(), "room_id": room_id, "name": body.name.strip(), "token_hash": sha256(token), "token_hint": token[:4],
           "require_approval": body.require_approval, "max_uses": body.max_uses, "uses": 0, "expires_at": expires_at,
           "revoked": False, "created_at": now()}
    await db.invites.insert_one(dict(inv))
    await audit(room_id, user["id"], "invite_created", inv["id"])
    # The raw token is shown exactly once; only its hash is stored.
    return pub_invite(inv, room) | {"token": token, "url": f"{PUBLIC_APP_URL}/room/{token}"}


@router.post("/rooms/{room_id}/invites/{invite_id}/revoke")
async def revoke_invite(room_id: str, invite_id: str, user=Depends(current_user)):
    await host_room(room_id, user)
    res = await db.invites.update_one({"id": invite_id, "room_id": room_id}, {"$set": {"revoked": True}})
    if not res.matched_count:
        raise HTTPException(404, "Invitation not found")
    await audit(room_id, user["id"], "invite_revoked", invite_id)
    return ok()


@router.delete("/blocks/{block_id}")
async def unblock(block_id: str, user=Depends(current_user)):
    res = await db.blocks.delete_one({"id": block_id, "host_id": user["id"]})
    if not res.deleted_count:
        raise HTTPException(404, "Block not found")
    return ok()


@router.get("/invites/{token}")
async def invite_details(token: str, request: Request):
    await rate_limit(f"invite-view:{client_ip(request)}", 60, 600)
    inv, room = await get_invite(token)
    return {"room_title": room["title"], "host_name": room["host_name"], "invite_name": inv["name"],
            "require_approval": inv["require_approval"], "state": invite_state(inv, room),
            "expires_at": clean({"e": inv.get("expires_at")})["e"], "privacy_rules": PRIVACY_RULES,
            "watermark": room["settings"]["watermark"]}


@router.post("/invites/{token}/email-code", status_code=202)
async def guest_email_code(token: str, body: GuestEmailIn, request: Request):
    email = body.email.lower()
    await rate_limit(f"guest-code:{email}", 5, 3600)
    await rate_limit(f"guest-code-ip:{client_ip(request)}", 20, 3600)
    inv, room = await get_invite(token)
    if invite_state(inv, room) != "valid":
        raise HTTPException(410, "This invitation is no longer valid")
    await issue_challenge("guest", email)
    return {"message": "Verification code sent."}


@router.post("/invites/{token}/email-confirm")
async def guest_email_confirm(token: str, body: GuestConfirmIn):
    email = body.email.lower()
    await rate_limit(f"guest-confirm:{email}", 15, 900)
    inv, _ = await get_invite(token)
    await consume_challenge("guest", email, body.code)
    return {"guest_token": make_guest_token(email, inv["id"])}


@router.post("/invites/{token}/join")
async def join(token: str, body: JoinIn, request: Request, user=Depends(optional_user)):
    await rate_limit(f"join-ip:{client_ip(request)}", 30, 600)
    if not body.accept_rules:
        raise HTTPException(422, "You must accept the privacy rules")
    inv, room = await get_invite(token)
    state = invite_state(inv, room)
    if state != "valid":
        raise HTTPException(423 if state == "locked" else 410, {"locked": "This room is locked by the host", "ended": "This meeting has ended"}.get(state, "This invitation is no longer valid"))
    if user:
        email, verified, uid = user["email"], "account", user["id"]
        if room["host_id"] == uid:
            raise HTTPException(409, "You are the host of this meeting. Open it from your meetings list.")
    else:
        if not body.guest_token:
            raise HTTPException(401, "Email verification is required")
        g = decode_token(body.guest_token, "guest")
        if g.get("inv") != inv["id"]:
            raise HTTPException(401, "Email verification is required")
        email, verified, uid = g["sub"], "email_code", None
    if await db.blocks.find_one({"host_id": room["host_id"], "email": email}):
        raise HTTPException(403, "You cannot join this meeting")
    existing = await db.participants.find_one({"room_id": room["id"], "email": email, "role": "participant"})
    if existing and existing["status"] in ("removed", "blocked") and (existing["status"] == "blocked" or room["settings"]["block_rejoin_after_removal"]):
        raise HTTPException(403, "The host has restricted you from rejoining this meeting")
    status = "pending" if inv["require_approval"] else "approved"
    fields = {"display_name": body.display_name.strip(), "platform": body.device.platform, "os": body.device.os,
              "model": body.device.model, "capture": body.device.capture.model_dump(), "invite_id": inv["id"],
              "verified_identity": verified, "user_id": uid, "requested_at": now()}
    if existing and existing["status"] in ("pending", "approved"):
        pid = existing["id"]
        await db.participants.update_one({"id": pid}, {"$set": fields})
        status = existing["status"]
    else:
        cond = {"id": inv["id"], "revoked": False}
        if inv.get("max_uses"):
            cond["uses"] = {"$lt": inv["max_uses"]}
        if not await db.invites.find_one_and_update(cond, {"$inc": {"uses": 1}}):
            raise HTTPException(410, "This invitation has reached its use limit")
        if existing:
            pid = existing["id"]
            await db.participants.update_one({"id": pid}, {"$set": {**fields, "status": status, "in_call": False}})
        else:
            pid = new_id()
            await db.participants.insert_one({"id": pid, "room_id": room["id"], "email": email, "role": "participant", "status": status,
                                              "camera_on": True, "mic_on": True, "in_call": False, "video_restricted": False,
                                              "warnings": 0, "created_at": now(), **fields})
    key = await new_participant_key(pid)
    await audit(room["id"], pid, "join_requested", meta={"invite": inv["id"], "status": status})
    await hub.send(room["id"], {"type": "join_request", "name": fields["display_name"], "status": status}, host_only=True)
    return {"room_id": room["id"], "participant_id": pid, "participant_key": key, "status": status}


# ---------------------------------------------------------------- participant (X-Participant-Key)
@router.get("/rooms/{room_id}/me")
async def me(room_id: str, p=Depends(participant_auth)):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    return {"participant": pub_participant(p),
            "room": {"id": room["id"], "title": room["title"], "host_name": room["host_name"], "status": room["status"],
                     "locked": room["locked"], "settings": room["settings"]},
            "video_configured": lk_configured()}


@router.get("/rooms/{room_id}/roster")
async def roster(room_id: str, p=Depends(participant_auth)):
    if p["status"] != "approved":
        raise HTTPException(403, "Not admitted")
    parts = await db.participants.find({"room_id": room_id, "status": "approved"}, {"_id": 0}).to_list(500)
    return [{"id": x["id"], "display_name": x["display_name"], "role": x["role"], "platform": x["platform"],
             "camera_on": x.get("camera_on"), "mic_on": x.get("mic_on"), "in_call": x.get("in_call")} for x in parts]


@router.post("/rooms/{room_id}/media-token")
async def media_token(room_id: str, p=Depends(participant_auth)):
    if p["status"] != "approved":
        raise HTTPException(403, "The host has not admitted you")
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if room["status"] != "active":
        raise HTTPException(410, "This meeting has ended")
    if not lk_configured():
        raise HTTPException(503, "Video service is not configured yet")
    grants = lk.VideoGrants(room_join=True, room=room_id, can_subscribe=not p.get("video_restricted", False), can_publish=True,
                            can_publish_data=False, can_publish_sources=ALLOWED_SOURCES, can_update_own_metadata=False)
    token = (lk.AccessToken(LK_KEY, LK_SECRET).with_identity(p["id"]).with_name(p["display_name"])
             .with_metadata(json.dumps({"role": p["role"]})).with_grants(grants).with_ttl(timedelta(minutes=10)).to_jwt())
    await db.participants.update_one({"id": p["id"]}, {"$set": {"in_call": True, "joined_at": now()}})
    await notify(room_id, "participant_update")
    return {"server_url": LK_URL, "token": token, "allowed_sources": ALLOWED_SOURCES}


@router.post("/rooms/{room_id}/state")
async def update_state(room_id: str, body: StateIn, p=Depends(participant_auth)):
    upd = {k: v for k, v in {"camera_on": body.camera_on, "mic_on": body.mic_on}.items() if v is not None}
    if body.capture:
        upd["capture"] = body.capture.model_dump()
    if upd:
        await db.participants.update_one({"id": p["id"]}, {"$set": upd})
        await hub.send(room_id, {"type": "participant_update"}, host_only=True)
    return ok()


@router.post("/rooms/{room_id}/leave")
async def leave(room_id: str, p=Depends(participant_auth)):
    await db.participants.update_one({"id": p["id"]}, {"$set": {"in_call": False}})
    await notify(room_id, "participant_update")
    return ok()


@router.post("/rooms/{room_id}/security-events", status_code=201)
async def security_event(room_id: str, body: EventIn, p=Depends(participant_auth)):
    """Identity, platform and room come from the authenticated participant record — never from the request."""
    await rate_limit(f"sec-event:{p['id']}", 20, 60)
    if p["status"] != "approved":
        raise HTTPException(403, "Not admitted")
    allowed = NATIVE_SOURCES.get(p["platform"], set())
    if body.detection_source not in allowed:
        raise HTTPException(422, "This platform has no supported capture detection source")
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    s = room["settings"]
    actions: list[str] = []
    penalize = body.event_type in PENALTY_EVENTS and p["role"] != "host"
    if penalize and s["warn_participant"]:
        actions.append("participant_warned")
        await db.participants.update_one({"id": p["id"]}, {"$inc": {"warnings": 1}})
    if penalize and s["restrict_video_on_capture"] and not s["auto_remove_on_capture"]:
        actions.append("video_restricted")
        await db.participants.update_one({"id": p["id"]}, {"$set": {"video_restricted": True}})
        await lk_set_subscribe(room_id, p["id"], False)
    if penalize and s["auto_remove_on_capture"]:
        actions.append("participant_removed")
        await db.participants.update_one({"id": p["id"]}, {"$set": {"status": "removed", "in_call": False, "removed_reason": "capture_event"}})
        await lk_remove(room_id, p["id"])
        if s["block_rejoin_after_removal"]:
            actions.append("rejoin_blocked")
    ev = {"id": new_id(), "room_id": room_id, "participant_id": p["id"], "user_id": p.get("user_id"), "username": p["display_name"],
          "verified_identity": p.get("verified_identity"), "device_type": p["platform"], "os": p["os"], "device_model": p.get("model", ""),
          "detection_source": body.detection_source, "event_type": body.event_type, "verified": True,
          "verification_status": "device_reported_native_api", "actions": actions, "created_at": now()}
    await db.security_events.insert_one(dict(ev))
    await audit(room_id, p["id"], f"security_{body.event_type}", meta={"actions": actions})
    if s["notify_host"]:
        await hub.send(room_id, {"type": "security_event", "event": clean(ev)}, host_only=True)
    if "participant_warned" in actions or "participant_removed" in actions or "video_restricted" in actions:
        await hub.send(room_id, {"type": "you_update", "actions": actions}, to_pid=p["id"])
    if "participant_removed" in actions:
        await hub.kick(room_id, p["id"])
    return {"id": ev["id"], "actions": actions}


@router.get("/rooms/{room_id}/messages")
async def get_messages(room_id: str, p=Depends(participant_auth)):
    if p["status"] != "approved":
        raise HTTPException(403, "Not admitted")
    docs = await db.messages.find({"room_id": room_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [clean(d) for d in reversed(docs)]


@router.post("/rooms/{room_id}/messages", status_code=201)
async def post_message(room_id: str, body: MessageIn, p=Depends(participant_auth)):
    await rate_limit(f"msg:{p['id']}", 30, 60)
    if p["status"] != "approved":
        raise HTTPException(403, "Not admitted")
    msg = {"id": new_id(), "room_id": room_id, "participant_id": p["id"], "name": p["display_name"], "role": p["role"],
           "text": body.text.strip(), "created_at": now()}
    await db.messages.insert_one(dict(msg))
    await notify(room_id, "message")
    return clean(msg)


# ---------------------------------------------------------------- host moderation
@router.post("/rooms/{room_id}/participants/{pid}/{action}")
async def moderate(room_id: str, pid: str, action: Literal["approve", "reject", "remove", "block", "mute", "restrict-video", "allow-video"],
                   user=Depends(current_user)):
    room = await host_room(room_id, user)
    p = await db.participants.find_one({"id": pid, "room_id": room_id}, {"_id": 0})
    if not p or p["role"] == "host":
        raise HTTPException(404, "Participant not found")
    if action == "approve":
        if room["status"] != "active":
            raise HTTPException(410, "This meeting has ended")
        if p["status"] != "pending":
            raise HTTPException(409, "Participant is not waiting")
        if room["locked"]:
            raise HTTPException(423, "Unlock the room before admitting participants")
        await db.participants.update_one({"id": pid}, {"$set": {"status": "approved"}})
    elif action == "reject":
        await db.participants.update_one({"id": pid}, {"$set": {"status": "rejected", "in_call": False}})
    elif action == "remove":
        await db.participants.update_one({"id": pid}, {"$set": {"status": "removed", "in_call": False, "removed_reason": "host"}})
        await lk_remove(room_id, pid)
    elif action == "block":
        await db.participants.update_one({"id": pid}, {"$set": {"status": "blocked", "in_call": False}})
        await db.blocks.update_one({"host_id": user["id"], "email": p["email"]},
                                   {"$setOnInsert": {"id": new_id(), "host_id": user["id"], "email": p["email"],
                                                     "display_name": p["display_name"], "created_at": now()}}, upsert=True)
        await lk_remove(room_id, pid)
    elif action == "mute":
        await lk_mute_audio(room_id, pid)
        await db.participants.update_one({"id": pid}, {"$set": {"mic_on": False}})
    elif action in ("restrict-video", "allow-video"):
        restricted = action == "restrict-video"
        await db.participants.update_one({"id": pid}, {"$set": {"video_restricted": restricted}})
        await lk_set_subscribe(room_id, pid, not restricted)
    await audit(room_id, user["id"], f"participant_{action}", pid)
    await notify(room_id, "participant_update")
    await hub.send(room_id, {"type": "you_update", "actions": [action]}, to_pid=pid)
    if action in ("reject", "remove", "block"):
        await hub.kick(room_id, pid)  # they were told above; now stop streaming room signals to them
    return ok()


# ---------------------------------------------------------------- realtime
@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    """Auth happens in the first message so keys never appear in URLs or access logs."""
    await ws.accept()
    room_id = None
    try:
        raw = await asyncio.wait_for(ws.receive_text(), timeout=10)
        if len(raw) > 512:
            await ws.close(code=1009)
            return
        msg = json.loads(raw)
        room_id, key = str(msg.get("room_id", ""))[:64], str(msg.get("key", ""))[:128]
        p = await db.participants.find_one({"room_id": room_id, "key_hash": sha256(key)}, {"_id": 0})
        # Only people still waiting or admitted may listen; removed/left/rejected/blocked get nothing.
        if not p or p["status"] not in ("pending", "approved"):
            room_id = None  # not registered in the hub, nothing to clean up
            await ws.close(code=4401)
            return
        hub.add(room_id, ws, p)
        await ws.send_text(json.dumps({"type": "ready"}))
        while True:
            # keepalive pings only; no client-originated events are trusted here
            if len(await ws.receive_text()) > 256:
                await ws.close(code=1009)
                return
    except (WebSocketDisconnect, asyncio.TimeoutError, json.JSONDecodeError, AttributeError):
        pass
    finally:
        if room_id:
            hub.remove(room_id, ws)
