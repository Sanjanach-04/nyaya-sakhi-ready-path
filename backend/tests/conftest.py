"""Shared pytest fixtures. Tests avoid real DB/LLM/embedding calls: pure-logic
services are tested directly, and route-level tests use dependency overrides."""
from __future__ import annotations

import sys
import pathlib
import uuid
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core import security  # noqa: E402
from app.main import app as real_app  # noqa: E402

USER_A = str(uuid.uuid4())
USER_B = str(uuid.uuid4())


class FakeDB:
    """Stand-in Session for tests that only exercise logic, not SQL."""

    def execute(self, *args, **kwargs):  # pragma: no cover - simple stub
        raise RuntimeError("FakeDB.execute should be overridden per-test")

    def commit(self):
        pass

    def rollback(self):
        pass

    def add(self, obj):
        pass


@pytest.fixture
def app() -> FastAPI:
    return real_app


@pytest.fixture
def client_factory(app: FastAPI):
    def _make(user_id: str | None, is_admin: bool = False):
        user = SimpleNamespace(id=user_id, email="user@example.com", claims={"sub": user_id})

        app.dependency_overrides[security.get_current_user] = lambda: user

        def require_admin():
            if not is_admin:
                from fastapi import HTTPException

                raise HTTPException(status_code=403, detail="Admin role required")
            return user

        app.dependency_overrides[security.require_admin] = require_admin

        def override_db():
            yield FakeDB()

        for module in ("app.api.routes.auth", "app.api.routes.chat", "app.api.routes.legal",
                       "app.api.routes.schemes", "app.api.routes.complaints", "app.api.routes.misc"):
            import importlib

            mod = importlib.import_module(module)
            if hasattr(mod, "get_db"):
                app.dependency_overrides[mod.get_db] = override_db
        import app.api.routes.admin as admin_mod

        app.dependency_overrides[admin_mod.get_admin_db] = override_db

        return TestClient(app, raise_server_exceptions=False)

    return _make


@pytest.fixture
def user_a_client(client_factory):
    return client_factory(USER_A)


@pytest.fixture
def user_b_client(client_factory):
    return client_factory(USER_B)


@pytest.fixture
def admin_client(client_factory):
    return client_factory(USER_A, is_admin=True)


@pytest.fixture
def anon_client(app):
    def _require_user():
        from fastapi import HTTPException

        raise HTTPException(status_code=401, detail="Missing bearer token")

    app.dependency_overrides[security.get_current_user] = _require_user
    return TestClient(app, raise_server_exceptions=False)
