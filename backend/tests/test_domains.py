"""Domains vertical-slice tests: CRUD, permissions, name-collision, cross-club isolation."""

from app.models import ClubMember, Domain


# ── Helpers ───────────────────────────────────────────────────────────────────

def _register(client, email="alice@example.com", password="password123", name="Alice"):
    r = client.post("/auth/register", json={"name": name, "email": email, "password": password})
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _club_headers(token: str, club_id: int) -> dict:
    return {"Authorization": f"Bearer {token}", "X-Club-ID": str(club_id)}


def _create_club(client, token, name="Test Club"):
    r = client.post(
        "/clubs",
        json={"name": name, "description": "Desc", "enabled_roles": ["member", "vice_president"]},
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    return r.json()


def _user_id(client, token: str) -> int:
    return client.get("/auth/me", headers=_auth(token)).json()["id"]


def _inject_member(session, user_id: int, club_id: int, role: str) -> None:
    session.add(ClubMember(user_id=user_id, club_id=club_id, role=role))
    session.commit()


# ── List domains ──────────────────────────────────────────────────────────────

def test_list_domains_as_member(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice)

    _inject_member(session, _user_id(client, bob), club["id"], "member")

    domain = Domain(club_id=club["id"], name="Engineering")
    session.add(domain)
    session.commit()

    r = client.get(f"/clubs/{club['id']}/domains", headers=_club_headers(bob, club["id"]))
    assert r.status_code == 200
    names = [d["name"] for d in r.json()]
    assert "Engineering" in names


def test_list_domains_non_member_403(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice)

    r = client.get(f"/clubs/{club['id']}/domains", headers=_club_headers(bob, club["id"]))
    assert r.status_code == 403
    assert r.json()["code"] == "NOT_A_MEMBER"


# ── Create domain ─────────────────────────────────────────────────────────────

def test_create_domain_as_president_201(client):
    token = _register(client)
    club = _create_club(client, token)

    r = client.post(
        f"/clubs/{club['id']}/domains",
        json={"name": "Backend", "description": "Server-side team"},
        headers=_club_headers(token, club["id"]),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["name"] == "Backend"
    assert body["description"] == "Server-side team"
    assert "id" in body


def test_create_domain_as_member_403(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice)

    _inject_member(session, _user_id(client, bob), club["id"], "member")

    r = client.post(
        f"/clubs/{club['id']}/domains",
        json={"name": "Unauthorized"},
        headers=_club_headers(bob, club["id"]),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "FORBIDDEN_RANK"


def test_create_domain_as_vp_201(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice)

    _inject_member(session, _user_id(client, bob), club["id"], "vice_president")

    r = client.post(
        f"/clubs/{club['id']}/domains",
        json={"name": "Frontend"},
        headers=_club_headers(bob, club["id"]),
    )
    assert r.status_code == 201
    assert r.json()["name"] == "Frontend"


def test_create_domain_duplicate_name_409(client):
    token = _register(client)
    club = _create_club(client, token)

    assert client.post(
        f"/clubs/{club['id']}/domains",
        json={"name": "Backend"},
        headers=_club_headers(token, club["id"]),
    ).status_code == 201

    r = client.post(
        f"/clubs/{club['id']}/domains",
        json={"name": "Backend"},
        headers=_club_headers(token, club["id"]),
    )
    assert r.status_code == 409
    assert r.json()["code"] == "DOMAIN_NAME_TAKEN"


# ── Update domain ─────────────────────────────────────────────────────────────

def test_update_domain_as_vp(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice)

    _inject_member(session, _user_id(client, bob), club["id"], "vice_president")

    create_r = client.post(
        f"/clubs/{club['id']}/domains",
        json={"name": "Old Name"},
        headers=_club_headers(alice, club["id"]),
    )
    domain_id = create_r.json()["id"]

    r = client.put(
        f"/clubs/{club['id']}/domains/{domain_id}",
        json={"name": "New Name"},
        headers=_club_headers(bob, club["id"]),
    )
    assert r.status_code == 200
    assert r.json()["name"] == "New Name"


def test_update_domain_rename_collision_409(client):
    token = _register(client)
    club = _create_club(client, token)

    r1 = client.post(
        f"/clubs/{club['id']}/domains",
        json={"name": "Alpha"},
        headers=_club_headers(token, club["id"]),
    )
    r2 = client.post(
        f"/clubs/{club['id']}/domains",
        json={"name": "Beta"},
        headers=_club_headers(token, club["id"]),
    )
    beta_id = r2.json()["id"]

    # Rename Beta to Alpha (collision).
    r = client.put(
        f"/clubs/{club['id']}/domains/{beta_id}",
        json={"name": "Alpha"},
        headers=_club_headers(token, club["id"]),
    )
    assert r.status_code == 409
    assert r.json()["code"] == "DOMAIN_NAME_TAKEN"


def test_update_domain_not_in_club_404(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club_a = _create_club(client, alice, "Club A")
    club_b = _create_club(client, bob, "Club B")

    # Create a domain in club B, then Alice (in club A) tries to update it via her context.
    r = client.post(
        f"/clubs/{club_b['id']}/domains",
        json={"name": "Intruder"},
        headers=_club_headers(bob, club_b["id"]),
    )
    domain_id = r.json()["id"]

    # Alice's context is club A; path also says club A — but the domain belongs to club B.
    r = client.put(
        f"/clubs/{club_a['id']}/domains/{domain_id}",
        json={"name": "Hacked"},
        headers=_club_headers(alice, club_a["id"]),
    )
    assert r.status_code == 404
    assert r.json()["code"] == "DOMAIN_NOT_FOUND"


# ── Delete domain ─────────────────────────────────────────────────────────────

def test_delete_domain_as_vp_204(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice)

    _inject_member(session, _user_id(client, bob), club["id"], "vice_president")

    create_r = client.post(
        f"/clubs/{club['id']}/domains",
        json={"name": "Temporary"},
        headers=_club_headers(alice, club["id"]),
    )
    domain_id = create_r.json()["id"]

    r = client.delete(
        f"/clubs/{club['id']}/domains/{domain_id}",
        headers=_club_headers(bob, club["id"]),
    )
    assert r.status_code == 204

    # Confirm it's gone.
    domains_r = client.get(f"/clubs/{club['id']}/domains", headers=_club_headers(alice, club["id"]))
    names = [d["name"] for d in domains_r.json()]
    assert "Temporary" not in names


def test_delete_domain_not_in_club_404(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club_a = _create_club(client, alice, "Club A")
    club_b = _create_club(client, bob, "Club B")

    r = client.post(
        f"/clubs/{club_b['id']}/domains",
        json={"name": "B Domain"},
        headers=_club_headers(bob, club_b["id"]),
    )
    domain_id = r.json()["id"]

    # Alice in club A tries to delete a domain that only exists in club B.
    r = client.delete(
        f"/clubs/{club_a['id']}/domains/{domain_id}",
        headers=_club_headers(alice, club_a["id"]),
    )
    assert r.status_code == 404
    assert r.json()["code"] == "DOMAIN_NOT_FOUND"


# ── Club ID mismatch ──────────────────────────────────────────────────────────

def test_domain_club_id_mismatch_400(client):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club_a = _create_club(client, alice, "Club A")
    club_b = _create_club(client, bob, "Club B")

    # Alice's X-Club-ID is club A, but the URL path says club B.
    r = client.post(
        f"/clubs/{club_b['id']}/domains",
        json={"name": "Bad Domain"},
        headers=_club_headers(alice, club_a["id"]),
    )
    assert r.status_code == 400
    assert r.json()["code"] == "CLUB_ID_MISMATCH"
