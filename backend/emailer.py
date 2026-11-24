"""Server-side transactional email: direct Resend or Emergent managed email.

Set RESEND_API_KEY and RESEND_FROM_EMAIL to opt into direct Resend delivery.
Secrets must stay on the backend; never expose them through Expo public config.
"""
import ipaddress
import logging
import os
import re
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from core import db, new_id, now

logger = logging.getLogger("fxcall.email")

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "FX CALL")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
# Preview-only test outbox: codes for reserved test domains are written to Mongo instead of being sent.
DEV_OUTBOX = os.environ.get("EMAIL_DEV_OUTBOX", "false").lower() == "true"
TEST_DOMAINS = ("example.com", "test.fxcall")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    # Prefer the caller's own direct Resend account when configured. Do not
    # silently fall back to Emergent credits on direct-provider failure.
    if RESEND_API_KEY or RESEND_FROM_EMAIL:
        if not (RESEND_API_KEY and RESEND_FROM_EMAIL):
            logger.error("Direct Resend requires both RESEND_API_KEY and RESEND_FROM_EMAIL")
            raise HTTPException(503, "Verification email is not configured")
        endpoint = "https://api.resend.com/emails"
        headers = {"Authorization": f"Bearer {RESEND_API_KEY}"}
        payload = {
            "from": f"{EMAIL_FROM_NAME} <{RESEND_FROM_EMAIL}>",
            "to": [to],
            "subject": subject,
            "html": html,
        }
        if EMAIL_REPLY_TO:
            payload["reply_to"] = EMAIL_REPLY_TO
        provider = "resend"
    elif EMAIL_KEY:
        endpoint = f"{EMAIL_BASE_URL}/api/v1/email/send"
        headers = {"X-Email-Key": EMAIL_KEY}
        payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
        if EMAIL_REPLY_TO:
            payload["contact_email"] = EMAIL_REPLY_TO
        provider = "emergent"
    else:
        logger.error("Neither direct Resend nor Emergent email is configured")
        raise HTTPException(503, "Verification email is not configured")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
        resp.raise_for_status()
        # Provider accepted the request. This is not proof of inbox delivery.
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        status = e.response.status_code
        try:
            error_data = e.response.json()
            code = str(error_data.get("code", ""))
        except (ValueError, AttributeError):
            code = ""
        if status == 429 or code in ("insufficient_credits", "integration_disabled", "daily_limit_reached", "rate_limit_exceeded"):
            logger.warning("%s email temporarily unavailable (status=%s, code=%s)", provider, status, code)
            raise HTTPException(503, "Email is temporarily unavailable")
        logger.error("%s email request rejected (status=%s, code=%s)", provider, status, code)
        if status in (401, 403) or code in ("validation_error", "invalid_from_address"):
            raise HTTPException(503, "Verification email configuration needs attention")
        raise HTTPException(502, "Failed to send email")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("%s email send error: %s", provider, type(e).__name__)
        raise HTTPException(502, "Failed to send email")


PURPOSES = {
    "verify": ("Verify your FX CALL email", "Use this code to verify your email address and activate your FX CALL account."),
    "change_password": ("Your FX CALL password change code", "Use this code to confirm the password change you requested. If this was not you, secure your account immediately."),
    "change_email": ("Confirm your new FX CALL email", "Use this code to confirm your new FX CALL email address. If you did not request this change, ignore this email."),
    "reset": ("Your FX CALL password reset code", "Use this code to reset your FX CALL password. If you did not request a reset, you can ignore this email."),
    "guest": ("Your FX CALL meeting verification code", "Use this code to confirm your email before requesting to join a private FX CALL meeting."),
}


async def send_code_email(to: str, purpose: str, code: str) -> None:
    subject, line = PURPOSES[purpose]
    if DEV_OUTBOX and to.lower().endswith(TEST_DOMAINS):
        await db.dev_outbox.insert_one({"id": new_id(), "to": to.lower(), "purpose": purpose, "code": code, "created_at": now()})
        return
    html = (
        '<table role="presentation" width="100%" style="background:#0D0D0E"><tr><td style="padding:32px;font-family:Arial,sans-serif;color:#C6C9D1">'
        '<p style="font-size:20px;letter-spacing:3px;color:#EAECEF;margin:0 0 16px">FX CALL</p>'
        f'<p style="font-size:14px;margin:0 0 16px">{escape(line)}</p>'
        f'<p style="font-size:32px;letter-spacing:8px;color:#FFFFFF;background:#145B89;padding:12px 20px;display:inline-block;border-radius:6px;margin:0 0 16px">{escape(code)}</p>'
        '<p style="font-size:12px;color:#7E8490;margin:0">This code expires in 15 minutes. '
        f'Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password by email.</p>'
        "</td></tr></table>"
    )
    await send_email(to=to, subject=subject, html=html)
