"""Misc routes: emergency contacts, legal aid, saved items."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import CurrentUser
from app.db import get_db, get_public_db
from app.schemas import EmergencyContactOut, LegalAidAuthorityOut, SavedItemCreate, SavedItemOut

router = APIRouter(tags=["directory"])


@router.get("/api/emergency", response_model=list[EmergencyContactOut])
def emergency(db: Session = Depends(get_public_db)) -> list[EmergencyContactOut]:
    rows = db.execute(
        text(
            "select id, name, purpose, phone_number, availability, category, is_demo, source_reference, display_order "
            "from public.emergency_contacts order by display_order, name"
        )
    ).mappings().all()
    return [
        EmergencyContactOut(
            id=str(r["id"]),
            name=r["name"],
            purpose=r["purpose"],
            phone_number=r["phone_number"],
            availability=r.get("availability"),
            category=r["category"],
            is_demo=bool(r["is_demo"]),
            source_reference=r["source_reference"],
            display_order=int(r["display_order"] or 0),
        )
        for r in rows
    ]


@router.get("/api/legal-aid", response_model=list[LegalAidAuthorityOut])
def legal_aid(
    state: str | None = None, level: str | None = None, db: Session = Depends(get_public_db)
) -> list[LegalAidAuthorityOut]:
    sql = (
        "select id, name, level, state, district, address, phone, website, "
        "source_reference, last_verified_date, is_demo from public.legal_aid_authorities where true"
    )
    params: dict = {}
    if state:
        sql += " and (state = :state or level = 'national')"
        params["state"] = state
    if level:
        sql += " and level = :level"
        params["level"] = level
    sql += " order by case level when 'national' then 0 when 'state' then 1 else 2 end, name"
    rows = db.execute(text(sql), params).mappings().all()
    return [
        LegalAidAuthorityOut(
            id=str(r["id"]),
            name=r["name"],
            level=r["level"],  # type: ignore[arg-type]
            state=r.get("state"),
            district=r.get("district"),
            address=r.get("address"),
            phone=r.get("phone"),
            website=r.get("website"),
            source_reference=r["source_reference"],
            last_verified_date=r.get("last_verified_date"),
            is_demo=bool(r["is_demo"]),
        )
        for r in rows
    ]


@router.get("/api/saved", response_model=list[SavedItemOut])
def list_saved(
    user: CurrentUser, item_type: str | None = None, db: Session = Depends(get_db)
) -> list[SavedItemOut]:
    sql = "select * from public.saved_items where user_id = :uid"
    params: dict = {"uid": user.id}
    if item_type:
        sql += " and item_type = :item_type"
        params["item_type"] = item_type
    sql += " order by created_at desc limit 200"
    rows = db.execute(text(sql), params).mappings().all()
    return [_saved_row(r) for r in rows]


def _saved_row(r) -> SavedItemOut:
    return SavedItemOut(
        id=str(r["id"]),
        item_type=r["item_type"],  # type: ignore[arg-type]
        ref_id=str(r["ref_id"]) if r.get("ref_id") else None,
        title=r["title"],
        note=r.get("note"),
        created_at=r["created_at"],
    )


@router.post("/api/saved", response_model=SavedItemOut)
def create_saved(
    payload: SavedItemCreate, user: CurrentUser, db: Session = Depends(get_db)
) -> SavedItemOut:
    row_id = db.execute(
        text(
            "insert into public.saved_items (user_id, item_type, ref_id, title, note) "
            "values (:uid, :item_type, cast(:ref_id as uuid), :title, :note) returning id"
        ),
        {
            "uid": user.id,
            "item_type": payload.item_type,
            "ref_id": payload.ref_id,
            "title": payload.title,
            "note": payload.note,
        },
    ).scalar_one()
    db.commit()
    row = db.execute(
        text("select * from public.saved_items where id = :id"), {"id": str(row_id)}
    ).mappings().one()
    return _saved_row(row)


@router.delete("/api/saved/{item_id}")
def delete_saved(item_id: str, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    result = db.execute(
        text("delete from public.saved_items where id = :id and user_id = :uid"),
        {"id": item_id, "uid": user.id},
    )
    db.commit()
    if (result.rowcount or 0) == 0:
        raise HTTPException(status_code=404, detail="Saved item not found")
    return {"deleted": True}
