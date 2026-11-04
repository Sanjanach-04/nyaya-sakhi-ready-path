"""Public readiness endpoint used by the frontend's connection diagnostics.

GET /api/health — no auth. Never returns secrets or user data; only booleans
saying which parts of the backend are ready. `status` is "ok" whenever the
process is up; the booleans tell the frontend what is not ready yet.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import settings
from app.services.embedding import is_model_available

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


def _db_ready() -> bool:
    if not settings.DATABASE_URL:
        return False
    try:
        from app.db import SessionLocal

        db = SessionLocal()
        try:
            db.execute(text("select 1"))
            return True
        finally:
            db.close()
    except Exception:  # noqa: BLE001 - any failure means "not ready"
        logger.warning("Health check: database not reachable", exc_info=True)
        return False


@router.get("/api/health")
def api_health() -> dict:
    return {
        "status": "ok",
        "db": _db_ready(),
        "embedding_model": is_model_available(),
        "llm_configured": settings.llm_configured,
    }
