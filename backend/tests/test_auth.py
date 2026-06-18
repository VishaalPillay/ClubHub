"""Auth vertical-slice tests: register -> login -> /me, plus failure paths."""


def _register(client, email="alice@example.com", password="password123", name="Alice"):
    return client.post(
        "/auth/register", json={"name": name, "email": email, "password": password}
    )


def _login(client, email="alice@example.com", password="password123"):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_register_login_me_happy_path(client):
    reg = _register(client)
    assert reg.status_code == 201, reg.text
    body = reg.json()
    # Register returns the access token directly (ADR-0002).
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    reg_token = body["access_token"]

    login = _login(client)
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    assert login.json()["token_type"] == "bearer"

    # Both the register token and a fresh login token should access /me.
    for t in (reg_token, token):
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {t}"})
        assert me.status_code == 200, me.text
        assert me.json()["email"] == "alice@example.com"


def test_register_duplicate_email_conflicts(client):
    assert _register(client).status_code == 201
    dup = _register(client, name="Alice Two")
    assert dup.status_code == 409
    assert dup.json()["code"] == "EMAIL_TAKEN"


def test_login_wrong_password_unauthorized(client):
    assert _register(client).status_code == 201
    bad = _login(client, password="wrong-password")
    assert bad.status_code == 401
    assert bad.json()["code"] == "BAD_CREDENTIALS"


def test_me_requires_authentication(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_register_rejects_short_password(client):
    resp = _register(client, password="short")
    assert resp.status_code == 422
    assert resp.json()["code"] == "VALIDATION_ERROR"
