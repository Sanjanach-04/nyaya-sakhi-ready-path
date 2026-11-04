"""Admin routes. Every handler is admin-gated via require_admin."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import AdminUser
from app.db import get_admin_db
from app.schemas import (
    AdminDocumentOut,
    AdminEmergencyIn,
    AdminLegalAidIn,
    AdminSchemeIn,
    EmergencyContactOut,
    IngestionJobOut,
    LegalAidAuthorityOut,
    SchemeOut,
    UsageStats,
)
from app.services import ingestion as ingestion_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


# --- Documents --------------------------------------------------------------

_DOC_SELECT = (
    "select d.*, (select count(*) from public.legal_document_chunks c where c.document_id = d.id) as chunk_count "
    "from public.legal_documents d "
)


def _doc_row(db: Session, doc_id: str) -> dict | None:
    row = db.execute(
        text(_DOC_SELECT + "where d.id = :id"), {"id": doc_id}
    ).mappings().first()
    return dict(row) if row else None


def _doc_out(r: dict) -> AdminDocumentOut:
    return AdminDocumentOut(
        id=str(r["id"]),
        title=r["title"],
        act_name=r["act_name"],
        category=r["category"],
        description=r.get("description"),
        summary=r.get("summary"),
        status=r["status"],  # type: ignore[arg-type]
        version=r["version"],
        language=r["language"],
        file_path=r.get("file_path"),
        is_demo=bool(r.get("is_demo")),
        chunk_count=int(r.get("chunk_count") or 0),
        created_at=r["created_at"],
        updated_at=r.get("updated_at"),
    )


def _scheme_out(db: Session, scheme_id: str) -> SchemeOut:
    from app.models import GovernmentScheme
    from app.services import eligibility as eligibility_service

    row = db.execute(
        text("select * from public.government_schemes where id = :id"), {"id": scheme_id}
    ).mappings().one()
    return eligibility_service.to_out(GovernmentScheme(**dict(row)))


def _emergency_out(r) -> EmergencyContactOut:
    return EmergencyContactOut(
        id=str(r["id"]),
        name=r["name"],
        purpose=r["purpose"],
        phone_number=r["phone_number"],
        availability=r.get("availability"),
        category=r["category"],
        is_demo=bool(r["is_demo"]),
        source_reference=r["source_reference"],
        display_order=int(r.get("display_order") or 0),
    )


def _legal_aid_out(r) -> LegalAidAuthorityOut:
    return LegalAidAuthorityOut(
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


@router.get("/documents", response_model=list[AdminDocumentOut])
def list_documents(admin: AdminUser, db: Session = Depends(get_admin_db)) -> list[AdminDocumentOut]:
    rows = db.execute(
        text(_DOC_SELECT + "order by d.created_at desc limit 200")
    ).mappings().all()
    return [_doc_out(dict(r)) for r in rows]


@router.post("/documents/upload", response_model=AdminDocumentOut)
async def upload_document(
    admin: AdminUser,
    db: Session = Depends(get_admin_db),
    file: UploadFile = File(...),
    title: str = Form(...),
    act_name: str = Form(...),
    category: str = Form(default="general"),
    description: str | None = Form(default=None),
    summary: str | None = Form(default=None),
    language: str = Form(default="en"),
) -> AdminDocumentOut:
    """Upload stays status='pending'. NEVER auto-verified."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=422, detail="Empty file")
    file_type = "pdf" if (file.filename or "").lower().endswith(".pdf") else "txt"

    doc_id = uuid.uuid4()
    file_path = ingestion_service.save_upload(data, file.filename or "upload.txt", str(doc_id))
    db.execute(
        text(
            "insert into public.legal_documents "
            "(id, title, act_name, category, description, summary, status, version, language, file_path, uploaded_by) "
            "values (:id, :title, :act_name, :category, :description, :summary, 'pending', 'v1', :language, :file_path, :uploaded_by)"
        ),
        {
            "id": str(doc_id), "title": title, "act_name": act_name, "category": category,
            "description": description, "summary": summary, "language": language,
            "file_path": file_path, "uploaded_by": admin.id,
        },
    )
    db.commit()
    return _doc_out(_doc_row(db, str(doc_id)))  # type: ignore[arg-type]


@router.post("/documents/{document_id}/process", response_model=IngestionJobOut)
def process_document(
    document_id: str,
    admin: AdminUser,
    db: Session = Depends(get_admin_db),
) -> IngestionJobOut:
    """Extract → chunk → embed → store. Records an ingestion_jobs row."""
    from app.models import LegalDocument

    row = _doc_row(db, document_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    if row["status"] == "approved":
        raise HTTPException(
            status_code=409,
            detail="Approved documents are immutable; upload a new version instead",
        )
    document = LegalDocument(**{k: v for k, v in row.items() if k != "chunk_count"})
    try:
        job = ingestion_service.ingest_document(db, document, created_by=admin.id)
    except Exception as exc:  # job row already recorded as failed
        raise HTTPException(status_code=422, detail=f"Ingestion failed: {exc}")
    return IngestionJobOut(
        id=str(job.id),
        document_id=str(job.document_id) if job.document_id else None,
        status=job.status,  # type: ignore[arg-type]
        error=job.error,
        chunks_created=job.chunks_created,
        embeddings_created=job.embeddings_created,
        pages_processed=job.pages_processed,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )


@router.post("/documents/{document_id}/approve", response_model=AdminDocumentOut)
def approve_document(
    document_id: str, admin: AdminUser, db: Session = Depends(get_admin_db)
) -> AdminDocumentOut:
    row = _doc_row(db, document_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    if int(row.get("chunk_count") or 0) == 0:
        raise HTTPException(status_code=409, detail="Process & embed the document before approving")
    db.execute(
        text("update public.legal_documents set status = 'approved' where id = :id"),
        {"id": document_id},
    )
    db.commit()
    return _doc_out(_doc_row(db, document_id))  # type: ignore[arg-type]


@router.post("/documents/{document_id}/reject", response_model=AdminDocumentOut)
def reject_document(
    document_id: str, admin: AdminUser, db: Session = Depends(get_admin_db)
) -> AdminDocumentOut:
    result = db.execute(
        text("update public.legal_documents set status = 'rejected' where id = :id"),
        {"id": document_id},
    )
    db.commit()
    if (result.rowcount or 0) == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return _doc_out(_doc_row(db, document_id))  # type: ignore[arg-type]


@router.post("/documents/{document_id}/replace-version", response_model=AdminDocumentOut)
async def replace_version(
    document_id: str,
    admin: AdminUser,
    db: Session = Depends(get_admin_db),
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
) -> AdminDocumentOut:
    """Upload a new version, keeping the old one in history (legal_document_versions)."""
    row = _doc_row(db, document_id)
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=422, detail="Empty file")
    file_type = "pdf" if (file.filename or "").lower().endswith(".pdf") else "txt"
    new_path = ingestion_service.save_upload(data, file.filename or "upload.txt", document_id)

    from app.models import LegalDocument

    document = LegalDocument(**{k: v for k, v in row.items() if k != "chunk_count"})
    ingestion_service.replace_version(db, document, new_file_path=new_path, title=title)
    return _doc_out(_doc_row(db, document_id))  # type: ignore[arg-type]


@router.get("/jobs", response_model=list[IngestionJobOut])
def list_jobs(admin: AdminUser, db: Session = Depends(get_admin_db)) -> list[IngestionJobOut]:
    rows = db.execute(
        text("select * from public.ingestion_jobs order by created_at desc limit 100")
    ).mappings().all()
    return [
        IngestionJobOut(
            id=str(r["id"]),
            document_id=str(r["document_id"]) if r.get("document_id") else None,
            status=r["status"],  # type: ignore[arg-type]
            error=r.get("error"),
            chunks_created=int(r.get("chunks_created") or 0),
            embeddings_created=int(r.get("embeddings_created") or 0),
            pages_processed=int(r.get("pages_processed") or 0),
            created_at=r["created_at"],
            completed_at=r.get("completed_at"),
        )
        for r in rows
    ]


# --- Schemes ----------------------------------------------------------------

@router.post("/schemes", response_model=SchemeOut)
def create_scheme(
    payload: AdminSchemeIn, admin: AdminUser, db: Session = Depends(get_admin_db)
) -> SchemeOut:
    import json

    scheme_id = str(uuid.uuid4())
    db.execute(
        text(
            "insert into public.government_schemes "
            "(id, name, description, department, level, state_name, category, beneficiaries, eligibility, "
            "benefits, required_documents, application_process, official_url, source_reference, is_demo) "
            "values (:id, :name, :description, :department, :level, :state_name, :category, :beneficiaries, "
            "cast(:eligibility as jsonb), :benefits, :required_documents, :application_process, "
            ":official_url, :source_reference, :is_demo)"
        ),
        {
            "id": scheme_id, "name": payload.name, "description": payload.description,
            "department": payload.department, "level": payload.level,
            "state_name": payload.state_name, "category": payload.category,
            "beneficiaries": payload.beneficiaries,
            "eligibility": json.dumps([r.model_dump(exclude_none=True) for r in (payload.eligibility or [])]),
            "benefits": payload.benefits, "required_documents": payload.required_documents,
            "application_process": payload.application_process,
            "official_url": payload.official_url,
            "source_reference": payload.source_reference, "is_demo": payload.is_demo,
        },
    )
    db.commit()
    return _scheme_out(db, scheme_id)


@router.put("/schemes/{scheme_id}", response_model=SchemeOut)
def update_scheme(
    scheme_id: str, payload: AdminSchemeIn, admin: AdminUser, db: Session = Depends(get_admin_db)
) -> SchemeOut:
    import json

    result = db.execute(
        text(
            "update public.government_schemes set name = :name, description = :description, "
            "department = :department, level = :level, state_name = :state_name, category = :category, "
            "beneficiaries = :beneficiaries, eligibility = cast(:eligibility as jsonb), benefits = :benefits, "
            "required_documents = :required_documents, application_process = :application_process, "
            "official_url = :official_url, source_reference = :source_reference, is_demo = :is_demo, "
            "updated_at = now() where id = :id"
        ),
        {
            "id": scheme_id, "name": payload.name, "description": payload.description,
            "department": payload.department, "level": payload.level,
            "state_name": payload.state_name, "category": payload.category,
            "beneficiaries": payload.beneficiaries,
            "eligibility": json.dumps([r.model_dump(exclude_none=True) for r in (payload.eligibility or [])]),
            "benefits": payload.benefits, "required_documents": payload.required_documents,
            "application_process": payload.application_process,
            "official_url": payload.official_url,
            "source_reference": payload.source_reference, "is_demo": payload.is_demo,
        },
    )
    db.commit()
    if (result.rowcount or 0) == 0:
        raise HTTPException(status_code=404, detail="Scheme not found")
    return _scheme_out(db, scheme_id)


@router.post("/schemes/{scheme_id}/verify", response_model=SchemeOut)
def verify_scheme(
    scheme_id: str, admin: AdminUser, db: Session = Depends(get_admin_db)
) -> SchemeOut:
    result = db.execute(
        text(
            "update public.government_schemes set last_verified_date = current_date "
            "where id = :id"
        ),
        {"id": scheme_id},
    )
    db.commit()
    if (result.rowcount or 0) == 0:
        raise HTTPException(status_code=404, detail="Scheme not found")
    return _scheme_out(db, scheme_id)


@router.delete("/schemes/{scheme_id}")
def delete_scheme(scheme_id: str, admin: AdminUser, db: Session = Depends(get_admin_db)) -> dict:
    result = db.execute(
        text("delete from public.government_schemes where id = :id"), {"id": scheme_id}
    )
    db.commit()
    if (result.rowcount or 0) == 0:
        raise HTTPException(status_code=404, detail="Scheme not found")
    return {"deleted": True}


# --- Emergency --------------------------------------------------------------

@router.post("/emergency", response_model=EmergencyContactOut)
def create_emergency(
    payload: AdminEmergencyIn, admin: AdminUser, db: Session = Depends(get_admin_db)
) -> EmergencyContactOut:
    contact_id = str(uuid.uuid4())
    db.execute(
        text(
            "insert into public.emergency_contacts "
            "(id, name, purpose, phone_number, availability, category, source_reference, is_demo, display_order) "
            "values (:id, :name, :purpose, :phone_number, :availability, :category, :source_reference, :is_demo, :display_order)"
        ),
        {
            "id": contact_id, "name": payload.name, "purpose": payload.purpose,
            "phone_number": payload.phone_number, "availability": payload.availability,
            "category": payload.category, "source_reference": payload.source_reference,
            "is_demo": payload.is_demo, "display_order": payload.display_order,
        },
    )
    db.commit()
    row = db.execute(
        text("select * from public.emergency_contacts where id = :id"), {"id": contact_id}
    ).mappings().one()
    return _emergency_out(row)


@router.put("/emergency/{contact_id}", response_model=EmergencyContactOut)
def update_emergency(
    contact_id: str, payload: AdminEmergencyIn, admin: AdminUser, db: Session = Depends(get_admin_db)
) -> EmergencyContactOut:
    result = db.execute(
        text(
            "update public.emergency_contacts set name = :name, purpose = :purpose, "
            "phone_number = :phone_number, availability = :availability, category = :category, "
            "source_reference = :source_reference, is_demo = :is_demo, display_order = :display_order, "
            "updated_at = now() where id = :id"
        ),
        {
            "id": contact_id, "name": payload.name, "purpose": payload.purpose,
            "phone_number": payload.phone_number, "availability": payload.availability,
            "category": payload.category, "source_reference": payload.source_reference,
            "is_demo": payload.is_demo, "display_order": payload.display_order,
        },
    )
    db.commit()
    if (result.rowcount or 0) == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    row = db.execute(
        text("select * from public.emergency_contacts where id = :id"), {"id": contact_id}
    ).mappings().one()
    return _emergency_out(row)


@router.delete("/emergency/{contact_id}")
def delete_emergency(
    contact_id: str, admin: AdminUser, db: Session = Depends(get_admin_db)
) -> dict:
    result = db.execute(
        text("delete from public.emergency_contacts where id = :id"), {"id": contact_id}
    )
    db.commit()
    if (result.rowcount or 0) == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"deleted": True}


# --- Legal aid --------------------------------------------------------------

@router.post("/legal-aid", response_model=LegalAidAuthorityOut)
def create_legal_aid(
    payload: AdminLegalAidIn, admin: AdminUser, db: Session = Depends(get_admin_db)
) -> LegalAidAuthorityOut:
    authority_id = str(uuid.uuid4())
    db.execute(
        text(
            "insert into public.legal_aid_authorities "
            "(id, name, level, state, district, address, phone, website, source_reference, last_verified_date, is_demo, display_order) "
            "values (:id, :name, :level, :state, :district, :address, :phone, :website, :source_reference, current_date, :is_demo, :display_order)"
        ),
        {
            "id": authority_id, "name": payload.name, "level": payload.level,
            "state": payload.state, "district": payload.district, "address": payload.address,
            "phone": payload.phone, "website": payload.website,
            "source_reference": payload.source_reference,
            "is_demo": payload.is_demo, "display_order": payload.display_order,
        },
    )
    db.commit()
    row = db.execute(
        text("select * from public.legal_aid_authorities where id = :id"), {"id": authority_id}
    ).mappings().one()
    return _legal_aid_out(row)


@router.put("/legal-aid/{authority_id}", response_model=LegalAidAuthorityOut)
def update_legal_aid(
    authority_id: str, payload: AdminLegalAidIn, admin: AdminUser, db: Session = Depends(get_admin_db)
) -> LegalAidAuthorityOut:
    result = db.execute(
        text(
            "update public.legal_aid_authorities set name = :name, level = :level, state = :state, "
            "district = :district, address = :address, phone = :phone, website = :website, "
            "source_reference = :source_reference, last_verified_date = current_date, "
            "is_demo = :is_demo, display_order = :display_order, updated_at = now() where id = :id"
        ),
        {
            "id": authority_id, "name": payload.name, "level": payload.level,
            "state": payload.state, "district": payload.district, "address": payload.address,
            "phone": payload.phone, "website": payload.website,
            "source_reference": payload.source_reference,
            "is_demo": payload.is_demo, "display_order": payload.display_order,
        },
    )
    db.commit()
    if (result.rowcount or 0) == 0:
        raise HTTPException(status_code=404, detail="Authority not found")
    row = db.execute(
        text("select * from public.legal_aid_authorities where id = :id"), {"id": authority_id}
    ).mappings().one()
    return _legal_aid_out(row)


@router.delete("/legal-aid/{authority_id}")
def delete_legal_aid(
    authority_id: str, admin: AdminUser, db: Session = Depends(get_admin_db)
) -> dict:
    result = db.execute(
        text("delete from public.legal_aid_authorities where id = :id"), {"id": authority_id}
    )
    db.commit()
    if (result.rowcount or 0) == 0:
        raise HTTPException(status_code=404, detail="Authority not found")
    return {"deleted": True}


# --- Stats ------------------------------------------------------------------

@router.get("/stats", response_model=UsageStats)
def stats(admin: AdminUser, db: Session = Depends(get_admin_db)) -> UsageStats:
    def count(sql: str) -> int:
        return int(db.execute(text(sql)).scalar() or 0)

    return UsageStats(
        users=count("select count(*) from public.profiles"),
        chat_sessions=count("select count(*) from public.chat_sessions"),
        chat_messages=count("select count(*) from public.chat_messages"),
        drafts=count("select count(*) from public.complaint_drafts"),
        refusals=count("select count(*) from public.chat_messages where refused = true"),
        questions=count("select count(*) from public.chat_messages where role = 'user'"),
        approved_documents=count("select count(*) from public.legal_documents where status = 'approved'"),
        pending_documents=count("select count(*) from public.legal_documents where status = 'pending'"),
        schemes=count("select count(*) from public.government_schemes"),
    )
