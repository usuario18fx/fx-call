"""Accounts: registration, email verification, login (+TOTP), refresh rotation, reset, sessions."""
import base64
import io
import secrets
from datetime import timedelta
from typing import Literal, Optional

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request
from pwdlib import PasswordHash
from pydantic import BaseModel, EmailStr, Field

from core import (REFRESH_DAYS, aware, clean, client_ip, code_hash, current_user, db, gen_code,
                  make_access_token, new_id, now, ok, public_user, rate_limit, sha256)
from emailer import send_code_email

router = APIRouter(prefix="/api/auth", tags=["auth"])
passwords = PasswordHash.recommended()
DUMMY_HASH = passwords.hash("fxcall-constant-dummy-password")
MAX_FAILED = 5
LOCK_MINUTES = 15
CODE_MINUTES = 15


class Device(BaseModel):
    platform: Literal["ios", "android", "web"] = "web"
    os: str = Field(default="", max_length=60)
    name: str = Field(default="", max_length=80)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    display_name: str = Field(min_length=1, max_length=60)


class EmailIn(BaseModel):
    email: EmailStr


class CodeIn(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")
    device: Device = Device()


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    totp_code: Optional[str] = Field(default=None, pattern=r"^\d{6}$")
    device: Device = Device()


class RefreshIn(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=256)


class ResetIn(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")
    password: str = Field(min_length=10, max_length=128)


class ProfileIn(BaseModel):
    display_name: str = Field(min_length=1, max_length=60)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


class TotpIn(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")


class TotpDisableIn(BaseModel):
    password: str = Field(min_length=1, max_length=128)
    code: str = Field(pattern=r"^\d{6}$")


# ---------------------------------------------------------------- helpers
async def issue_challenge(kind: str, email: str) -> None:
    code = gen_code()
    salt = new_id()
    await db.challenges.delete_many({"kind": kind, "email": email})
    await db.challenges.insert_one({
        "id": new_id(), "kind": kind, "email": email, "salt": salt, "code_hash": code_hash(code, salt),
        "attempts": 0, "expires_at": now() + timedelta(minutes=CODE_MINUTES), "created_at": now(),
    })
    await send_code_email(email, {"verify": "verify", "reset": "reset", "guest": "guest"}[kind], code)


async def consume_challenge(kind: str, email: str, code: str) -> None:
    ch = await db.challenges.find_one({"kind": kind, "email": email})
    if not ch or aware(ch["expires_at"]) <= now():
        raise HTTPException(400, "Code invalid or expired. Request a new one.")
    if ch["attempts"] >= 5:
        await db.challenges.delete_one({"id": ch["id"]})
        raise HTTPException(400, "Too many wrong codes. Request a new one.")
    if not secrets.compare_digest(ch["code_hash"], code_hash(code, ch["salt"])):
        await db.challenges.update_one({"id": ch["id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Incorrect code.")
    await db.challenges.delete_one({"id": ch["id"]})


async def issue_session(user: dict, device: Device, request: Request) -> dict:
    sid, refresh = new_id(), secrets.token_urlsafe(48)
    await db.sessions.insert_one({
        "id": sid, "user_id": user["id"], "refresh_hash": sha256(refresh), "platform": device.platform,
        "os": device.os, "device_name": device.name, "ip": client_ip(request), "created_at": now(),
        "last_used_at": now(), "expires_at": now() + timedelta(days=REFRESH_DAYS), "revoked_at": None,
    })
    return {"access_token": make_access_token(user["id"], sid), "refresh_token": refresh, "token_type": "bearer", "user": public_user(user)}


async def revoke_all(user_id: str) -> None:
    await db.sessions.update_many({"user_id": user_id, "revoked_at": None}, {"$set": {"revoked_at": now()}})


# ---------------------------------------------------------------- routes
@router.post("/register", status_code=202)
async def register(body: RegisterIn, request: Request):
    await rate_limit(f"register:{client_ip(request)}", 10, 3600)
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing and existing.get("verified"):
        raise HTTPException(409, "An account with this email already exists. Please sign in.")
    if existing:
        await db.users.update_one({"id": existing["id"]}, {"$set": {"password_hash": passwords.hash(body.password), "display_name": body.display_name.strip()}})
    else:
        await db.users.insert_one({
            "id": new_id(), "email": email, "password_hash": passwords.hash(body.password), "display_name": body.display_name.strip(),
            "verified": False, "totp_secret": None, "failed_logins": 0, "locked_until": None, "created_at": now(),
        })
    await issue_challenge("verify", email)
    return {"message": "Verification code sent.", "email": email}


@router.post("/resend-verification", status_code=202)
async def resend_verification(body: EmailIn, request: Request):
    email = body.email.lower()
    await rate_limit(f"resend:{email}", 5, 3600)
    await rate_limit(f"resend-ip:{client_ip(request)}", 20, 3600)
    user = await db.users.find_one({"email": email})
    if user and not user.get("verified"):
        await issue_challenge("verify", email)
    return {"message": "If the account needs verification, a code has been sent."}


@router.post("/verify-email")
async def verify_email(body: CodeIn, request: Request):
    email = body.email.lower()
    await rate_limit(f"verify:{email}", 15, 900)
    await consume_challenge("verify", email, body.code)
    user = await db.users.find_one_and_update({"email": email}, {"$set": {"verified": True}}, return_document=True)
    if not user:
        raise HTTPException(400, "Code invalid or expired.")
    return await issue_session(user, body.device, request)


@router.post("/login")
async def login(body: LoginIn, request: Request):
    email = body.email.lower()
    await rate_limit(f"login-ip:{client_ip(request)}", 30, 600)
    await rate_limit(f"login:{email}", 15, 600)
    user = await db.users.find_one({"email": email})
    if user and user.get("locked_until") and aware(user["locked_until"]) > now():
        raise HTTPException(423, "Too many failed attempts. Account temporarily locked for 15 minutes.")
    valid = passwords.verify(body.password, user["password_hash"]) if user else passwords.verify(body.password, DUMMY_HASH)
    if not user or not valid:
        if user:
            failed = user.get("failed_logins", 0) + 1
            upd = {"failed_logins": failed}
            if failed >= MAX_FAILED:
                upd = {"failed_logins": 0, "locked_until": now() + timedelta(minutes=LOCK_MINUTES)}
            await db.users.update_one({"id": user["id"]}, {"$set": upd})
        raise HTTPException(401, "Invalid email or password.")
    if not user.get("verified"):
        await issue_challenge("verify", email)
        raise HTTPException(403, "email_not_verified")
    if user.get("totp_secret"):
        if not body.totp_code:
            raise HTTPException(401, "totp_required")
        totp = pyotp.TOTP(user["totp_secret"])
        step = int(now().timestamp() // 30)
        if not totp.verify(body.totp_code, valid_window=1) or user.get("totp_last_step") == f"{step}:{body.totp_code}":
            raise HTTPException(401, "invalid_totp")
        await db.users.update_one({"id": user["id"]}, {"$set": {"totp_last_step": f"{step}:{body.totp_code}"}})
    await db.users.update_one({"id": user["id"]}, {"$set": {"failed_logins": 0, "locked_until": None}})
    return await issue_session(user, body.device, request)


@router.post("/refresh")
async def refresh(body: RefreshIn, request: Request):
    await rate_limit(f"refresh-ip:{client_ip(request)}", 120, 600)
    session = await db.sessions.find_one_and_update(
        {"refresh_hash": sha256(body.refresh_token), "revoked_at": None},
        {"$set": {"revoked_at": now()}},
    )
    if not session or aware(session["expires_at"]) <= now():
        raise HTTPException(401, "Invalid refresh token")
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        raise HTTPException(401, "Invalid refresh token")
    new_refresh = secrets.token_urlsafe(48)
    sid = new_id()
    await db.sessions.insert_one({**{k: v for k, v in session.items() if k != "_id"}, "id": sid, "refresh_hash": sha256(new_refresh),
                                  "revoked_at": None, "last_used_at": now(), "ip": client_ip(request)})
    return {"access_token": make_access_token(user["id"], sid), "refresh_token": new_refresh, "token_type": "bearer", "user": public_user(user)}


@router.post("/forgot", status_code=202)
async def forgot(body: EmailIn, request: Request):
    email = body.email.lower()
    await rate_limit(f"forgot:{email}", 5, 3600)
    await rate_limit(f"forgot-ip:{client_ip(request)}", 20, 3600)
    if await db.users.find_one({"email": email}):
        await issue_challenge("reset", email)
    return {"message": "If an account exists for this email, a reset code has been sent."}


@router.post("/reset")
async def reset(body: ResetIn, request: Request):
    email = body.email.lower()
    await rate_limit(f"reset:{email}", 15, 900)
    await consume_challenge("reset", email, body.code)
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(400, "Code invalid or expired.")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": passwords.hash(body.password), "verified": True, "failed_logins": 0, "locked_until": None}})
    await revoke_all(user["id"])
    return ok(message="Password updated. Sign in with your new password.")


@router.get("/me")
async def me(user=Depends(current_user)):
    return public_user(user)


@router.patch("/me")
async def update_me(body: ProfileIn, user=Depends(current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"display_name": body.display_name.strip()}})
    return public_user({**user, "display_name": body.display_name.strip()})


@router.post("/change-password")
async def change_password(body: ChangePasswordIn, user=Depends(current_user)):
    if not passwords.verify(body.current_password, user["password_hash"]):
        raise HTTPException(400, "Current password is incorrect.")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": passwords.hash(body.new_password)}})
    await db.sessions.update_many({"user_id": user["id"], "revoked_at": None, "id": {"$ne": user["_sid"]}}, {"$set": {"revoked_at": now()}})
    return ok(message="Password changed. Other devices were signed out.")


@router.post("/2fa/setup")
async def totp_setup(user=Depends(current_user)):
    if user.get("totp_secret"):
        raise HTTPException(400, "Two-factor sign-in is already enabled.")
    secret = pyotp.random_base32()
    await db.users.update_one({"id": user["id"]}, {"$set": {"totp_pending": secret}})
    uri = pyotp.TOTP(secret).provisioning_uri(name=user["email"], issuer_name="FX CALL")
    img = qrcode.make(uri, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return {"secret": secret, "otpauth_uri": uri, "qr_png_base64": base64.b64encode(buf.getvalue()).decode()}


@router.post("/2fa/confirm")
async def totp_confirm(body: TotpIn, user=Depends(current_user)):
    await rate_limit(f"totp:{user['id']}", 10, 600)
    secret = user.get("totp_pending")
    if not secret or not pyotp.TOTP(secret).verify(body.code, valid_window=1):
        raise HTTPException(400, "Invalid code.")
    await db.users.update_one({"id": user["id"]}, {"$set": {"totp_secret": secret}, "$unset": {"totp_pending": ""}})
    return ok(enabled=True)


@router.post("/2fa/disable")
async def totp_disable(body: TotpDisableIn, user=Depends(current_user)):
    await rate_limit(f"totp:{user['id']}", 10, 600)
    if not user.get("totp_secret") or not passwords.verify(body.password, user["password_hash"]) \
            or not pyotp.TOTP(user["totp_secret"]).verify(body.code, valid_window=1):
        raise HTTPException(400, "Password or code is incorrect.")
    await db.users.update_one({"id": user["id"]}, {"$set": {"totp_secret": None}})
    return ok(enabled=False)


@router.get("/sessions")
async def list_sessions(user=Depends(current_user)):
    docs = await db.sessions.find({"user_id": user["id"], "revoked_at": None, "expires_at": {"$gt": now()}}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return [{**clean(d, drop=("ip",)), "current": d["id"] == user["_sid"]} for d in docs]


@router.delete("/sessions/{sid}")
async def revoke_session(sid: str, user=Depends(current_user)):
    res = await db.sessions.update_one({"id": sid, "user_id": user["id"], "revoked_at": None}, {"$set": {"revoked_at": now()}})
    if not res.matched_count:
        raise HTTPException(404, "Session not found")
    return ok()


@router.post("/logout")
async def logout(user=Depends(current_user)):
    await db.sessions.update_one({"id": user["_sid"]}, {"$set": {"revoked_at": now()}})
    return ok()


@router.post("/logout-all")
async def logout_all(user=Depends(current_user)):
    await revoke_all(user["id"])
    return ok()
