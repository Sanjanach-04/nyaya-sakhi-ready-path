"""Embedding service. Sentence-transformers, lazy singleton, configurable
model and dimension (see backend/.env.example: EMBEDDING_MODEL / EMBEDDING_DIM).

Default: sentence-transformers/paraphrase-multilingual-mpnet-base-v2 (768-dim,
multilingual EN/HI/KN). All stored vectors must use the same model — if you
change EMBEDDING_MODEL, re-embed every document.
"""
from __future__ import annotations

import threading

import numpy as np

from app.core.config import settings

_lock = threading.Lock()
_model_instance = None


def _get_model():
    """Lazy-load the model on first use (heavy import kept out of tests)."""
    global _model_instance
    if _model_instance is None:
        from sentence_transformers import SentenceTransformer

        _model_instance = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _model_instance


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Must match the model used for stored chunks."""
    if not texts:
        return []
    with _lock:
        vectors = _get_model().encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
    return [np.asarray(v, dtype=float).tolist() for v in vectors]


def embed_one(text: str) -> list[float]:
    return embed_texts([text])[0]
