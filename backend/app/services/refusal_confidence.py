"""Refusal & confidence handling. The exact refusal text is fixed by spec."""
from __future__ import annotations

from app.core.config import settings
from app.services.vector_search import RetrievedChunk

REFUSAL_NO_RETRIEVAL = (
    "I couldn't find sufficient verified information in my legal knowledge base to answer "
    "this question reliably. Please consult NALSA, your State Legal Services Authority or "
    "a qualified lawyer."
)

REFUSAL_OUT_OF_SCOPE = (
    "This question appears to be outside the verified scope of my legal knowledge base, "
    "so I cannot answer it reliably. Please consult NALSA, your State Legal Services "
    "Authority or a qualified lawyer."
)

REFUSAL_VALIDATION = REFUSAL_NO_RETRIEVAL

DISCLAIMER = "This answer is for legal literacy, not professional legal advice."


def refusal_for(chunks: list[RetrievedChunk], best_similarity: float | None) -> str:
    if best_similarity is not None and best_similarity < settings.SCOPE_THRESHOLD:
        return REFUSAL_OUT_OF_SCOPE
    if not chunks:
        return REFUSAL_NO_RETRIEVAL
    return REFUSAL_NO_RETRIEVAL
