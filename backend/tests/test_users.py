"""Users/profile tests — GET /users/me, PUT /users/me (partial), validation, auth."""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _register(client, email, name="Profile User"):
    r = client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": "password123"},
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Read ──────────────────────────────────────────────────────────────────────

def test_get_profile_returns_full_field_set(client):
    token = _register(client, "get@prof.com", "Reader")
    r = client.get("/users/me", headers=_auth(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Reader"
    assert body["email"] == "get@prof.com"
    assert body["profile_completed"] is False  # fresh account: required steps not done
    # The full profile is wider than auth's MeOut — every field is present, even if null.
    for field in (
        "institution", "country", "state", "age",
        "github_url", "linkedin_url", "instagram_url", "avatar_url", "profile_completed",
    ):
        assert field in body


def test_get_requires_authentication(client):
    assert client.get("/users/me").status_code == 401


# ── Update (happy paths) ────────────────────────────────────────────────────────

def test_update_profile_partial_leaves_name(client):
    token = _register(client, "upd@prof.com", "Updater")
    r = client.put("/users/me", json={"institution": "MIT", "age": 21}, headers=_auth(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["institution"] == "MIT"
    assert body["age"] == 21
    assert body["name"] == "Updater"  # untouched


def test_update_country_and_state(client):
    token = _register(client, "loc@prof.com", "Located")
    r = client.put(
        "/users/me",
        json={"country": "India", "state": "Tamil Nadu"},
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    assert r.json()["country"] == "India"
    assert r.json()["state"] == "Tamil Nadu"
    # Clearable like any other optional profile field.
    r = client.put("/users/me", json={"state": None}, headers=_auth(token))
    assert r.json()["state"] is None
    assert r.json()["country"] == "India"  # untouched


def test_update_all_fields(client):
    token = _register(client, "all@prof.com", "All")
    payload = {
        "name": "New Name",
        "institution": "Stanford",
        "country": "United States",
        "state": "California",
        "age": 22,
        "github_url": "https://github.com/example",
        "linkedin_url": "https://linkedin.com/in/example",
        "instagram_url": "https://instagram.com/example",
        "avatar_url": "https://cdn.example.com/a.png",
    }
    r = client.put("/users/me", json=payload, headers=_auth(token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "New Name"
    assert body["github_url"] == "https://github.com/example"
    assert body["avatar_url"] == "https://cdn.example.com/a.png"


def test_omitted_fields_are_not_wiped(client):
    token = _register(client, "omit@prof.com", "Omit")
    client.put("/users/me", json={"institution": "First"}, headers=_auth(token))
    r = client.put("/users/me", json={"age": 30}, headers=_auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["institution"] == "First"  # survived the second update
    assert r.json()["age"] == 30


def test_field_can_be_cleared_with_explicit_null(client):
    token = _register(client, "clr@prof.com", "Clear")
    client.put("/users/me", json={"github_url": "https://github.com/x"}, headers=_auth(token))
    r = client.put("/users/me", json={"github_url": None}, headers=_auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["github_url"] is None


# ── Update (validation) ─────────────────────────────────────────────────────────

def test_invalid_url_rejected(client):
    token = _register(client, "badurl@prof.com", "BadUrl")
    r = client.put("/users/me", json={"github_url": "not-a-url"}, headers=_auth(token))
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"


def test_age_out_of_bounds_rejected(client):
    token = _register(client, "age@prof.com", "AgeTest")
    assert client.put("/users/me", json={"age": 5}, headers=_auth(token)).status_code == 422
    assert client.put("/users/me", json={"age": 200}, headers=_auth(token)).status_code == 422


def test_name_cannot_be_set_to_null(client):
    token = _register(client, "nullname@prof.com", "NullName")
    r = client.put("/users/me", json={"name": None}, headers=_auth(token))
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"


def test_name_cannot_be_empty(client):
    token = _register(client, "emptyname@prof.com", "EmptyName")
    r = client.put("/users/me", json={"name": ""}, headers=_auth(token))
    assert r.status_code == 422


def test_update_requires_authentication(client):
    assert client.put("/users/me", json={"institution": "X"}).status_code == 401


# ── Profile completion (one-way latch) ─────────────────────────────────────────

def test_profile_completed_when_country_and_institution_set(client):
    token = _register(client, "done@prof.com", "Done")
    r = client.put(
        "/users/me",
        json={"country": "India", "state": "Tamil Nadu", "institution": "NIT Trichy"},
        headers=_auth(token),
    )
    assert r.status_code == 200, r.text
    assert r.json()["profile_completed"] is True


def test_profile_not_completed_with_partial_fields(client):
    token = _register(client, "half@prof.com", "Half")
    r = client.put("/users/me", json={"country": "India"}, headers=_auth(token))
    assert r.json()["profile_completed"] is False

    other = _register(client, "half2@prof.com", "Half2")
    r = client.put("/users/me", json={"institution": "X"}, headers=_auth(other))
    assert r.json()["profile_completed"] is False


def test_profile_completed_is_a_latch(client):
    """Clearing a required field later must NOT reset completion (would eject the
    user from the portal mid-session)."""
    token = _register(client, "latch@prof.com", "Latch")
    client.put(
        "/users/me",
        json={"country": "India", "institution": "NIT Trichy"},
        headers=_auth(token),
    )
    r = client.put("/users/me", json={"institution": None}, headers=_auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["institution"] is None
    assert r.json()["profile_completed"] is True  # latched


def test_empty_institution_does_not_complete(client):
    token = _register(client, "empty@prof.com", "Empty")
    r = client.put(
        "/users/me", json={"country": "India", "institution": ""}, headers=_auth(token)
    )
    assert r.status_code == 200, r.text
    assert r.json()["profile_completed"] is False


# ── Regression: auth read endpoint untouched ────────────────────────────────────

def test_auth_me_still_works(client):
    token = _register(client, "regress@prof.com", "Regress")
    r = client.get("/auth/me", headers=_auth(token))
    assert r.status_code == 200, r.text
    assert r.json()["email"] == "regress@prof.com"
