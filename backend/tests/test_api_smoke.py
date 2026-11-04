"""API smoke tests: health endpoint, error schema, auth gating."""
from __future__ import annotations


def test_health(app):
    from fastapi.testclient import TestClient

    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_api_health_shape_without_auth(app, monkeypatch):
    from fastapi.testclient import TestClient
    from app.core.config import settings

    monkeypatch.setattr(settings, "DATABASE_URL", "")
    client = TestClient(app)
    res = client.get("/api/health")  # no Authorization header
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["db"] is False  # no DATABASE_URL -> not ready
    assert set(body) == {"status", "db", "embedding_model", "llm_configured"}
    assert all(isinstance(body[k], bool) for k in ("db", "embedding_model", "llm_configured"))


def test_error_schema_is_consistent(app):
    from fastapi.testclient import TestClient

    client = TestClient(app, raise_server_exceptions=False)
    # Auth runs before body validation: a missing token is always a clean 401
    # with the consistent {"detail": ...} error schema.
    res = client.post("/api/chat/ask", json={"question": "x"})
    assert res.status_code == 401
    body = res.json()
    assert "detail" in body


def test_profile_requires_token(anon_client):
    res = anon_client.get("/api/auth/profile")
    assert res.status_code in (401, 403)
