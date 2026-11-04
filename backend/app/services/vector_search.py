"""Vector search over approved legal chunks, calling the SQL function
match_legal_chunks (pgvector, HNSW, cosine distance)."""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings


@dataclass
class RetrievedChunk:
    chunk_id: str
    document_id: str
    act_name: str
    section_number: str | None
    section_title: str | None
    content: str
    document_title: str | None
    document_version: str | None
    is_demo: bool
    similarity: float


def search_similar_chunks(
    db: Session,
    query_embedding: list[float],
    similarity_threshold: float | None = None,
    match_count: int | None = None,
) -> list[RetrievedChunk]:
    """Search ONLY chunks of documents with status='approved'.

    The SQL function enforces the approved filter; the threshold and count
    are parameters so callers (and tests) can vary them.
    """
    threshold = settings.SIMILARITY_THRESHOLD if similarity_threshold is None else similarity_threshold
    count = settings.MATCH_COUNT if match_count is None else match_count
    rows = db.execute(
        text(
            """
            select *
            from match_legal_chunks(cast(:embedding as vector), :count, :threshold)
            """
        ),
        {"embedding": query_embedding, "threshold": threshold, "count": count},
    ).mappings()
    return [
        RetrievedChunk(
            chunk_id=str(r["chunk_id"]),
            document_id=str(r["document_id"]),
            act_name=r["act_name"],
            section_number=r.get("section_number"),
            section_title=r.get("section_title"),
            content=r["content"],
            document_title=r.get("document_title"),
            document_version=r.get("document_version"),
            is_demo=bool(r.get("is_demo") or False),
            similarity=float(r.get("similarity") or 0.0),
        )
        for r in rows
    ]
