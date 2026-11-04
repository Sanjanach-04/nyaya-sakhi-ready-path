"""Complaint drafts: template-based generation + CRUD. Never auto-submits."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import CurrentUser
from app.db import get_db
from app.schemas import (
    ComplaintDraftCreate,
    ComplaintDraftOut,
    ComplaintDraftUpdate,
    ComplaintGenerateRequest,
    ComplaintTemplate,
)
from app.services import drafter as drafter_service
from app.services import usage

router = APIRouter(prefix="/api/complaints", tags=["complaints"])


def _row_to_draft(r) -> ComplaintDraftOut:
    return ComplaintDraftOut(
        id=str(r["id"]),
        document_type=r["document_type"],
        title=r["title"],
        form_data=r.get("form_data") or {},
        draft_content=r["draft_content"],
        language=r["language"],
        created_at=r["created_at"],
        updated_at=r.get("updated_at"),
    )


@router.get("/templates", response_model=list[ComplaintTemplate])
def templates(user: CurrentUser) -> list[ComplaintTemplate]:
    return drafter_service.TEMPLATES


@router.post("/generate")
def generate(
    payload: ComplaintGenerateRequest, user: CurrentUser, db: Session = Depends(get_db)
) -> dict:
    template = drafter_service.get_template(payload.document_type)
    if not template:
        raise HTTPException(status_code=404, detail="Unknown template")
    fields = {k: str(v) for k, v in payload.fields.items() if v is not None}
    try:
        title, body = drafter_service.generate_draft(template, fields, payload.language)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Optional translation of the body (Act/Section references are preserved
    # by the translation service).
    from app.services import translation as translation_service

    body, _translated = translation_service.translate_text(body, payload.language)
    usage.log_event(db, user.id, "draft_generated")
    return {"title": title, "draft_content": body}


@router.post("", response_model=ComplaintDraftOut)
def create_draft(
    payload: ComplaintDraftCreate, user: CurrentUser, db: Session = Depends(get_db)
) -> ComplaintDraftOut:
    row_id = db.execute(
        text(
            "insert into public.complaint_drafts (user_id, document_type, title, form_data, draft_content, language) "
            "values (:uid, :document_type, :title, cast(:form_data as jsonb), :draft_content, :language) "
            "returning id"
        ),
        {
            "uid": user.id,
            "document_type": payload.document_type,
            "title": payload.title,
            "form_data": json.dumps(payload.form_data),
            "draft_content": payload.draft_content,
            "language": payload.language,
        },
    ).scalar_one()
    db.commit()
    row = db.execute(
        text("select * from public.complaint_drafts where id = :id"), {"id": str(row_id)}
    ).mappings().one()
    return _row_to_draft(row)


@router.get("", response_model=list[ComplaintDraftOut])
def list_drafts(user: CurrentUser, db: Session = Depends(get_db)) -> list[ComplaintDraftOut]:
    rows = db.execute(
        text(
            "select * from public.complaint_drafts where user_id = :uid order by created_at desc limit 200"
        ),
        {"uid": user.id},
    ).mappings().all()
    return [_row_to_draft(r) for r in rows]


@router.get("/{draft_id}", response_model=ComplaintDraftOut)
def get_draft(draft_id: str, user: CurrentUser, db: Session = Depends(get_db)) -> ComplaintDraftOut:
    row = db.execute(
        text("select * from public.complaint_drafts where id = :id and user_id = :uid"),
        {"id": draft_id, "uid": user.id},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Draft not found")
    return _row_to_draft(row)


@router.put("/{draft_id}", response_model=ComplaintDraftOut)
def update_draft(
    draft_id: str, payload: ComplaintDraftUpdate, user: CurrentUser, db: Session = Depends(get_db)
) -> ComplaintDraftOut:
    sets = []
    params: dict = {"id": draft_id, "uid": user.id}
    if payload.title is not None:
        sets.append("title = :title")
        params["title"] = payload.title
    if payload.draft_content is not None:
        sets.append("draft_content = :draft_content")
        params["draft_content"] = payload.draft_content
    if payload.form_data is not None:
        sets.append("form_data = cast(:form_data as jsonb)")
        params["form_data"] = json.dumps(payload.form_data)
    if payload.language is not None:
        sets.append("language = :language")
        params["language"] = payload.language
    if not sets:
        raise HTTPException(status_code=422, detail="Nothing to update")
    result = db.execute(
        text(
            f"update public.complaint_drafts set {', '.join(sets)}, updated_at = now() "
            "where id = :id and user_id = :uid returning *"
        ),
        params,
    ).mappings().first()
    db.commit()
    if not result:
        raise HTTPException(status_code=404, detail="Draft not found")
    return _row_to_draft(result)


@router.delete("/{draft_id}")
def delete_draft(draft_id: str, user: CurrentUser, db: Session = Depends(get_db)) -> dict:
    result = db.execute(
        text("delete from public.complaint_drafts where id = :id and user_id = :uid"),
        {"id": draft_id, "uid": user.id},
    )
    db.commit()
    if (result.rowcount or 0) == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"deleted": True}
