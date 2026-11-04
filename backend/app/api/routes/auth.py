"""Auth/profile routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, is_admin
from app.db import get_db
from app.schemas import ProfileOut, ProfileUpdate

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _profile_row(db: Session, user_id: str) -> dict:
    row = db.execute(
        text("select id, display_name, preferred_language, created_at from public.profiles where id = :uid"),
        {"uid": user_id},
    ).mappings().first()
    return dict(row) if row else {}


@router.get("/profile", response_model=ProfileOut)
def get_profile(user: CurrentUser, db: Session = Depends(get_db)) -> ProfileOut:
    row = _profile_row(db, user.id)
    if not row:
        # The DB trigger normally creates profiles on signup; make sure one exists.
        from app.db import SessionLocal

        with SessionLocal() as admin_db:
            admin_db.execute(
                text("insert into public.profiles (id) values (:uid) on conflict (id) do nothing"),
                {"uid": user.id},
            )
            admin_db.commit()
        row = _profile_row(db, user.id)
    return ProfileOut(
        id=str(row.get("id", user.id)),
        email=user.email,
        display_name=row.get("display_name"),
        preferred_language=row.get("preferred_language") or "en",  # type: ignore[arg-type]
        created_at=row.get("created_at"),
        is_admin=is_admin(user),
    )


@router.put("/profile", response_model=ProfileOut)
def update_profile(
    payload: ProfileUpdate, user: CurrentUser, db: Session = Depends(get_db)
) -> ProfileOut:
    sets = []
    params: dict = {"uid": user.id}
    if payload.display_name is not None:
        sets.append("display_name = :display_name")
        params["display_name"] = payload.display_name
    if payload.preferred_language is not None:
        sets.append("preferred_language = :lang")
        params["lang"] = payload.preferred_language
    if sets:
        db.execute(
            text(f"update public.profiles set {', '.join(sets)}, updated_at = now() where id = :uid"),
            params,
        )
        db.commit()
    row = _profile_row(db, user.id)
    return ProfileOut(
        id=str(row.get("id", user.id)),
        email=user.email,
        display_name=row.get("display_name"),
        preferred_language=row.get("preferred_language") or "en",  # type: ignore[arg-type]
        created_at=row.get("created_at"),
        is_admin=is_admin(user),
    )
