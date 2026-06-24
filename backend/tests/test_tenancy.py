"""Cross-club isolation tests.

Data-model invariant (original): proves get_club_context's foundation — a user's
ClubMember row is scoped per club, so membership in A cannot leak into B.

HTTP-level assertions (added with clubs/domains slice): proves the application
layer enforces the same boundary. A member of club A cannot read or write club B's
resources, and a forged path/context mismatch is rejected before any DB work.
"""

from sqlmodel import select

from app.models import Club, ClubMember, User

# ── Helpers ───────────────────────────────────────────────────────────────────

def _register(client, email, name="User"):
    r = client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": "password123"},
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _create_club(client, token, name="Club"):
    r = client.post(
        "/clubs",
        json={"name": name, "enabled_roles": ["member", "vice_president"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()


def _club_headers(token: str, club_id: int) -> dict:
    return {"Authorization": f"Bearer {token}", "X-Club-ID": str(club_id)}


# ── Original data-model invariant ────────────────────────────────────────────

def test_membership_is_scoped_per_club(session):
    """get_club_context relies on this: no ClubMember row leaks between clubs."""
    user = User(name="Bob", email="bob@example.com", password_hash="x")
    session.add(user)
    session.commit()
    session.refresh(user)

    club_a = Club(name="Club A", code="AAA-0001", owner_id=user.id)
    club_b = Club(name="Club B", code="BBB-0002", owner_id=user.id)
    session.add(club_a)
    session.add(club_b)
    session.commit()
    session.refresh(club_a)
    session.refresh(club_b)

    session.add(ClubMember(user_id=user.id, club_id=club_a.id, role="member"))
    session.commit()

    in_a = session.exec(
        select(ClubMember).where(
            ClubMember.user_id == user.id, ClubMember.club_id == club_a.id
        )
    ).first()
    in_b = session.exec(
        select(ClubMember).where(
            ClubMember.user_id == user.id, ClubMember.club_id == club_b.id
        )
    ).first()

    assert in_a is not None and in_a.role == "member"
    assert in_b is None  # the isolation invariant: no leakage into club B


# ── HTTP-level cross-tenant denial ────────────────────────────────────────────

def test_member_of_a_cannot_read_club_b_domains(client):
    """Alice belongs to club A only. GET /clubs/{B}/domains with X-Club-ID: B → 403."""
    alice = _register(client, "alice@example.com", "Alice")
    bob = _register(client, "bob@example.com", "Bob")

    _create_club(client, alice, "Club A")
    club_b = _create_club(client, bob, "Club B")

    r = client.get(
        f"/clubs/{club_b['id']}/domains",
        headers=_club_headers(alice, club_b["id"]),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "NOT_A_MEMBER"


def test_nonmember_cannot_get_club_detail(client):
    """Alice not in club B. GET /clubs/{B} with X-Club-ID: B → 403."""
    alice = _register(client, "alice@example.com", "Alice")
    bob = _register(client, "bob@example.com", "Bob")

    _create_club(client, alice, "Club A")
    club_b = _create_club(client, bob, "Club B")

    r = client.get(
        f"/clubs/{club_b['id']}",
        headers=_club_headers(alice, club_b["id"]),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "NOT_A_MEMBER"


def test_forged_path_club_id_rejected(client):
    """Alice's X-Club-ID is A (valid), but the URL path targets B → 400 CLUB_ID_MISMATCH.

    This is the core write-safety guard: even if Alice has high authority in club A,
    a mismatching path cannot route her write to club B.
    """
    alice = _register(client, "alice@example.com", "Alice")
    bob = _register(client, "bob@example.com", "Bob")

    club_a = _create_club(client, alice, "Club A")
    club_b = _create_club(client, bob, "Club B")

    # Alice is president of A (above VP), context resolves A correctly —
    # but the path says B. The mismatch guard fires before any DB write.
    r = client.post(
        f"/clubs/{club_b['id']}/domains",
        json={"name": "Injected Domain"},
        headers=_club_headers(alice, club_a["id"]),
    )
    assert r.status_code == 400
    assert r.json()["code"] == "CLUB_ID_MISMATCH"


def test_forged_club_detail_path_rejected(client):
    """PUT /clubs/{B} with X-Club-ID: A → 400 CLUB_ID_MISMATCH (not a write to B)."""
    alice = _register(client, "alice@example.com", "Alice")
    bob = _register(client, "bob@example.com", "Bob")

    club_a = _create_club(client, alice, "Club A")
    club_b = _create_club(client, bob, "Club B")

    r = client.put(
        f"/clubs/{club_b['id']}",
        json={"name": "Renamed by Alice"},
        headers=_club_headers(alice, club_a["id"]),
    )
    assert r.status_code == 400
    assert r.json()["code"] == "CLUB_ID_MISMATCH"
