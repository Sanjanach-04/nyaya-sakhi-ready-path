"""Tests for ownership enforcement and admin gating at the route level."""
from __future__ import annotations

import re

import pytest

from app.db import get_db as user_get_db
from app.main import app

RECORDED: list[tuple[str, dict]] = []


class RecordingDB:
    """Captures the SQL every query runs so tests can assert ownership filters."""

    def execute(self, statement, params=None):
        RECORDED.append((str(statement), dict(params or {})))

        class _Result:
            rowcount = 1

            def scalar(self):
                return "00000000-0000-0000-0000-000000000001"

            def scalar_one(self):
                return "00000000-0000-0000-0000-000000000001"

            def mappings(self):
                class _M:
                    def first(self_inner):
                        return {"id": "x", "title": "t", "act_name": "a", "category": "c",
                                "description": None, "summary": None, "version": "v1",
                                "language": "en", "is_demo": False, "created_at": None,
                                "updated_at": None, "status": "approved", "file_path": None,
                                "display_name": "n", "preferred_language": "en", "role": "user",
                                "content": "c", "citations": "[]", "refused": False,
                                "session_id": "s", "purpose": "p", "phone_number": "1",
                                "availability": None, "source_reference": "s", "display_order": 0,
                                "level": "national", "state": None, "district": None,
                                "address": None, "phone": None, "website": None,
                                "last_verified_date": None, "department": "d", "name": "n"}

                    def all(self_inner):
                        return []

                    def one(self_inner):
                        return self_inner.first()

                return _M()

        return _Result()

    def commit(self):
        pass

    def rollback(self):
        pass

    def add(self, obj):
        pass

    def close(self):
        pass


@pytest.fixture
def recording_overrides(app):
    def override_db():
        yield RecordingDB()

    # Override the user-session dependency wherever it is imported.
    from app.api.routes import chat as chat_mod
    from app.api.routes import legal as legal_mod
    from app.api.routes import schemes as schemes_mod
    from app.api.routes import complaints as complaints_mod
    from app.api.routes import misc as misc_mod
    from app.api.routes import admin as admin_mod
    from app.api.routes import auth as auth_mod

    for mod in (chat_mod, legal_mod, schemes_mod, complaints_mod, misc_mod, admin_mod, auth_mod):
        if hasattr(mod, "get_db"):
            app.dependency_overrides[mod.get_db] = override_db
        if hasattr(mod, "get_admin_db"):
            app.dependency_overrides[mod.get_admin_db] = override_db
    yield
    app.dependency_overrides.clear()
    RECORDED.clear()


def test_user_a_cannot_read_user_b_thread(user_a_client, recording_overrides):
    """The thread query must be filtered by the caller's own user id."""
    res = user_a_client.get("/api/chat/history/00000000-0000-0000-0000-00000000dead")
    assert res.status_code in (404, 500)  # fake DB returns no rows → not found
    thread_sqls = [sql for sql, params in RECORDED if "chat_sessions" in sql]
    assert thread_sqls, "no chat_sessions query was executed"
    assert all("user_id = :uid" in sql for sql in thread_sqls), thread_sqls


def test_delete_is_scoped_to_owner(user_a_client, recording_overrides):
    user_a_client.delete("/api/chat/history/00000000-0000-0000-0000-00000000dead")
    delete_sqls = [
        sql for sql, params in RECORDED
        if sql.strip().lower().startswith("delete") and "chat_sessions" in sql
    ]
    assert delete_sqls, "no delete query executed"
    assert all("user_id = :uid" in sql for sql in delete_sqls)


def test_admin_endpoints_require_admin_role(user_a_client):
    """A signed-in user without the admin role gets 403 on admin endpoints."""
    res = user_a_client.get("/api/admin/documents")
    assert res.status_code == 403


def test_admin_endpoints_reject_anonymous(anon_client):
    res = anon_client.get("/api/admin/documents")
    assert res.status_code in (401, 403)


def test_chat_ask_requires_auth(anon_client):
    res = anon_client.post("/api/chat/ask", json={"question": "What is my right?"})
    assert res.status_code in (401, 403)
