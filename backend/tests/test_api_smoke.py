"""API smoke tests: health endpoint, error schema, auth gating."""
from __future__ import annotations


def test_health(app):
    from fastapi.testclient import TestClient

    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


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
