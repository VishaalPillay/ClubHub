"""Clubs vertical-slice tests: create, my, lookup, join flow, withdraw, detail."""

import re

from app.models import Club, ClubMember, Domain


# ── Helpers ───────────────────────────────────────────────────────────────────

def _register(client, email="alice@example.com", password="password123", name="Alice"):
    r = client.post("/auth/register", json={"name": name, "email": email, "password": password})
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _club_headers(token: str, club_id: int) -> dict:
    return {"Authorization": f"Bearer {token}", "X-Club-ID": str(club_id)}


def _create_club(client, token, name="Test Club", enabled_roles=None):
    if enabled_roles is None:
        enabled_roles = ["member", "associate", "lead", "joint_secretary", "secretary", "vice_president"]
    r = client.post(
        "/clubs",
        json={"name": name, "description": "A test club.", "enabled_roles": enabled_roles},
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    return r.json()


def _user_id(client, token: str) -> int:
    return client.get("/auth/me", headers=_auth(token)).json()["id"]


# ── Create + /my ──────────────────────────────────────────────────────────────

def test_create_club_creator_is_president(client):
    token = _register(client)
    club = _create_club(client, token)

    r = client.get("/clubs/my", headers=_auth(token))
    assert r.status_code == 200
    my = r.json()
    assert len(my) == 1
    assert my[0]["id"] == club["id"]
    assert my[0]["role"] == "president"
    assert my[0]["domain_id"] is None


def test_create_club_code_format(client):
    token = _register(client)
    club = _create_club(client, token, name="Computer Science")
    # Expect XX-XXXXX where X chars come from our alphabet.
    assert re.match(r"^[A-Z]{2}-[A-Z0-9]{5}$", club["code"]), club["code"]
    # Prefix should be the first two alpha chars of the name.
    assert club["code"].startswith("CO"), club["code"]


def test_create_club_non_latin_name_gets_fallback_prefix(client):
    token = _register(client)
    club = _create_club(client, token, name="数学会")
    assert re.match(r"^CL-[A-Z0-9]{5}$", club["code"]), club["code"]


def test_create_club_rejects_president_in_enabled_roles(client):
    token = _register(client)
    r = client.post(
        "/clubs",
        json={"name": "Bad Club", "enabled_roles": ["president", "member"]},
        headers=_auth(token),
    )
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"


def test_create_club_empty_enabled_roles_allowed(client):
    """A president-only club (no join-requestable roles) is valid."""
    token = _register(client)
    r = client.post(
        "/clubs",
        json={"name": "Exclusive Club", "enabled_roles": []},
        headers=_auth(token),
    )
    assert r.status_code == 201


# ── /clubs/directory ──────────────────────────────────────────────────────────

def test_directory_returns_public_clubs(client):
    token = _register(client)
    club = _create_club(client, token)  # is_public defaults to True

    r = client.get("/clubs/directory", headers=_auth(token))
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()]
    assert club["id"] in ids


# ── /clubs/lookup ─────────────────────────────────────────────────────────────

def test_lookup_by_code_returns_club_with_domains_and_roles(client, session):
    token = _register(client)
    club = _create_club(client, token, enabled_roles=["member", "associate"])

    domain = Domain(club_id=club["id"], name="Engineering")
    session.add(domain)
    session.commit()

    r = client.get(f"/clubs/lookup?code={club['code']}", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == club["id"]
    assert data["enabled_roles"] == ["member", "associate"]
    assert len(data["domains"]) == 1
    assert data["domains"][0]["name"] == "Engineering"


def test_lookup_unknown_code_404(client):
    token = _register(client)
    r = client.get("/clubs/lookup?code=ZZ-00000", headers=_auth(token))
    assert r.status_code == 404
    assert r.json()["code"] == "CLUB_NOT_FOUND"


def test_lookup_by_code_case_insensitive(client):
    """Lowercase or mixed-case codes should resolve to the same club."""
    token = _register(client)
    club = _create_club(client, token)

    lowercase_code = club["code"].lower()  # e.g. "co-x7k2p"
    r = client.get(f"/clubs/lookup?code={lowercase_code}", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["id"] == club["id"]


# ── Join flow ─────────────────────────────────────────────────────────────────

def test_join_creates_pending_row(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice, enabled_roles=["member"])

    domain = Domain(club_id=club["id"], name="Dev")
    session.add(domain)
    session.commit()
    session.refresh(domain)

    r = client.post(
        "/clubs/join",
        json={"club_code": club["code"], "requested_role": "member", "requested_domain_id": domain.id},
        headers=_auth(bob),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "pending"
    assert body["club_id"] == club["id"]


def test_join_appears_in_pending(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice, enabled_roles=["member"])

    domain = Domain(club_id=club["id"], name="Dev")
    session.add(domain)
    session.commit()
    session.refresh(domain)

    client.post(
        "/clubs/join",
        json={"club_code": club["code"], "requested_role": "member", "requested_domain_id": domain.id},
        headers=_auth(bob),
    )

    r = client.get("/clubs/pending", headers=_auth(bob))
    assert r.status_code == 200
    pending = r.json()
    assert len(pending) == 1
    assert pending[0]["club_name"] == club["name"]
    assert pending[0]["code"] == club["code"]
    assert pending[0]["requested_role"] == "member"
    assert pending[0]["status"] == "pending"


def test_join_duplicate_request_409(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice, enabled_roles=["member"])

    domain = Domain(club_id=club["id"], name="Dev")
    session.add(domain)
    session.commit()
    session.refresh(domain)

    payload = {
        "club_code": club["code"],
        "requested_role": "member",
        "requested_domain_id": domain.id,
    }
    assert client.post("/clubs/join", json=payload, headers=_auth(bob)).status_code == 201

    r = client.post("/clubs/join", json=payload, headers=_auth(bob))
    assert r.status_code == 409
    assert r.json()["code"] == "DUPLICATE_REQUEST"


def test_join_role_not_enabled_422(client):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice, enabled_roles=["member"])  # "lead" not enabled

    r = client.post(
        "/clubs/join",
        json={"club_code": club["code"], "requested_role": "lead"},
        headers=_auth(bob),
    )
    assert r.status_code == 422
    assert r.json()["code"] == "ROLE_NOT_ENABLED"


def test_join_member_role_without_domain_422(client):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice, enabled_roles=["member"])

    r = client.post(
        "/clubs/join",
        json={"club_code": club["code"], "requested_role": "member"},  # no domain_id
        headers=_auth(bob),
    )
    assert r.status_code == 422
    assert r.json()["code"] == "DOMAIN_REQUIRED"


def test_join_member_role_wrong_club_domain_422(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    alice_id = _user_id(client, alice)

    club_a = _create_club(client, alice, "Club A", enabled_roles=["member"])

    # A second club (owned by Alice) with its own domain.
    club_b = Club(name="Club B", code="ZZ-00001", owner_id=alice_id, enabled_roles=["member"])
    session.add(club_b)
    session.commit()
    session.refresh(club_b)
    domain_b = Domain(club_id=club_b.id, name="Domain B")
    session.add(domain_b)
    session.commit()
    session.refresh(domain_b)

    r = client.post(
        "/clubs/join",
        json={
            "club_code": club_a["code"],
            "requested_role": "member",
            "requested_domain_id": domain_b.id,  # belongs to club B, not club A
        },
        headers=_auth(bob),
    )
    assert r.status_code == 422
    assert r.json()["code"] == "DOMAIN_NOT_IN_CLUB"


def test_join_already_member_fires_before_role_check(client):
    """ALREADY_MEMBER takes priority over ROLE_NOT_ENABLED (state before payload)."""
    token = _register(client)
    club = _create_club(client, token, enabled_roles=[])  # no roles enabled at all

    r = client.post(
        "/clubs/join",
        json={"club_code": club["code"], "requested_role": "member"},
        headers=_auth(token),  # Alice is already president of this club
    )
    assert r.status_code == 409
    assert r.json()["code"] == "ALREADY_MEMBER"


def test_join_exec_role_ignores_domain(client):
    """Vice-president join (exec role) succeeds without a domain."""
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice, enabled_roles=["vice_president"])

    r = client.post(
        "/clubs/join",
        json={"club_code": club["code"], "requested_role": "vice_president"},
        headers=_auth(bob),
    )
    assert r.status_code == 201
    assert r.json()["status"] == "pending"


# ── Withdraw ──────────────────────────────────────────────────────────────────

def test_withdraw_own_request_204(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice, enabled_roles=["member"])

    domain = Domain(club_id=club["id"], name="Dev")
    session.add(domain)
    session.commit()
    session.refresh(domain)

    join_r = client.post(
        "/clubs/join",
        json={"club_code": club["code"], "requested_role": "member", "requested_domain_id": domain.id},
        headers=_auth(bob),
    )
    req_id = join_r.json()["id"]

    r = client.delete(f"/clubs/join/{req_id}", headers=_auth(bob))
    assert r.status_code == 204


def test_withdraw_others_request_403(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    charlie = _register(client, "charlie@example.com", name="Charlie")
    club = _create_club(client, alice, enabled_roles=["member"])

    domain = Domain(club_id=club["id"], name="Dev")
    session.add(domain)
    session.commit()
    session.refresh(domain)

    join_r = client.post(
        "/clubs/join",
        json={"club_code": club["code"], "requested_role": "member", "requested_domain_id": domain.id},
        headers=_auth(bob),
    )
    req_id = join_r.json()["id"]

    # Charlie tries to withdraw Bob's request.
    r = client.delete(f"/clubs/join/{req_id}", headers=_auth(charlie))
    assert r.status_code == 403
    assert r.json()["code"] == "NOT_YOUR_REQUEST"


# ── Club detail + update ──────────────────────────────────────────────────────

def test_get_club_detail_requires_membership(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice)

    # Bob is not a member — X-Club-ID: club resolves to 403.
    r = client.get(f"/clubs/{club['id']}", headers=_club_headers(bob, club["id"]))
    assert r.status_code == 403
    assert r.json()["code"] == "NOT_A_MEMBER"


def test_get_club_detail_member_succeeds(client):
    token = _register(client)
    club = _create_club(client, token)

    r = client.get(f"/clubs/{club['id']}", headers=_club_headers(token, club["id"]))
    assert r.status_code == 200
    assert r.json()["id"] == club["id"]
    assert r.json()["code"] == club["code"]


def test_get_club_club_id_mismatch_400(client):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club_a = _create_club(client, alice, "Club A")
    club_b = _create_club(client, bob, "Club B")

    # Alice's context is club A, but path points to club B.
    r = client.get(
        f"/clubs/{club_b['id']}",
        headers=_club_headers(alice, club_a["id"]),
    )
    assert r.status_code == 400
    assert r.json()["code"] == "CLUB_ID_MISMATCH"


def test_update_club_requires_vice_president(client, session):
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice)

    bob_id = _user_id(client, bob)
    session.add(ClubMember(user_id=bob_id, club_id=club["id"], role="member"))
    session.commit()

    r = client.put(
        f"/clubs/{club['id']}",
        json={"name": "New Name"},
        headers=_club_headers(bob, club["id"]),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "FORBIDDEN_RANK"


def test_update_club_as_president_succeeds(client):
    token = _register(client)
    club = _create_club(client, token)

    r = client.put(
        f"/clubs/{club['id']}",
        json={"name": "Renamed Club", "is_public": False},
        headers=_club_headers(token, club["id"]),
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed Club"
    assert r.json()["is_public"] is False


def test_update_club_rejects_president_in_enabled_roles(client):
    token = _register(client)
    club = _create_club(client, token)

    r = client.put(
        f"/clubs/{club['id']}",
        json={"enabled_roles": ["president", "member"]},
        headers=_club_headers(token, club["id"]),
    )
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"
