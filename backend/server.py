import asyncio
import logging
import os
from contextlib import suppress

from fastapi import FastAPI, Request
from pymongo import ASCENDING, DESCENDING, IndexModel
from starlette.middleware.cors import CORSMiddleware

from core import client, db
from auth_routes import router as auth_router
from room_routes import router as room_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

INDEXES: dict[str, list[IndexModel]] = {
    "users": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("email", ASCENDING)], name="email", unique=True)],
    "sessions": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("refresh_hash", ASCENDING)], name="refresh"),
                 IndexModel([("user_id", ASCENDING), ("revoked_at", ASCENDING)], name="user_active"),
                 IndexModel([("expires_at", ASCENDING)], name="ttl", expireAfterSeconds=0)],
    "challenges": [IndexModel([("kind", ASCENDING), ("email", ASCENDING)], name="kind_email"),
                   IndexModel([("expires_at", ASCENDING)], name="ttl", expireAfterSeconds=0)],
    "rate_limits": [IndexModel([("key", ASCENDING)], name="key", unique=True), IndexModel([("expires_at", ASCENDING)], name="ttl", expireAfterSeconds=0)],
    "rooms": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("host_id", ASCENDING), ("created_at", DESCENDING)], name="host")],
    "invites": [IndexModel([("token_hash", ASCENDING)], name="token", unique=True), IndexModel([("room_id", ASCENDING)], name="room")],
    "participants": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("room_id", ASCENDING), ("key_hash", ASCENDING)], name="key"),
                     IndexModel([("room_id", ASCENDING), ("email", ASCENDING)], name="room_email")],
    "blocks": [IndexModel([("host_id", ASCENDING), ("email", ASCENDING)], name="host_email", unique=True)],
    # Minimal retention: chat 24h, security events 30d, audit 90d.
    "messages": [IndexModel([("room_id", ASCENDING), ("created_at", DESCENDING)], name="room"),
                 IndexModel([("created_at", ASCENDING)], name="ttl", expireAfterSeconds=86400)],
    "security_events": [IndexModel([("room_id", ASCENDING), ("created_at", DESCENDING)], name="room"),
                        IndexModel([("created_at", ASCENDING)], name="ttl", expireAfterSeconds=30 * 86400)],
    "audit_logs": [IndexModel([("room_id", ASCENDING), ("created_at", DESCENDING)], name="room"),
                   IndexModel([("created_at", ASCENDING)], name="ttl", expireAfterSeconds=90 * 86400)],
    "dev_outbox": [IndexModel([("created_at", ASCENDING)], name="ttl", expireAfterSeconds=3600)],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


app = FastAPI(title="FX CALL API")


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


@app.get("/api/")
async def root():
    return {"service": "FX CALL", "screen_sharing": "disabled"}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "display-capture=()"
    response.headers["Cache-Control"] = "no-store"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


app.include_router(auth_router)
app.include_router(room_router)

# Bearer tokens only (no cookies), so credentials are not sent cross-site automatically (CSRF-safe).
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=[o.strip() for o in os.environ["CORS_ORIGINS"].split(",") if o.strip()],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-Participant-Key"],
)


@app.on_event("startup")
async def start_index_build():
    app.state.index_task = asyncio.create_task(ensure_indexes())


@app.on_event("shutdown")
async def shutdown_db_client():
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()
