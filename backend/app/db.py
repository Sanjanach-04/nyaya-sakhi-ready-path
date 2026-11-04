"""Database engine, sessions and RLS-scoped dependencies."""
from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Annotated, TYPE_CHECKING

from fastapi import Depends
from sqlalchemy import text

if TYPE_CHECKING:  # pragma: no cover - type-only import
    from sqlalchemy.engine import Engine
    from sqlalchemy.orm import Session

# Imported at runtime: FastAPI resolves dependency annotations against module
# globals, so get_current_user must be a real symbol here. app.core.security
# only imports app.db lazily inside is_admin, so this is not a cycle.
from app.core.security import AuthUser, get_current_user, get_optional_user

from app.core.config import settings

_engine: Engine | None = None
_session_factory = None


def _lazy_engine() -> Engine:
    """Create the engine on first use so importing the app needs no DATABASE_URL."""
    global _engine, _session_factory
    if _engine is None:
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        if not settings.DATABASE_URL:
            raise RuntimeError(
                "DATABASE_URL is not configured. Copy backend/.env.example to backend/.env "
                "and set DATABASE_URL to your Postgres connection string."
            )
        _engine = create_engine(settings.sqlalchemy_url, pool_pre_ping=True, pool_size=5, max_overflow=5)
        _session_factory = sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False)
    return _engine


class SessionLocal_:  # noqa: N801 - factory object
    """Session factory created lazily; used as `SessionLocal()`."""

    def __call__(self) -> Session:
        _lazy_engine()
        assert _session_factory is not None
        return _session_factory()


SessionLocal = SessionLocal_()


def get_admin_db() -> Iterator[Session]:
    """Session WITHOUT RLS role switching — for admin/service-role operations.

    The connecting Postgres role (typically `postgres`) owns the tables, so
    Row Level Security does not apply. Every call site must be admin-gated.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db(user: Annotated[AuthUser, Depends(get_current_user)]) -> Iterator[Session]:
    """Session with RLS enforced as the calling user (SET LOCAL ROLE).

    The user dependency resolves the verified caller itself, so routes can
    use `Depends(get_db)` without passing the user again.
    """
    db = SessionLocal()
    try:
        claims = {"sub": user.id, "role": "authenticated"}
        if getattr(user, "email", None):
            claims["email"] = user.email
        db.execute(
            text("select set_config('role', 'authenticated', true), "
                 "set_config('request.jwt.claims', :claims, true)"),
            {"claims": json.dumps(claims)},
        )
        yield db
    finally:
        db.close()


def get_public_db(
    user: Annotated[AuthUser | None, Depends(get_optional_user)],
) -> Iterator[Session]:
    """Session for PUBLIC endpoints (guests allowed).

    Guests run as the Postgres `anon` role, so only the public-read RLS
    policies apply (approved legal documents/chunks, schemes, emergency
    contacts, legal aid, legal sources). A signed-in caller runs as
    `authenticated` with their claims, exactly like get_db.
    """
    db = SessionLocal()
    try:
        if user is None:
            db.execute(
                text("select set_config('role', 'anon', true), "
                     "set_config('request.jwt.claims', :claims, true)"),
                {"claims": json.dumps({"role": "anon"})},
            )
        else:
            claims = {"sub": user.id, "role": "authenticated"}
            if getattr(user, "email", None):
                claims["email"] = user.email
            db.execute(
                text("select set_config('role', 'authenticated', true), "
                     "set_config('request.jwt.claims', :claims, true)"),
                {"claims": json.dumps(claims)},
            )
        yield db
    finally:
        db.close()
