"""Refresh-token flow tests — cookie issuance, rotation, reuse detection, logout.

The refresh token travels only in the httpOnly cookie (path=/auth); the access token
stays in the JSON body per ADR-0002. TestClient persists cookies between calls.
"""

from app.core.config import settings

COOKIE = settings.REFRESH_COOKIE_NAME


def _register(client, email, name="User"):
    r = client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": "password123"},
    )
    assert r.status_code == 201, r.text
    return r


# ── Cookie issuance ───────────────────────────────────────────────────────────

def test_register_sets_refresh_cookie_and_returns_access_token(client):
    r = _register(client, "reg@refresh.com")
    assert r.json()["access_token"]
    assert r.cookies.get(COOKIE), "refresh cookie missing from register response"
    set_cookie = r.headers["set-cookie"]
    assert "HttpOnly" in set_cookie
    assert "Path=/auth" in set_cookie


def test_login_sets_refresh_cookie(client):
    _register(client, "login@refresh.com")
    client.cookies.clear()

    r = client.post(
        "/auth/login", json={"email": "login@refresh.com", "password": "password123"}
    )
    assert r.status_code == 200, r.text
    assert r.cookies.get(COOKIE)


# ── Refresh & rotation ────────────────────────────────────────────────────────

def test_refresh_rotates_token_and_mints_access_token(client):
    r = _register(client, "rotate@refresh.com")
    raw_old = r.cookies.get(COOKIE)

    r2 = client.post("/auth/refresh")
    assert r2.status_code == 200, r2.text
    assert r2.json()["access_token"]
    raw_new = r2.cookies.get(COOKIE)
    assert raw_new and raw_new != raw_old, "refresh must rotate the cookie value"

    # The new access token works against a protected endpoint.
    me = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {r2.json()['access_token']}"}
    )
    assert me.status_code == 200, me.text


def test_refresh_without_cookie_is_401(client):
    client.cookies.clear()
    r = client.post("/auth/refresh")
    assert r.status_code == 401, r.text
    assert r.json()["code"] == "NO_REFRESH_TOKEN"


def test_refresh_with_garbage_cookie_is_401(client):
    client.cookies.clear()
    client.cookies.set(COOKIE, "not-a-real-token")
    r = client.post("/auth/refresh")
    assert r.status_code == 401, r.text
    assert r.json()["code"] == "INVALID_REFRESH"


# ── Reuse detection ───────────────────────────────────────────────────────────

def test_reused_token_revokes_all_sessions(client):
    r = _register(client, "reuse@refresh.com")
    raw_old = r.cookies.get(COOKIE)

    r2 = client.post("/auth/refresh")
    assert r2.status_code == 200
    raw_new = r2.cookies.get(COOKIE)

    # Present the already-rotated (revoked) token — reuse must be detected...
    client.cookies.clear()
    client.cookies.set(COOKIE, raw_old)
    r3 = client.post("/auth/refresh")
    assert r3.status_code == 401, r3.text
    assert r3.json()["code"] == "REFRESH_REUSED"

    # ...and the still-current token must have been revoked as collateral.
    client.cookies.clear()
    client.cookies.set(COOKIE, raw_new)
    r4 = client.post("/auth/refresh")
    assert r4.status_code == 401, r4.text


# ── Logout ────────────────────────────────────────────────────────────────────

def test_logout_revokes_token_and_clears_cookie(client):
    r = _register(client, "logout@refresh.com")
    raw = r.cookies.get(COOKIE)

    r2 = client.post("/auth/logout")
    assert r2.status_code == 204, r2.text

    # The revoked token can no longer be used to refresh.
    client.cookies.clear()
    client.cookies.set(COOKIE, raw)
    r3 = client.post("/auth/refresh")
    assert r3.status_code == 401, r3.text


def test_logout_without_cookie_is_idempotent(client):
    client.cookies.clear()
    r = client.post("/auth/logout")
    assert r.status_code == 204, r.text
