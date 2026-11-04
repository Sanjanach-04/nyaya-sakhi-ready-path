"""RAG retrieval: embed the question, search approved chunks, apply thresholds."""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import settings
from app.services import embedding, vector_search
from app.services.vector_search import RetrievedChunk


@dataclass
class RetrievalResult:
    chunks: list[RetrievedChunk]
    best_similarity: float | None


def retrieve_for_question(db: Session, question: str) -> RetrievalResult:
    query_embedding = embedding.embed_one(question)
    chunks = vector_search.search_similar_chunks(db, query_embedding)
    best = max((c.similarity for c in chunks), default=None)
    # Out-of-scope guard: below the scope threshold even the best hit is
    # treated as "outside verified scope" rather than answerable.
    if best is not None and best < settings.SCOPE_THRESHOLD:
        return RetrievalResult(chunks=[], best_similarity=best)
    return RetrievalResult(chunks=chunks, best_similarity=best)
