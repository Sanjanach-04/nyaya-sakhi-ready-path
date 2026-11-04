"""Tests for refusal behaviour: threshold refusal, out-of-scope, citation
fabrication rejection."""
from __future__ import annotations

import pytest

from app.core.config import settings
from app.services import citation_validation, refusal_confidence
from app.services.citation_validation import CitationValidationError
from app.services.vector_search import RetrievedChunk


def chunk(chunk_id="c1", act="Protection of Women from Domestic Violence Act, 2005",
          section="3", content="Domestic violence definition text.", similarity=0.9):
    return RetrievedChunk(
        chunk_id=chunk_id, document_id="d1", act_name=act, section_number=section,
        section_title="Definition of domestic violence", content=content,
        document_title="Domestic violence (consolidated)", document_version="v1",
        is_demo=False, similarity=similarity,
    )


def test_exact_refusal_text_when_no_retrieval():
    assert refusal_confidence.refusal_for([], None) == (
        "I couldn't find sufficient verified information in my legal knowledge base to answer "
        "this question reliably. Please consult NALSA, your State Legal Services Authority or "
        "a qualified lawyer."
    )


def test_out_of_scope_message_for_low_similarity():
    chunks = [chunk(similarity=0.40)]
    msg = refusal_confidence.refusal_for(chunks, 0.40)
    assert "outside the verified scope" in msg


def test_threshold_refusal_via_retrieval_guard(monkeypatch):
    """A retrieval result below SCOPE_THRESHOLD yields no chunks → refusal."""
    from app.services import rag_retrieval

    calls = {}

    def fake_search(db, emb, threshold=None, match_count=None):
        calls["threshold"] = threshold
        return [chunk(similarity=0.30)]

    monkeypatch.setattr(rag_retrieval.vector_search, "search_similar_chunks", fake_search)
    monkeypatch.setattr(rag_retrieval.embedding, "embed_one", lambda q: [0.0] * 8)
    result = rag_retrieval.retrieve_for_question(None, "what is the weather")
    assert result.chunks == []
    assert result.best_similarity == 0.30


def test_fabricated_chunk_id_rejected():
    generated = {
        "explanation": "Some explanation.",
        "citations": [{"chunk_id": "NOT-IN-SET", "act": "Some Act", "section": "1"}],
    }
    with pytest.raises(CitationValidationError):
        citation_validation.validate_citations(generated, [chunk()])


def test_fabricated_act_rejected():
    generated = {
        "explanation": "Explanation.",
        "citations": [{"chunk_id": "c1", "act": "Motor Vehicles Act, 1988", "section": "3"}],
    }
    with pytest.raises(CitationValidationError):
        citation_validation.validate_citations(generated, [chunk()])


def test_fabricated_section_rejected():
    generated = {
        "explanation": "Explanation.",
        "citations": [{"chunk_id": "c1", "act": "Protection of Women from Domestic Violence Act, 2005", "section": "498"}],
    }
    with pytest.raises(CitationValidationError):
        citation_validation.validate_citations(generated, [chunk()])


def test_hallucinated_act_in_explanation_rejected():
    generated = {
        "explanation": "Under the Motor Vehicles Act, 1988 you may file a claim.",
        "citations": [{"chunk_id": "c1", "act": "Protection of Women from Domestic Violence Act, 2005", "section": "3"}],
    }
    with pytest.raises(CitationValidationError):
        citation_validation.validate_citations(generated, [chunk()])


def test_no_citations_rejected():
    generated = {"explanation": "Explanation.", "citations": []}
    with pytest.raises(CitationValidationError):
        citation_validation.validate_citations(generated, [chunk()])


def test_valid_citation_passes():
    generated = {
        "explanation": "Section 3 of the cited Act explains domestic violence.",
        "citations": [{"chunk_id": "c1", "act": "Protection of Women from Domestic Violence Act, 2005", "section": "3"}],
    }
    result = citation_validation.validate_citations(generated, [chunk()])
    assert len(result) == 1
    assert result[0].section == "3"
