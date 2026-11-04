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
    res = client.get("/api/chat/history")
    assert res.status_code == 401
    body = res.json()
    assert "detail" in body


def test_profile_requires_token(anon_client):
    res = anon_client.get("/api/auth/profile")
    assert res.status_code in (401, 403)


def test_forged_and_malformed_tokens_are_401_not_500(app, monkeypatch):
    import time

    from fastapi.testclient import TestClient
    from jose import jwt

    from app.core.config import settings

    monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", "real-secret-for-test")
    client = TestClient(app, raise_server_exceptions=False)
    forged = jwt.encode({"sub": "x", "exp": int(time.time()) + 600}, "wrong-secret", algorithm="HS256")
    for token in (forged, "not-a-jwt"):
        res = client.get("/api/chat/history", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 401, (token, res.status_code)


def test_missing_token_rejected_on_data_endpoints(app):
    from fastapi.testclient import TestClient

    client = TestClient(app, raise_server_exceptions=False)
    for path in ("/api/chat/history", "/api/saved", "/api/complaints", "/api/auth/profile", "/api/admin/stats"):
        assert client.get(path).status_code == 401, path
