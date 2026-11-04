"""Guest (signed-out) access: public endpoints open, private ones closed,
guest chat runs the full RAG guards but stores nothing, rate limit triggers."""
from __future__ import annotations

import time

import pytest
from fastapi.security import HTTPAuthorizationCredentials

from app.core import security
from app.core.rate_limit import SlidingWindowLimiter, guest_chat_limiter
from app.services import refusal_confidence
from app.services.vector_search import RetrievedChunk

from .test_ownership_and_admin import RECORDED, RecordingDB  # noqa: F401

EXACT_REFUSAL = (
    "I couldn't find sufficient verified information in my legal knowledge base to answer "
    "this question reliably. Please consult NALSA, your State Legal Services Authority or "
    "a qualified lawyer."
)


def _chunk():
    return RetrievedChunk(
        chunk_id="c1", document_id="d1",
        act_name="Protection of Women from Domestic Violence Act, 2005", section_number="3",
        section_title="Definition", content="Approved text.", document_title="DV Act",
        document_version="v1", is_demo=False, similarity=0.9,
    )


@pytest.fixture
def recorded(app):
    """Point every DB dependency at a recorder and return the SQL log."""
    import app.db as db_mod
    from app.api.routes import admin, auth, chat, complaints, legal, misc, schemes

    def override_db():
        yield RecordingDB()

    for dep in (db_mod.get_db, db_mod.get_public_db, db_mod.get_admin_db):
        app.dependency_overrides[dep] = override_db
    for mod in (admin, auth, chat, complaints, legal, misc, schemes):
        for name in ("get_db", "get_public_db", "get_admin_db"):
            if hasattr(mod, name):
                app.dependency_overrides[getattr(mod, name)] = override_db
    RECORDED.clear()
    yield RECORDED
    RECORDED.clear()


def _writes(log):
    return [sql for sql, _ in log if sql.strip().lower().startswith(("insert", "update", "delete"))]


# ---------------------------------------------------------------- dependency


def test_optional_user_is_none_without_token():
    assert security.get_optional_user(None) is None


def test_optional_user_is_none_for_forged_token(monkeypatch):
    from jose import jwt

    monkeypatch.setattr(security.settings, "SUPABASE_JWT_SECRET", "real-secret")
    forged = jwt.encode({"sub": "x", "exp": int(time.time()) + 600}, "wrong", algorithm="HS256")
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=forged)
    assert security.get_optional_user(creds) is None


def test_optional_user_returns_user_for_valid_token(monkeypatch):
    from jose import jwt

    monkeypatch.setattr(security.settings, "SUPABASE_JWT_SECRET", "real-secret")
    good = jwt.encode({"sub": "user-1", "email": "a@b.c", "exp": int(time.time()) + 600},
                      "real-secret", algorithm="HS256")
    user = security.get_optional_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=good))
    assert user is not None and user.id == "user-1"


def test_public_db_runs_guests_as_anon_role(monkeypatch):
    import app.db as db_mod

    class Capture(RecordingDB):
        pass

    RECORDED.clear()
    monkeypatch.setattr(db_mod, "SessionLocal", lambda: Capture())
    gen = db_mod.get_public_db(None)
    next(gen)
    sql, params = RECORDED[0]
    assert "set_config('role', 'anon', true)" in sql
    assert '"role": "anon"' in params["claims"]
    RECORDED.clear()


# ---------------------------------------------------------------- endpoints


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("get", "/api/legal/acts", None),
        ("get", "/api/legal/acts/00000000-0000-0000-0000-000000000001", None),
        ("get", "/api/legal/search?q=dowry", None),
        ("get", "/api/schemes", None),
        ("get", "/api/legal-aid", None),
        ("get", "/api/emergency", None),
        ("get", "/api/complaints/templates", None),
        ("post", "/api/schemes/recommend", {"state": "Karnataka"}),
    ],
)
def test_public_endpoints_work_without_token(app, recorded, method, path, body):
    from fastapi.testclient import TestClient

    client = TestClient(app, raise_server_exceptions=False)
    res = getattr(client, method)(path, json=body) if body is not None else getattr(client, method)(path)
    assert res.status_code == 200, (path, res.status_code, res.text)


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/chat/history"),
        ("get", "/api/saved"),
        ("post", "/api/saved"),
        ("get", "/api/complaints"),
        ("post", "/api/complaints"),
        ("get", "/api/auth/profile"),
        ("put", "/api/auth/profile"),
        ("get", "/api/admin/stats"),
        ("get", "/api/admin/documents"),
    ],
)
def test_private_endpoints_reject_missing_token(app, method, path):
    from fastapi.testclient import TestClient

    client = TestClient(app, raise_server_exceptions=False)
    res = getattr(client, method)(path, json={}) if method in ("post", "put") else getattr(client, method)(path)
    assert res.status_code == 401, (path, res.status_code)


def test_guest_scheme_recommendation_is_not_stored(app, recorded):
    from fastapi.testclient import TestClient

    res = TestClient(app).post("/api/schemes/recommend", json={"state": "Karnataka"})
    assert res.status_code == 200
    assert not any("scheme_eligibility_responses" in s for s in _writes(recorded))


def test_guest_draft_generation_is_not_stored(app, recorded):
    from fastapi.testclient import TestClient

    res = TestClient(app).post(
        "/api/complaints/generate",
        json={"document_type": "rti_application", "fields": {}, "language": "en"},
    )
    # 200 or 422 (missing required fields) — either way nothing is written.
    assert res.status_code in (200, 422)
    assert _writes(recorded) == []


# ---------------------------------------------------------------- guest chat


def test_guest_chat_refuses_exactly_and_stores_nothing(app, recorded, monkeypatch):
    from fastapi.testclient import TestClient

    from app.api.routes import chat as chat_mod
    from app.services.rag_retrieval import RetrievalResult

    monkeypatch.setattr(chat_mod.rag_retrieval, "retrieve_for_question",
                        lambda db, q: RetrievalResult(chunks=[], best_similarity=None))
    res = TestClient(app).post("/api/chat/ask", json={"question": "What are my rights?"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["refused"] is True
    assert body["explanation"] == EXACT_REFUSAL
    assert body["session_id"] is None and body["message_id"] is None
    assert _writes(recorded) == []


def test_guest_chat_rejects_fabricated_citation(app, recorded, monkeypatch):
    from fastapi.testclient import TestClient

    from app.api.routes import chat as chat_mod
    from app.services.rag_retrieval import RetrievalResult

    monkeypatch.setattr(chat_mod.rag_retrieval, "retrieve_for_question",
                        lambda db, q: RetrievalResult(chunks=[_chunk()], best_similarity=0.9))
    monkeypatch.setattr(chat_mod.llm_generation, "generate_answer", lambda q, chunks: {
        "explanation": "Made up.",
        "citations": [{"chunk_id": "NOT-RETRIEVED", "act": "Invented Act", "section": "99"}],
    })
    res = TestClient(app).post("/api/chat/ask", json={"question": "What is dowry harassment?"})
    assert res.status_code == 200
    body = res.json()
    assert body["refused"] is True
    assert body["refusal_reason"] == "citation_validation_failed"
    assert body["explanation"] == refusal_confidence.REFUSAL_VALIDATION
    assert body["citations"] == []
    assert _writes(recorded) == []


def test_guest_chat_ignores_session_id(app, recorded, monkeypatch):
    """A guest cannot read or append to a stored conversation by passing its id."""
    from fastapi.testclient import TestClient

    from app.api.routes import chat as chat_mod
    from app.services.rag_retrieval import RetrievalResult

    monkeypatch.setattr(chat_mod.rag_retrieval, "retrieve_for_question",
                        lambda db, q: RetrievalResult(chunks=[], best_similarity=None))
    res = TestClient(app).post(
        "/api/chat/ask",
        json={"question": "What are my rights?", "session_id": "00000000-0000-0000-0000-00000000beef"},
    )
    assert res.status_code == 200
    assert res.json()["session_id"] is None
    assert not any("chat_sessions" in sql for sql, _ in recorded)


def test_signed_in_chat_is_persisted_for_owner(user_a_client, recorded, monkeypatch):
    from app.api.routes import chat as chat_mod
    from app.services.rag_retrieval import RetrievalResult

    from .conftest import USER_A

    monkeypatch.setattr(chat_mod.rag_retrieval, "retrieve_for_question",
                        lambda db, q: RetrievalResult(chunks=[], best_similarity=None))
    res = user_a_client.post("/api/chat/ask", json={"question": "What are my rights?"})
    assert res.status_code == 200
    assert res.json()["session_id"]
    inserts = [(s, p) for s, p in recorded if s.strip().lower().startswith("insert")]
    assert any("chat_sessions" in s and p.get("uid") == USER_A for s, p in inserts)
    assert any("chat_messages" in s and p.get("uid") == USER_A for s, p in inserts)


def test_guest_chat_rate_limit_triggers(app, recorded, monkeypatch):
    from fastapi.testclient import TestClient

    from app.api.routes import chat as chat_mod
    from app.services.rag_retrieval import RetrievalResult

    monkeypatch.setattr(guest_chat_limiter, "limit", 3)
    monkeypatch.setattr(chat_mod.rag_retrieval, "retrieve_for_question",
                        lambda db, q: RetrievalResult(chunks=[], best_similarity=None))
    client = TestClient(app)
    codes = [client.post("/api/chat/ask", json={"question": "What are my rights?"}).status_code
             for _ in range(4)]
    assert codes == [200, 200, 200, 429]
    last = client.post("/api/chat/ask", json={"question": "What are my rights?"})
    assert last.status_code == 429
    assert int(last.headers["Retry-After"]) > 0


def test_default_guest_limit_is_20_per_hour():
    assert guest_chat_limiter.limit == 20
    assert guest_chat_limiter.window == 3600


def test_limiter_window_slides():
    lim = SlidingWindowLimiter(2, 60)
    assert lim.hit("ip", now=0)[0]
    assert lim.hit("ip", now=1)[0]
    assert lim.hit("ip", now=2) == (False, 59)
    assert lim.hit("other-ip", now=2)[0]
    assert lim.hit("ip", now=61)[0]  # first hit expired
