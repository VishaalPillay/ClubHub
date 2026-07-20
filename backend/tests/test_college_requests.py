"""College-requests tests — POST /college-requests (log a missing college)."""

from sqlmodel import select

from app.models import CollegeRequest

# ── Helpers ───────────────────────────────────────────────────────────────────

def _register(client, email, name="College Requester"):
    r = client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": "password123"},
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _user_id(client, token: str) -> int:
    return client.get("/auth/me", headers=_auth(token)).json()["id"]


# ── Happy path ───────────────────────────────────────────────────────────────

def test_request_college_creates_row(client, session):
    token = _register(client, "req@college.com")
    r = client.post(
        "/college-requests",
        json={"name": "Example Institute of Technology", "country": "India", "state": "Tamil Nadu"},
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "pending"
    assert "id" in body

    row = session.get(CollegeRequest, body["id"])
    assert row is not None
    assert row.name == "Example Institute of Technology"
    assert row.country == "India"
    assert row.state == "Tamil Nadu"
    assert row.requested_by == _user_id(client, token)
    assert row.status == "pending"


def test_request_college_state_optional(client):
    token = _register(client, "nostate@college.com")
    r = client.post(
        "/college-requests",
        json={"name": "Some College", "country": "United States"},
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "pending"


# ── Auth ─────────────────────────────────────────────────────────────────────

def test_request_college_requires_authentication(client):
    r = client.post(
        "/college-requests",
        json={"name": "Some College", "country": "India", "state": "Kerala"},
    )
    assert r.status_code == 401


# ── Validation ───────────────────────────────────────────────────────────────

def test_request_college_empty_name_rejected(client):
    token = _register(client, "emptyname@college.com")
    r = client.post(
        "/college-requests",
        json={"name": "", "country": "India", "state": "Kerala"},
        headers=_auth(token),
    )
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"


def test_request_college_missing_country_rejected(client):
    token = _register(client, "nocountry@college.com")
    r = client.post(
        "/college-requests",
        json={"name": "Some College"},
        headers=_auth(token),
    )
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"


# ── Dedupe ───────────────────────────────────────────────────────────────────

def test_duplicate_pending_request_is_deduped(client, session):
    token = _register(client, "dup@college.com")
    payload = {"name": "Dup College", "country": "India", "state": "Karnataka"}

    first = client.post("/college-requests", json=payload, headers=_auth(token))
    second = client.post(
        "/college-requests",
        json={"name": "dup college", "country": "India", "state": "Karnataka"},  # case-insensitive
        headers=_auth(token),
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]  # same row reused

    rows = session.exec(
        select(CollegeRequest).where(
            CollegeRequest.country == "India", CollegeRequest.state == "Karnataka"
        )
    ).all()
    assert len(rows) == 1


def test_different_state_is_not_deduped(client, session):
    token = _register(client, "diffstate@college.com")
    client.post(
        "/college-requests",
        json={"name": "Same Name College", "country": "India", "state": "Karnataka"},
        headers=_auth(token),
    )
    r = client.post(
        "/college-requests",
        json={"name": "Same Name College", "country": "India", "state": "Tamil Nadu"},
        headers=_auth(token),
    )
    assert r.status_code == 201

    rows = session.exec(
        select(CollegeRequest).where(CollegeRequest.name == "Same Name College")
    ).all()
    assert len(rows) == 2
