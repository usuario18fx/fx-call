"""Shared backend core: database, security helpers, auth dependency, rate limits, realtime hub."""
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request, WebSocket
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("fxcall")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ISSUER = "fxcall-api"
ACCESS_MINUTES = 15
REFRESH_DAYS = 30
PUBLIC_APP_URL = os.environ["PUBLIC_APP_URL"].rstrip("/")


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid.uuid4().hex


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def code_hash(code: str, salt: str) -> str:
    return hmac.new(JWT_SECRET.encode(), f"{salt}:{code}".encode(), hashlib.sha256).hexdigest()


def gen_code() -> str:
    return f"{secrets.randbelow(10**6):06d}"


def clean(doc: Optional[dict], drop: tuple = ()) -> Optional[dict]:
    """Make a Mongo document JSON-safe: drop _id/secret fields, datetimes -> ISO strings."""
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k == "_id" or k in drop or k.endswith("_hash"):
            continue
        if isinstance(v, datetime):
            v = (v if v.tzinfo else v.replace(tzinfo=timezone.utc)).isoformat()
        elif isinstance(v, dict):
            v = clean(v)
        out[k] = v
    return out


def aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def rate_limit(key: str, limit: int, window_seconds: int) -> None:
    bucket = int(time.time() // window_seconds)
    doc = await db.rate_limits.find_one_and_update(
        {"key": f"{key}:{bucket}"},
        {"$inc": {"count": 1}, "$setOnInsert": {"expires_at": now() + timedelta(seconds=window_seconds * 2)}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if doc["count"] > limit:
        raise HTTPException(429, "Too many attempts. Please wait a moment and try again.")


# ---------------------------------------------------------------- tokens
def make_access_token(user_id: str, sid: str) -> str:
    t = now()
    return jwt.encode(
        {"sub": user_id, "sid": sid, "typ": "access", "iat": t, "exp": t + timedelta(minutes=ACCESS_MINUTES), "iss": JWT_ISSUER},
        JWT_SECRET,
        algorithm="HS256",
    )


def make_guest_token(email: str, invite_id: str) -> str:
    t = now()
    return jwt.encode(
        {"sub": email, "inv": invite_id, "typ": "guest", "iat": t, "exp": t + timedelta(minutes=30), "iss": JWT_ISSUER},
        JWT_SECRET,
        algorithm="HS256",
    )


def decode_token(token: str, typ: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], issuer=JWT_ISSUER)
    except jwt.PyJWTError:
        raise HTTPException(401, "Not authenticated")
    if payload.get("typ") != typ:
        raise HTTPException(401, "Not authenticated")
    return payload


bearer = HTTPBearer(auto_error=False)


async def _user_from_credentials(cred: Optional[HTTPAuthorizationCredentials]) -> Optional[dict]:
    if not cred:
        return None
    p = decode_token(cred.credentials, "access")
    session = await db.sessions.find_one({"id": p["sid"], "user_id": p["sub"], "revoked_at": None})
    if not session or aware(session["expires_at"]) <= now():
        raise HTTPException(401, "Session revoked")
    user = await db.users.find_one({"id": p["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "Not authenticated")
    user["_sid"] = p["sid"]
    return user


async def current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    user = await _user_from_credentials(cred)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


async def optional_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> Optional[dict]:
    return await _user_from_credentials(cred)


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "display_name": u["display_name"],
        "verified": u.get("verified", False),
        "totp_enabled": bool(u.get("totp_secret")),
        "created_at": clean({"c": u["created_at"]})["c"],
    }


async def audit(room_id: Optional[str], actor: str, action: str, target: Optional[str] = None, meta: Optional[dict] = None) -> None:
    await db.audit_logs.insert_one(
        {"id": new_id(), "room_id": room_id, "actor": actor, "action": action, "target": target, "meta": meta or {}, "created_at": now()}
    )


# ---------------------------------------------------------------- realtime hub
class Hub:
    """Authenticated per-room WebSocket fan-out. Messages are signals; clients refetch via REST."""

    def __init__(self) -> None:
        self.rooms: dict[str, dict[WebSocket, dict]] = {}

    def add(self, room_id: str, ws: WebSocket, participant: dict) -> None:
        self.rooms.setdefault(room_id, {})[ws] = {"pid": participant["id"], "host": participant["role"] == "host"}

    def remove(self, room_id: str, ws: WebSocket) -> None:
        self.rooms.get(room_id, {}).pop(ws, None)

    async def send(self, room_id: str, message: dict, *, host_only: bool = False, to_pid: Optional[str] = None) -> None:
        data = json.dumps(message)
        for ws, meta in list(self.rooms.get(room_id, {}).items()):
            if host_only and not meta["host"]:
                continue
            if to_pid and meta["pid"] != to_pid:
                continue
            try:
                await ws.send_text(data)
            except Exception:
                self.remove(room_id, ws)


hub = Hub()


def ok(**extra: Any) -> dict:
    return {"ok": True, **extra}
