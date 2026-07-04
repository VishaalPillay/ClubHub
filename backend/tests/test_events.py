"""Events module tests — CRUD role gating, RSVP idempotency, and cross-tenant isolation."""


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
        json={
            "name": name,
            "enabled_roles": ["member", "lead", "joint_secretary", "vice_president"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()


def _h(token: str, club_id: int) -> dict:
    return {"Authorization": f"Bearer {token}", "X-Club-ID": str(club_id)}


def _approve_join(client, pres_token, club_id, club_code, user_token, role, domain_id=None):
    """Submit a join request and approve it. Returns the new member's user_id."""
    r = client.post(
        "/clubs/join",
        json={"club_code": club_code, "requested_role": role, "requested_domain_id": domain_id},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert r.status_code == 201, r.text
    approved = client.put(
        f"/clubs/{club_id}/requests/{r.json()['id']}/approve",
        json={},
        headers=_h(pres_token, club_id),
    )
    assert approved.status_code == 200, approved.text
    return approved.json()["user_id"]


def _create_domain(client, token, club_id, name="Tech"):
    r = client.post(
        f"/clubs/{club_id}/domains",
        json={"name": name},
        headers=_h(token, club_id),
    )
    assert r.status_code == 201, r.text
    return r.json()


def _create_event(client, token, club_id, title="Demo Event", event_type="workshop", **extra):
    r = client.post(
        f"/clubs/{club_id}/events",
        json={"title": title, "type": event_type, **extra},
        headers=_h(token, club_id),
    )
    return r


# ── Create & role gating ──────────────────────────────────────────────────────

def test_president_can_create_event(client):
    pres = _register(client, "pres@ev-create.com", "President")
    club = _create_club(client, pres)
    cid = club["id"]

    r = _create_event(
        client,
        pres,
        cid,
        title="Winter Buildthon",
        event_type="hackathon",
        description="12-hour hackathon.",
        event_date="2026-08-15",
        event_time="09:00:00",
        location="Auditorium",
    )
    assert r.status_code == 201, r.text
    event = r.json()
    assert event["title"] == "Winter Buildthon"
    assert event["type"] == "hackathon"
    assert event["status"] == "upcoming"
    assert event["attendees"] == 0
    assert event["my_rsvp"] is False
    assert event["creator_name"] == "President"


def test_lead_cannot_create_event(client):
    pres = _register(client, "pres@ev-lead.com", "President")
    lead = _register(client, "lead@ev-lead.com", "Lead")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)
    _approve_join(client, pres, cid, club["code"], lead, "lead", domain["id"])

    r = _create_event(client, lead, cid)
    assert r.status_code == 403, r.text
    assert r.json()["code"] == "FORBIDDEN_RANK"


def test_joint_secretary_can_create_event(client):
    pres = _register(client, "pres@ev-js.com", "President")
    jsec = _register(client, "jsec@ev-js.com", "JSec")
    club = _create_club(client, pres)
    cid = club["id"]
    _approve_join(client, pres, cid, club["code"], jsec, "joint_secretary")

    r = _create_event(client, jsec, cid)
    assert r.status_code == 201, r.text


def test_bad_event_type_is_422(client):
    pres = _register(client, "pres@ev-type.com", "President")
    club = _create_club(client, pres)

    r = _create_event(client, pres, club["id"], event_type="party")
    assert r.status_code == 422, r.text
    assert r.json()["code"] == "VALIDATION_ERROR"


# ── List & filter ─────────────────────────────────────────────────────────────

def test_member_can_list_events_with_status_filter(client):
    pres = _register(client, "pres@ev-list.com", "President")
    member = _register(client, "member@ev-list.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)
    _approve_join(client, pres, cid, club["code"], member, "member", domain["id"])

    upcoming = _create_event(client, pres, cid, title="Upcoming").json()
    past = _create_event(client, pres, cid, title="Past").json()
    r = client.put(
        f"/clubs/{cid}/events/{past['id']}",
        json={"status": "past"},
        headers=_h(pres, cid),
    )
    assert r.status_code == 200, r.text

    all_events = client.get(f"/clubs/{cid}/events", headers=_h(member, cid))
    assert all_events.status_code == 200, all_events.text
    assert {e["id"] for e in all_events.json()} == {upcoming["id"], past["id"]}

    only_past = client.get(f"/clubs/{cid}/events?status=past", headers=_h(member, cid))
    assert [e["id"] for e in only_past.json()] == [past["id"]]


# ── RSVP ──────────────────────────────────────────────────────────────────────

def test_rsvp_and_unrsvp_are_idempotent(client):
    pres = _register(client, "pres@ev-rsvp.com", "President")
    member = _register(client, "member@ev-rsvp.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)
    _approve_join(client, pres, cid, club["code"], member, "member", domain["id"])
    event = _create_event(client, pres, cid).json()
    eid = event["id"]

    # Member RSVPs.
    r = client.post(f"/clubs/{cid}/events/{eid}/rsvp", headers=_h(member, cid))
    assert r.status_code == 200, r.text
    assert r.json()["attendees"] == 1
    assert r.json()["my_rsvp"] is True

    # Double RSVP is a no-op.
    r = client.post(f"/clubs/{cid}/events/{eid}/rsvp", headers=_h(member, cid))
    assert r.json()["attendees"] == 1

    # Second attendee.
    r = client.post(f"/clubs/{cid}/events/{eid}/rsvp", headers=_h(pres, cid))
    assert r.json()["attendees"] == 2

    # The member's flag is per-caller.
    listed = client.get(f"/clubs/{cid}/events", headers=_h(member, cid)).json()
    assert listed[0]["my_rsvp"] is True

    # Un-RSVP decrements once, then no-ops.
    r = client.delete(f"/clubs/{cid}/events/{eid}/rsvp", headers=_h(member, cid))
    assert r.status_code == 200, r.text
    assert r.json()["attendees"] == 1
    assert r.json()["my_rsvp"] is False
    r = client.delete(f"/clubs/{cid}/events/{eid}/rsvp", headers=_h(member, cid))
    assert r.json()["attendees"] == 1


# ── Update & delete ───────────────────────────────────────────────────────────

def test_member_cannot_update_or_delete_event(client):
    pres = _register(client, "pres@ev-gate.com", "President")
    member = _register(client, "member@ev-gate.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)
    _approve_join(client, pres, cid, club["code"], member, "member", domain["id"])
    event = _create_event(client, pres, cid).json()

    r = client.put(
        f"/clubs/{cid}/events/{event['id']}",
        json={"title": "Hijacked"},
        headers=_h(member, cid),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "FORBIDDEN_RANK"

    r = client.delete(f"/clubs/{cid}/events/{event['id']}", headers=_h(member, cid))
    assert r.status_code == 403


def test_update_delete_and_missing_event_404(client):
    pres = _register(client, "pres@ev-crud.com", "President")
    club = _create_club(client, pres)
    cid = club["id"]
    event = _create_event(client, pres, cid).json()

    r = client.put(
        f"/clubs/{cid}/events/{event['id']}",
        json={"title": "Renamed", "location": "Lab 3A"},
        headers=_h(pres, cid),
    )
    assert r.status_code == 200, r.text
    assert r.json()["title"] == "Renamed"
    assert r.json()["location"] == "Lab 3A"

    r = client.delete(f"/clubs/{cid}/events/{event['id']}", headers=_h(pres, cid))
    assert r.status_code == 204, r.text

    r = client.put(
        f"/clubs/{cid}/events/{event['id']}",
        json={"title": "Ghost"},
        headers=_h(pres, cid),
    )
    assert r.status_code == 404
    assert r.json()["code"] == "EVENT_NOT_FOUND"


# ── Tenant isolation ──────────────────────────────────────────────────────────

def test_event_cross_tenant_denied(client):
    alice = _register(client, "alice@ev-tenant.com", "Alice")
    bob = _register(client, "bob@ev-tenant.com", "Bob")
    club_a = _create_club(client, alice, "Club A")
    club_b = _create_club(client, bob, "Club B")
    _create_event(client, bob, club_b["id"])

    # Alice is not a member of Club B — header pointing at B must be rejected.
    r = client.get(f"/clubs/{club_b['id']}/events", headers=_h(alice, club_b["id"]))
    assert r.status_code == 403
    assert r.json()["code"] == "NOT_A_MEMBER"

    # Forged path: Alice's own club header but Club B in the path.
    r = client.get(f"/clubs/{club_b['id']}/events", headers=_h(alice, club_a["id"]))
    assert r.status_code == 400
    assert r.json()["code"] == "CLUB_ID_MISMATCH"
