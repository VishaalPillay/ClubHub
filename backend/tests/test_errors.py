"""App-level error handling: the catch-all returns the standard envelope, not a stack trace."""

from fastapi.testclient import TestClient

from app.core.db import get_session
from app.main import app
from app.modules.clubs import service as clubs_service


def test_unexpected_error_returns_internal_error_envelope(session, monkeypatch):
    """An endpoint raising an unexpected error → 500 {detail, code} envelope."""

    def _boom(*args, **kwargs):
        raise RuntimeError("kaboom")

    monkeypatch.setattr(clubs_service, "get_directory", _boom)

    app.dependency_overrides[get_session] = lambda: session
    try:
        # raise_server_exceptions=False so the client returns the 500 response instead of
        # re-raising the exception that ServerErrorMiddleware logs and re-raises.
        with TestClient(app, raise_server_exceptions=False) as c:
            reg = c.post(
                "/auth/register",
                json={"name": "Alice", "email": "alice@example.com", "password": "password123"},
            )
            assert reg.status_code == 201, reg.text
            token = reg.json()["access_token"]

            r = c.get("/clubs/directory", headers={"Authorization": f"Bearer {token}"})
            assert r.status_code == 500
            assert r.json() == {"detail": "Internal server error", "code": "INTERNAL_ERROR"}
    finally:
        app.dependency_overrides.clear()
