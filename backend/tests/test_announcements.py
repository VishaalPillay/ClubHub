"""Announcements module tests — CRUD, role gating, scope filtering, and cross-tenant isolation."""


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
        json={"name": name, "enabled_roles": ["member", "lead", "vice_president"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()


def _create_domain(client, token, club_id, name="Tech"):
    r = client.post(
        f"/clubs/{club_id}/domains",
        json={"name": name},
        headers=_h(token, club_id),
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


# ── Create & list ─────────────────────────────────────────────────────────────

def test_vp_can_create_global_announcement(client):
    pres = _register(client, "pres@ann_gl.com", "President")
    club = _create_club(client, pres)
    cid = club["id"]

    r = client.post(
        f"/clubs/{cid}/announcements",
        json={"title": "Big news", "body": "Details here.", "type": "urgent", "scope": "global"},
        headers=_h(pres, cid),
    )
    assert r.status_code == 201, r.text
    ann = r.json()
    assert ann["title"] == "Big news"
    assert ann["scope"] == "global"
    assert ann["type"] == "urgent"
    assert ann["domain_id"] is None
    assert ann["author_name"] == "President"


def test_lead_can_create_domain_announcement(client):
    pres = _register(client, "pres@ann_dom.com", "President")
    lead_user = _register(client, "lead@ann_dom.com", "Lead")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    _approve_join(client, pres, cid, club["code"], lead_user, "lead", domain["id"])

    r = client.post(
        f"/clubs/{cid}/announcements",
        json={
            "title": "Domain news",
            "body": "For Tech only.",
            "scope": "domain",
            "domain_id": domain["id"],
        },
        headers=_h(lead_user, cid),
    )
    assert r.status_code == 201, r.text
    ann = r.json()
    assert ann["scope"] == "domain"
    assert ann["domain_id"] == domain["id"]
    assert ann["domain_name"] == "Tech"


def test_member_cannot_post_announcement(client):
    pres = _register(client, "pres@ann_mem.com", "President")
    mem = _register(client, "mem@ann_mem.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    _approve_join(client, pres, cid, club["code"], mem, "member", domain["id"])

    r = client.post(
        f"/clubs/{cid}/announcements",
        json={"title": "Nope", "body": "Rejected.", "scope": "global"},
        headers=_h(mem, cid),
    )
    assert r.status_code == 403


def test_lead_cannot_post_global_announcement(client):
    pres = _register(client, "pres@ann_ldg.com", "President")
    lead_user = _register(client, "lead@ann_ldg.com", "Lead")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    _approve_join(client, pres, cid, club["code"], lead_user, "lead", domain["id"])

    r = client.post(
        f"/clubs/{cid}/announcements",
        json={"title": "Too broad", "body": "Lead can't go global.", "scope": "global"},
        headers=_h(lead_user, cid),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "VP_REQUIRED_FOR_GLOBAL"


def test_lead_cannot_post_in_wrong_domain(client):
    pres = _register(client, "pres@ann_ld2.com", "President")
    lead_user = _register(client, "lead@ann_ld2.com", "Lead")
    club = _create_club(client, pres)
    cid = club["id"]
    domain_a = _create_domain(client, pres, cid, "Domain A")
    domain_b = _create_domain(client, pres, cid, "Domain B")

    _approve_join(client, pres, cid, club["code"], lead_user, "lead", domain_a["id"])

    r = client.post(
        f"/clubs/{cid}/announcements",
        json={
            "title": "Cross-domain",
            "body": "Should fail.",
            "scope": "domain",
            "domain_id": domain_b["id"],
        },
        headers=_h(lead_user, cid),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "WRONG_DOMAIN"


def test_domain_announcement_requires_domain_id(client):
    pres = _register(client, "pres@ann_nod.com", "President")
    club = _create_club(client, pres)
    cid = club["id"]

    r = client.post(
        f"/clubs/{cid}/announcements",
        json={"title": "Missing domain", "body": "No domain_id.", "scope": "domain"},
        headers=_h(pres, cid),
    )
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"


def test_list_announcements(client):
    pres = _register(client, "pres@ann_list.com", "President")
    club = _create_club(client, pres)
    cid = club["id"]

    client.post(
        f"/clubs/{cid}/announcements",
        json={"title": "First", "body": "Body 1.", "scope": "global"},
        headers=_h(pres, cid),
    )
    client.post(
        f"/clubs/{cid}/announcements",
        json={"title": "Second", "body": "Body 2.", "scope": "global"},
        headers=_h(pres, cid),
    )

    r = client.get(f"/clubs/{cid}/announcements", headers=_h(pres, cid))
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 2
    # Newest first
    titles = [i["title"] for i in items]
    assert titles.index("Second") < titles.index("First")


# ── Scope-based read filtering ─────────────────────────────────────────────────

def test_member_sees_global_and_own_domain_only(client):
    pres = _register(client, "pres@ann_flt.com", "President")
    mem = _register(client, "mem@ann_flt.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain_a = _create_domain(client, pres, cid, "Domain A")
    domain_b = _create_domain(client, pres, cid, "Domain B")

    _approve_join(client, pres, cid, club["code"], mem, "member", domain_a["id"])

    # Global announcement
    client.post(
        f"/clubs/{cid}/announcements",
        json={"title": "Global", "body": "Everyone.", "scope": "global"},
        headers=_h(pres, cid),
    )
    # Domain A announcement (member's domain)
    client.post(
        f"/clubs/{cid}/announcements",
        json={"title": "Domain A news", "body": "A only.", "scope": "domain", "domain_id": domain_a["id"]},
        headers=_h(pres, cid),
    )
    # Domain B announcement (not the member's domain)
    client.post(
        f"/clubs/{cid}/announcements",
        json={"title": "Domain B secret", "body": "B only.", "scope": "domain", "domain_id": domain_b["id"]},
        headers=_h(pres, cid),
    )

    r = client.get(f"/clubs/{cid}/announcements", headers=_h(mem, cid))
    assert r.status_code == 200
    titles = {item["title"] for item in r.json()}
    assert "Global" in titles
    assert "Domain A news" in titles
    assert "Domain B secret" not in titles


def test_vp_sees_all_announcements(client):
    pres = _register(client, "pres@ann_vpa.com", "President")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    client.post(
        f"/clubs/{cid}/announcements",
        json={"title": "Global", "body": "All.", "scope": "global"},
        headers=_h(pres, cid),
    )
    client.post(
        f"/clubs/{cid}/announcements",
        json={"title": "Domain news", "body": "Domain.", "scope": "domain", "domain_id": domain["id"]},
        headers=_h(pres, cid),
    )

    r = client.get(f"/clubs/{cid}/announcements", headers=_h(pres, cid))
    assert r.status_code == 200
    titles = {item["title"] for item in r.json()}
    assert "Global" in titles
    assert "Domain news" in titles


# ── Update & delete ───────────────────────────────────────────────────────────

def test_author_can_update_own_announcement(client):
    pres = _register(client, "pres@ann_upd.com", "President")
    club = _create_club(client, pres)
    cid = club["id"]

    ann = client.post(
        f"/clubs/{cid}/announcements",
        json={"title": "Old title", "body": "Old body.", "scope": "global"},
        headers=_h(pres, cid),
    ).json()

    r = client.put(
        f"/clubs/{cid}/announcements/{ann['id']}",
        json={"title": "New title", "type": "urgent"},
        headers=_h(pres, cid),
    )
    assert r.status_code == 200
    updated = r.json()
    assert updated["title"] == "New title"
    assert updated["type"] == "urgent"
    assert updated["body"] == "Old body."  # unchanged


def test_author_can_delete_own_announcement(client):
    pres = _register(client, "pres@ann_del.com", "President")
    club = _create_club(client, pres)
    cid = club["id"]

    ann = client.post(
        f"/clubs/{cid}/announcements",
        json={"title": "Delete me", "body": ".", "scope": "global"},
        headers=_h(pres, cid),
    ).json()

    r = client.delete(f"/clubs/{cid}/announcements/{ann['id']}", headers=_h(pres, cid))
    assert r.status_code == 204

    r2 = client.get(f"/clubs/{cid}/announcements", headers=_h(pres, cid))
    assert all(item["id"] != ann["id"] for item in r2.json())


def test_non_author_member_cannot_modify(client):
    pres = _register(client, "pres@ann_nmod.com", "President")
    mem = _register(client, "mem@ann_nmod.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    _approve_join(client, pres, cid, club["code"], mem, "member", domain["id"])

    ann = client.post(
        f"/clubs/{cid}/announcements",
        json={"title": "Hands off", "body": ".", "scope": "global"},
        headers=_h(pres, cid),
    ).json()

    r_put = client.put(
        f"/clubs/{cid}/announcements/{ann['id']}",
        json={"title": "Hijack"},
        headers=_h(mem, cid),
    )
    assert r_put.status_code == 403
    assert r_put.json()["code"] == "FORBIDDEN_ANNOUNCEMENT"

    r_del = client.delete(
        f"/clubs/{cid}/announcements/{ann['id']}",
        headers=_h(mem, cid),
    )
    assert r_del.status_code == 403
    assert r_del.json()["code"] == "FORBIDDEN_ANNOUNCEMENT"


def test_vp_can_delete_other_authors_announcement(client):
    """A VP+ can moderate any announcement, even if they didn't author it."""
    pres = _register(client, "pres@ann_vpmod.com", "President")
    vp_user = _register(client, "vp@ann_vpmod.com", "VP")
    club = _create_club(client, pres)
    cid = club["id"]

    _approve_join(client, pres, cid, club["code"], vp_user, "vice_president")

    ann = client.post(
        f"/clubs/{cid}/announcements",
        json={"title": "Moderate me", "body": ".", "scope": "global"},
        headers=_h(pres, cid),
    ).json()

    r = client.delete(f"/clubs/{cid}/announcements/{ann['id']}", headers=_h(vp_user, cid))
    assert r.status_code == 204


# ── Cross-tenant isolation ────────────────────────────────────────────────────

def test_announcement_cross_tenant_denied(client):
    """A member of club A cannot see announcements from club B."""
    alice = _register(client, "alice@ann_ct.com", "Alice")
    bob = _register(client, "bob@ann_ct.com", "Bob")

    _create_club(client, alice, "Club A")
    club_b = _create_club(client, bob, "Club B")

    client.post(
        f"/clubs/{club_b['id']}/announcements",
        json={"title": "Club B secret", "body": ".", "scope": "global"},
        headers=_h(bob, club_b["id"]),
    )

    r = client.get(
        f"/clubs/{club_b['id']}/announcements",
        headers=_h(alice, club_b["id"]),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "NOT_A_MEMBER"
