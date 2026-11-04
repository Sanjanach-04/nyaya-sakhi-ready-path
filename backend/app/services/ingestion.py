"""Document ingestion pipeline: save file → extract → chunk → embed → store.

Never auto-approves: uploaded documents keep status='pending' until an admin
approves them. Records an ingestion_jobs row with status/counts/error.
Job statuses follow the DB check constraint:
pending | processing | completed | failed.
"""
from __future__ import annotations

import logging
import pathlib
import uuid
from datetime import datetime, timezone

from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import IngestionJob, LegalDocument, LegalDocumentChunk
from app.services import chunking as chunking_service
from app.services import embedding, text_extraction

logger = logging.getLogger(__name__)


def save_upload(data: bytes, original_name: str, document_id: str) -> str:
    """Persist the uploaded file under UPLOAD_DIR/<document_id>/<name>."""
    root = pathlib.Path(settings.UPLOAD_DIR) / document_id
    root.mkdir(parents=True, exist_ok=True)
    safe = pathlib.Path(original_name).name
    path = root / safe
    path.write_bytes(data)
    return str(path)


def _count_pages(data: bytes, file_type: str) -> int:
    if file_type == "pdf":
        try:
            from pypdf import PdfReader
            import io

            return len(PdfReader(io.BytesIO(data)).pages)
        except Exception:
            return 0
    return 0


def ingest_document(
    db: Session,
    document: LegalDocument,
    *,
    created_by: str | None = None,
    file_path: str | None = None,
) -> IngestionJob:
    """Extract → chunk → embed → store for an existing (pending) document.

    Raises ValueError on failure; a failed job row is recorded first.
    """
    job = IngestionJob(
        document_id=document.id,
        status="processing",
        created_by=uuid.UUID(created_by) if created_by else None,
    )
    db.add(job)
    db.commit()

    try:
        path = file_path or document.file_path
        if not path:
            raise ValueError("Document has no stored file to process")
        data = pathlib.Path(path).read_bytes()
        file_type = "pdf" if path.lower().endswith(".pdf") else "txt"
        raw_text = text_extraction.extract_text(data, file_type)
        if not raw_text.strip():
            raise ValueError("Document contains no extractable text")

        chunks = chunking_service.chunk_text(raw_text)
        if not chunks:
            raise ValueError("Chunking produced no chunks")

        vectors = embedding.embed_texts([c.content for c in chunks])

        # Replace any previous chunks (re-processing a document).
        db.execute(
            sql_text("delete from public.legal_document_chunks where document_id = :did"),
            {"did": str(document.id)},
        )
        for chunk, vector in zip(chunks, vectors, strict=True):
            db.add(
                LegalDocumentChunk(
                    document_id=document.id,
                    chunk_index=chunk.chunk_index,
                    section_number=chunk.section_number,
                    section_title=chunk.section_title,
                    content=chunk.content,
                    act_name=document.act_name,
                    language=document.language,
                    embedding=vector,
                    embedding_model=settings.EMBEDDING_MODEL,
                )
            )
        job.status = "completed"
        job.chunks_created = len(chunks)
        job.embeddings_created = len(vectors)
        job.pages_processed = _count_pages(data, file_type)
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        return job
    except Exception as exc:
        db.rollback()
        failed = IngestionJob(
            document_id=document.id,
            status="failed",
            error=str(exc)[:1000],
            created_by=uuid.UUID(created_by) if created_by else None,
            completed_at=datetime.now(timezone.utc),
        )
        db.add(failed)
        db.commit()
        raise


def next_version(current: str) -> str:
    """v1 -> v2 -> v3 ... (version is text in the schema)."""
    try:
        n = int(str(current).lstrip("vV"))
    except ValueError:
        n = 1
    return f"v{n + 1}"


def replace_version(
    db: Session,
    document: LegalDocument,
    *,
    new_file_path: str,
    title: str | None = None,
    source_url: str | None = None,
) -> LegalDocument:
    """Record the old version in history, then bump to a new pending version."""
    db.add(
        LegalDocumentVersion(
            document_id=document.id,
            version=document.version,
            source_url=source_url,
            notes=f"Replaced by {next_version(document.version)}",
        )
    )
    document.version = next_version(document.version)
    document.status = "pending"  # new version must be re-verified before approval
    document.file_path = new_file_path
    if title:
        document.title = title
    db.commit()
    return document
