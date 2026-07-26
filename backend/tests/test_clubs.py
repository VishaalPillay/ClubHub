"""Clubs vertical-slice tests: create, my, lookup, join flow, withdraw, detail."""

import re

from sqlmodel import select

from app.models import Club, ClubMember, Domain, Task

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
        enabled_roles = [
            "member", "associate", "lead", "joint_secretary", "secretary", "vice_president",
        ]
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
    club = _create_club(client, token)  # visibility defaults to "public"

    r = client.get("/clubs/directory", headers=_auth(token))
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()]
    assert club["id"] in ids


def test_directory_excludes_code(client):
    """The public directory must not leak the club join code (it's an invite secret)."""
    token = _register(client)
    club = _create_club(client, token)

    r = client.get("/clubs/directory", headers=_auth(token))
    assert r.status_code == 200
    item = next(c for c in r.json() if c["id"] == club["id"])
    assert "code" not in item
    assert item["name"] == club["name"]


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
        json={
            "club_code": club["code"],
            "requested_role": "member",
            "requested_domain_id": domain.id,
        },
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
        json={
            "club_code": club["code"],
            "requested_role": "member",
            "requested_domain_id": domain.id,
        },
        headers=_auth(bob),
    )

    r = client.get("/clubs/pending", headers=_auth(bob))
    assert r.status_code == 200
    pending = r.json()
    assert len(pending) == 1
    assert pending[0]["club_name"] == club["name"]
    assert "code" not in pending[0]  # invite secret — not owed to a non-member
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
        json={
            "club_code": club["code"],
            "requested_role": "member",
            "requested_domain_id": domain.id,
        },
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
        json={
            "club_code": club["code"],
            "requested_role": "member",
            "requested_domain_id": domain.id,
        },
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
        json={"name": "Renamed Club", "visibility": "unlisted", "accepting_requests": False},
        headers=_club_headers(token, club["id"]),
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed Club"
    assert r.json()["visibility"] == "unlisted"
    assert r.json()["accepting_requests"] is False


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


# ── FK on-delete behaviour ────────────────────────────────────────────────────

def test_delete_club_cascades_children(client, session):
    """Deleting a club CASCADE-removes its domains, members, and tasks.

    There is no delete-club endpoint, so the DB-level cascade is exercised directly via
    the ORM (models define no relationships, so this issues a single DELETE and Postgres
    cascades the children).
    """
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice)
    alice_id = _user_id(client, alice)
    bob_id = _user_id(client, bob)

    domain = Domain(club_id=club["id"], name="Engineering")
    session.add(domain)
    session.commit()
    session.refresh(domain)

    session.add(
        ClubMember(user_id=bob_id, club_id=club["id"], role="member", domain_id=domain.id)
    )
    session.add(
        Task(club_id=club["id"], domain_id=domain.id, title="Ship it", creator_id=alice_id)
    )
    session.commit()

    session.delete(session.get(Club, club["id"]))
    session.commit()

    session.expire_all()
    assert session.exec(select(Domain).where(Domain.club_id == club["id"])).all() == []
    assert session.exec(select(ClubMember).where(ClubMember.club_id == club["id"])).all() == []
    assert session.exec(select(Task).where(Task.club_id == club["id"])).all() == []


# ── Invite-code visibility (the code is a secret, not member-wide info) ────────

def _add_member(session, client, token, club_id, role, domain_id=None):
    session.add(
        ClubMember(
            user_id=_user_id(client, token), club_id=club_id, role=role, domain_id=domain_id
        )
    )
    session.commit()


def test_my_clubs_hides_code_from_low_ranks(client, session):
    """member / associate / lead must not see the club invite code via /clubs/my."""
    alice = _register(client, "alice@example.com")
    club = _create_club(client, alice)

    for idx, role in enumerate(("member", "associate", "lead")):
        token = _register(client, f"{role}@example.com", name=role.title())
        _add_member(session, client, token, club["id"], role)

        r = client.get("/clubs/my", headers=_auth(token))
        assert r.status_code == 200, r.text
        entry = next(c for c in r.json() if c["id"] == club["id"])
        assert entry["role"] == role
        assert entry["code"] is None, f"{role} must not see the invite code (idx {idx})"


def test_my_clubs_shows_code_to_joint_secretary_and_above(client, session):
    """Joint-Secretary+ can hand the code out, so they still see it."""
    alice = _register(client, "alice@example.com")
    club = _create_club(client, alice)

    # The creator is president — highest rank, sees the code.
    mine = client.get("/clubs/my", headers=_auth(alice)).json()
    assert next(c for c in mine if c["id"] == club["id"])["code"] == club["code"]

    for role in ("joint_secretary", "secretary", "vice_president"):
        token = _register(client, f"{role}@example.com", name=role.title())
        _add_member(session, client, token, club["id"], role)

        entry = next(
            c for c in client.get("/clubs/my", headers=_auth(token)).json()
            if c["id"] == club["id"]
        )
        assert entry["code"] == club["code"], f"{role} should see the invite code"


def test_club_detail_requires_vice_president(client, session):
    """GET /clubs/{id} carries the code, so it's an executive view (VP+), not member-wide."""
    alice = _register(client, "alice@example.com")
    bob = _register(client, "bob@example.com", name="Bob")
    club = _create_club(client, alice)
    _add_member(session, client, bob, club["id"], "lead")

    r = client.get(f"/clubs/{club['id']}", headers=_club_headers(bob, club["id"]))
    assert r.status_code == 403
    assert r.json()["code"] == "FORBIDDEN_RANK"


# ── Directory visibility tiers ─────────────────────────────────────────────────

def _create_club_with(client, token, name, institution=None, enabled_roles=None):
    r = client.post(
        "/clubs",
        json={
            "name": name,
            "description": "A test club.",
            "institution": institution,
            "enabled_roles": enabled_roles if enabled_roles is not None else ["member"],
        },
        headers=_auth(token),
    )
    assert r.status_code == 201, r.text
    return r.json()


def _set_visibility(client, token, club, **changes):
    r = client.put(f"/clubs/{club['id']}", json=changes, headers=_club_headers(token, club["id"]))
    assert r.status_code == 200, r.text
    return r.json()


def test_directory_excludes_unlisted_clubs(client):
    alice = _register(client, "alice@example.com")
    club = _create_club(client, alice)
    _set_visibility(client, alice, club, visibility="unlisted")

    bob = _register(client, "bob@example.com", name="Bob")
    ids = [c["id"] for c in client.get("/clubs/directory", headers=_auth(bob)).json()]
    assert club["id"] not in ids


def test_directory_institution_scope_matches_viewer(client):
    """An institution-scoped club is listed only for viewers from that institution."""
    alice = _register(client, "alice@example.com")
    club = _create_club_with(client, alice, "SRM Coders", institution="SRM")
    _set_visibility(client, alice, club, visibility="institution")

    # Same institution -> visible.
    insider = _register(client, "insider@example.com", name="Insider")
    client.put("/users/me", json={"institution": "SRM"}, headers=_auth(insider))
    ids = [c["id"] for c in client.get("/clubs/directory", headers=_auth(insider)).json()]
    assert club["id"] in ids

    # Different institution -> hidden.
    outsider = _register(client, "outsider@example.com", name="Outsider")
    client.put("/users/me", json={"institution": "Other Uni"}, headers=_auth(outsider))
    ids = [c["id"] for c in client.get("/clubs/directory", headers=_auth(outsider)).json()]
    assert club["id"] not in ids

    # No institution on the profile at all -> hidden.
    anon = _register(client, "anon@example.com", name="Anon")
    ids = [c["id"] for c in client.get("/clubs/directory", headers=_auth(anon)).json()]
    assert club["id"] not in ids


def test_directory_reports_accepting_requests(client):
    alice = _register(client, "alice@example.com")
    club = _create_club(client, alice)
    _set_visibility(client, alice, club, accepting_requests=False)

    bob = _register(client, "bob@example.com", name="Bob")
    entry = next(
        c for c in client.get("/clubs/directory", headers=_auth(bob)).json()
        if c["id"] == club["id"]
    )
    assert entry["accepting_requests"] is False


# ── Join-path enforcement (visibility is access control, not just display) ─────

def test_join_by_id_rejected_for_unlisted_club(client, session):
    """A copy-pasted club id must not bypass 'unlisted' — the code is the only way in."""
    alice = _register(client, "alice@example.com")
    club = _create_club(client, alice, enabled_roles=["member"])
    domain = Domain(club_id=club["id"], name="Dev")
    session.add(domain)
    session.commit()
    session.refresh(domain)
    _set_visibility(client, alice, club, visibility="unlisted")

    bob = _register(client, "bob@example.com", name="Bob")
    r = client.post(
        "/clubs/join",
        json={"club_id": club["id"], "requested_role": "member",
              "requested_domain_id": domain.id},
        headers=_auth(bob),
    )
    assert r.status_code == 404
    assert r.json()["code"] == "CLUB_NOT_FOUND"


def test_join_by_code_still_works_for_unlisted_club(client, session):
    """Holding the invite code IS the authorization — visibility doesn't block it."""
    alice = _register(client, "alice@example.com")
    club = _create_club(client, alice, enabled_roles=["member"])
    domain = Domain(club_id=club["id"], name="Dev")
    session.add(domain)
    session.commit()
    session.refresh(domain)
    _set_visibility(client, alice, club, visibility="unlisted")

    bob = _register(client, "bob@example.com", name="Bob")
    r = client.post(
        "/clubs/join",
        json={"club_code": club["code"], "requested_role": "member",
              "requested_domain_id": domain.id},
        headers=_auth(bob),
    )
    assert r.status_code == 201, r.text


def test_join_by_id_enforces_institution_scope(client, session):
    """Institution scoping is real access control on the join endpoint, not a UI filter."""
    alice = _register(client, "alice@example.com")
    club = _create_club_with(client, alice, "SRM Coders", institution="SRM")
    domain = Domain(club_id=club["id"], name="Dev")
    session.add(domain)
    session.commit()
    session.refresh(domain)
    _set_visibility(client, alice, club, visibility="institution")

    payload = {
        "club_id": club["id"],
        "requested_role": "member",
        "requested_domain_id": domain.id,
    }

    outsider = _register(client, "outsider@example.com", name="Outsider")
    client.put("/users/me", json={"institution": "Other Uni"}, headers=_auth(outsider))
    r = client.post("/clubs/join", json=payload, headers=_auth(outsider))
    assert r.status_code == 404
    assert r.json()["code"] == "CLUB_NOT_FOUND"

    insider = _register(client, "insider@example.com", name="Insider")
    client.put("/users/me", json={"institution": "SRM"}, headers=_auth(insider))
    r = client.post("/clubs/join", json=payload, headers=_auth(insider))
    assert r.status_code == 201, r.text


def test_join_blocked_when_not_accepting_requests(client, session):
    """Intake paused blocks BOTH paths — including a valid invite code."""
    alice = _register(client, "alice@example.com")
    club = _create_club(client, alice, enabled_roles=["member"])
    domain = Domain(club_id=club["id"], name="Dev")
    session.add(domain)
    session.commit()
    session.refresh(domain)
    _set_visibility(client, alice, club, accepting_requests=False)

    bob = _register(client, "bob@example.com", name="Bob")
    for identifier in ({"club_id": club["id"]}, {"club_code": club["code"]}):
        r = client.post(
            "/clubs/join",
            json={**identifier, "requested_role": "member",
                  "requested_domain_id": domain.id},
            headers=_auth(bob),
        )
        assert r.status_code == 403, r.text
        assert r.json()["code"] == "CLUB_NOT_RECRUITING"


def test_update_club_rejects_invalid_visibility(client):
    token = _register(client)
    club = _create_club(client, token)

    r = client.put(
        f"/clubs/{club['id']}",
        json={"visibility": "everyone"},
        headers=_club_headers(token, club["id"]),
    )
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"
