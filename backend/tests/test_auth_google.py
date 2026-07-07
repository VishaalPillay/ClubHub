"""Google sign-in tests — POST /auth/google (token verify is mocked, resolution is real).

`verify_oauth2_token` is monkeypatched at the service's import site so no test talks to
Google; everything after verification (sub/email resolution, linking, creation, session
issuance) runs against the real database.
"""

import pytest

from app.core.config import settings
from app.modules.auth import service as auth_service

CLIENT_ID = "test-client-id.apps.googleusercontent.com"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _claims(sub="google-sub-1", email="g@user.com", name="Google User", **extra):
    base = {"sub": sub, "email": email, "email_verified": True, "name": name}
    base.update(extra)
    return base


@pytest.fixture()
def google_ok(monkeypatch):
    """Configure the client ID and make token verification return the given claims."""
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", CLIENT_ID)

    def _install(claims):
        monkeypatch.setattr(
            auth_service.google_id_token,
            "verify_oauth2_token",
            lambda credential, request, audience: claims,
        )

    return _install


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Configuration guard ─────────────────────────────────────────────────────────

def test_unconfigured_server_returns_503(client, monkeypatch):
    # Pin the client ID empty so this is hermetic even when a real GOOGLE_CLIENT_ID is
    # present in the environment (e.g. a developer's .env with Google sign-in configured).
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    r = client.post("/auth/google", json={"credential": "anything"})
    assert r.status_code == 503, r.text
    assert r.json()["code"] == "GOOGLE_NOT_CONFIGURED"


# ── Sign-up (new account) ───────────────────────────────────────────────────────

def test_new_google_user_created_and_flagged(client, google_ok):
    google_ok(_claims(picture="https://lh3.googleusercontent.com/a/photo"))
    r = client.post("/auth/google", json={"credential": "tok"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["is_new"] is True
    assert body["access_token"]
    assert settings.REFRESH_COOKIE_NAME in r.cookies

    me = client.get("/users/me", headers=_auth(body["access_token"]))
    assert me.status_code == 200
    profile = me.json()
    assert profile["email"] == "g@user.com"
    assert profile["name"] == "Google User"
    assert profile["avatar_url"] == "https://lh3.googleusercontent.com/a/photo"


def test_google_only_account_rejects_password_login(client, google_ok):
    google_ok(_claims(email="nopass@user.com"))
    client.post("/auth/google", json={"credential": "tok"})
    r = client.post("/auth/login", json={"email": "nopass@user.com", "password": "password123"})
    assert r.status_code == 401
    assert r.json()["code"] == "BAD_CREDENTIALS"


# ── Sign-in (returning) and linking ────────────────────────────────────────────

def test_returning_google_user_signs_in(client, google_ok):
    google_ok(_claims(sub="stable-sub"))
    first = client.post("/auth/google", json={"credential": "tok"})
    assert first.json()["is_new"] is True
    again = client.post("/auth/google", json={"credential": "tok"})
    assert again.status_code == 200
    assert again.json()["is_new"] is False


def test_matching_email_links_existing_password_account(client, google_ok):
    r = client.post(
        "/auth/register",
        json={"name": "Linker", "email": "link@user.com", "password": "password123"},
    )
    assert r.status_code == 201

    google_ok(_claims(sub="link-sub", email="link@user.com"))
    g = client.post("/auth/google", json={"credential": "tok"})
    assert g.status_code == 200, g.text
    assert g.json()["is_new"] is False  # linked, not created

    # Password login still works after linking (password_hash untouched).
    login = client.post(
        "/auth/login", json={"email": "link@user.com", "password": "password123"}
    )
    assert login.status_code == 200


# ── Rejections ─────────────────────────────────────────────────────────────────

def test_invalid_credential_rejected(client, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", CLIENT_ID)

    def _boom(credential, request, audience):
        raise ValueError("bad token")

    monkeypatch.setattr(auth_service.google_id_token, "verify_oauth2_token", _boom)
    r = client.post("/auth/google", json={"credential": "garbage"})
    assert r.status_code == 401
    assert r.json()["code"] == "INVALID_GOOGLE_TOKEN"


def test_unverified_email_rejected(client, google_ok):
    google_ok(_claims(email_verified=False))
    r = client.post("/auth/google", json={"credential": "tok"})
    assert r.status_code == 401
    assert r.json()["code"] == "GOOGLE_EMAIL_UNVERIFIED"


def test_empty_credential_rejected(client, google_ok):
    google_ok(_claims())
    assert client.post("/auth/google", json={"credential": ""}).status_code == 422


# ── Session contract parity with register/login ────────────────────────────────

def test_google_session_refreshes_like_any_other(client, google_ok):
    google_ok(_claims(sub="refresh-sub", email="refresh@user.com"))
    r = client.post("/auth/google", json={"credential": "tok"})
    assert r.status_code == 200
    refreshed = client.post("/auth/refresh")  # cookie carried by the test client
    assert refreshed.status_code == 200, refreshed.text
    assert refreshed.json()["access_token"]
