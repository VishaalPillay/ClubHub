"""GET /colleges — the community-promoted list CollegeSelect merges into the static curated one."""

from app.models import College


def _register(client, email):
    r = client.post(
        "/auth/register",
        json={"name": "Someone", "email": email, "password": "password123"},
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_get_colleges_returns_promoted_entries(client, session):
    session.add(College(name="Promoted College", country="India", state="Kerala"))
    session.add(College(name="Other State College", country="India", state="Karnataka"))
    session.commit()

    token = _register(client, "list@college.com")
    params = {"country": "India", "state": "Kerala"}
    r = client.get("/colleges", params=params, headers=_auth(token))
    assert r.status_code == 200, r.text
    names = [c["name"] for c in r.json()]
    assert names == ["Promoted College"]


def test_get_colleges_no_state_filters_to_null_state(client, session):
    session.add(College(name="No-State College", country="United States", state=None))
    session.commit()

    token = _register(client, "nostate@college.com")
    r = client.get("/colleges", params={"country": "United States"}, headers=_auth(token))
    assert r.status_code == 200, r.text
    assert [c["name"] for c in r.json()] == ["No-State College"]


def test_get_colleges_empty_when_none_match(client):
    token = _register(client, "empty@college.com")
    r = client.get("/colleges", params={"country": "Freedonia"}, headers=_auth(token))
    assert r.status_code == 200
    assert r.json() == []


def test_get_colleges_requires_authentication(client):
    r = client.get("/colleges", params={"country": "India"})
    assert r.status_code == 401


def test_get_colleges_requires_country(client):
    token = _register(client, "nocountry@college.com")
    r = client.get("/colleges", headers=_auth(token))
    assert r.status_code == 422
