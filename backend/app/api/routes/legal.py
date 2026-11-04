"""Legal browsing routes: acts, act detail, search (approved documents only)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import CurrentUser
from app.db import get_db
from app.schemas import LegalActDetail, LegalActSummary, LegalProvision

router = APIRouter(prefix="/api/legal", tags=["legal"])


def _summary_row(r) -> LegalActSummary:
    return LegalActSummary(
        id=str(r["id"]),
        title=r["title"],
        act_name=r["act_name"],
        category=r["category"],
        description=r.get("description"),
        summary=r.get("summary"),
        version=r["version"],
        language=r["language"],
        is_demo=bool(r["is_demo"]),
        updated_at=r.get("updated_at") or r.get("created_at"),
    )


_DOC_SELECT = (
    "select d.id, d.title, d.act_name, d.category, d.description, d.summary, "
    "d.version, d.language, d.is_demo, d.created_at, d.updated_at "
    "from public.legal_documents d "
)


@router.get("/acts", response_model=list[LegalActSummary])
def acts(
    user: CurrentUser,
    category: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
) -> list[LegalActSummary]:
    sql = _DOC_SELECT + "where d.status = 'approved'"
    params: dict = {}
    if category:
        sql += " and d.category = :category"
        params["category"] = category
    if q:
        sql += " and (d.title ilike :pat or d.act_name ilike :pat or d.description ilike :pat)"
        params["pat"] = f"%{q}%"
    sql += " order by d.act_name"
    rows = db.execute(text(sql), params).mappings().all()
    return [_summary_row(r) for r in rows]


@router.get("/search", response_model=list[LegalActSummary])
def search(q: str, user: CurrentUser, db: Session = Depends(get_db)) -> list[LegalActSummary]:
    """Search over approved documents AND their chunk text; returns act summaries."""
    rows = db.execute(
        text(
            _DOC_SELECT
            + "where d.status = 'approved' and exists ("
            "  select 1 from public.legal_document_chunks c"
            "  where c.document_id = d.id and (c.content ilike :pat or c.section_title ilike :pat))"
            " order by d.act_name limit 50"
        ),
        {"pat": f"%{q}%"},
    ).mappings().all()
    return [_summary_row(r) for r in rows]


@router.get("/acts/{act_id}", response_model=LegalActDetail)
def act_detail(act_id: str, user: CurrentUser, db: Session = Depends(get_db)) -> LegalActDetail:
    row = db.execute(
        text(
            _DOC_SELECT
            + ", s.title as source_title, s.source_url as source_url, s.version as source_version "
            "left join public.legal_sources s on s.id = d.source_id "
            "where d.id = :aid and d.status = 'approved'"
        ),
        {"aid": act_id},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Act not found or not approved")
    chunks = db.execute(
        text(
            "select id, act_name, section_number, section_title, content "
            "from public.legal_document_chunks where document_id = :aid "
            "order by section_number nulls last, chunk_index"
        ),
        {"aid": act_id},
    ).mappings().all()
    detail = LegalActDetail(
        **_summary_row(row).model_dump(),
        source_title=row.get("source_title"),
        source_url=row.get("source_url"),
        source_version=row.get("source_version"),
        provisions=[
            LegalProvision(
                chunk_id=str(c["id"]),
                act_name=c["act_name"],
                section_number=c["section_number"],
                section_title=c["section_title"],
                content=c["content"],
                plain_explanation=None,
            )
            for c in chunks
        ],
    )
    return detail
