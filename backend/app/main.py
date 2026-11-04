"""Nyaya Sakhi FastAPI application entrypoint.

Run locally:  uvicorn app.main:app --reload --port 8000
Swagger:      http://localhost:8000/docs
"""
from __future__ import annotations

import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.api.routes import admin, auth, chat, complaints, legal, misc, schemes, speech
from app.api.routes import health as health_routes

logger = logging.getLogger(__name__)

configure_logging()

app = FastAPI(
    title="Nyaya Sakhi API",
    description=(
        "Backend for Nyaya Sakhi — legal literacy for women in India. "
        "RAG answers come ONLY from admin-approved documents. "
        "The answer can never be better than the verified knowledge base behind it."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    if request.url.path not in ("/health", "/api/health"):
        logger.info(
            "%s %s -> %s (%.0f ms)",
            request.method, request.url.path, response.status_code,
            (time.perf_counter() - start) * 1000,
        )
    return response


register_error_handlers(app)

app.include_router(health_routes.router)
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(legal.router)
app.include_router(schemes.router)
app.include_router(complaints.router)
app.include_router(misc.router)
app.include_router(speech.router)
app.include_router(admin.router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "nyaya-sakhi-api"}
