"""Tasks module tests — CRUD, assignment, points awarding, and cross-tenant isolation."""

from sqlmodel import select

from app.models import ClubMember, PointsLedger

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
        json={"name": name, "enabled_roles": ["member", "lead"]},
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


def _approve_join(client, pres_token, club_id, club_code, user_token, role, domain_id):
    """Submit join request and have an approver accept it. Returns the new member's user_id."""
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


# ── CRUD ──────────────────────────────────────────────────────────────────────

def test_create_task_and_list(client):
    pres = _register(client, "pres@tasks.com", "President")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    r = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Write docs", "points": 20},
        headers=_h(pres, cid),
    )
    assert r.status_code == 201, r.text
    task = r.json()
    assert task["title"] == "Write docs"
    assert task["status"] == "todo"
    assert task["points"] == 20
    assert task["domain_name"] == "Tech"
    assert task["assignees"] == []

    r2 = client.get(f"/clubs/{cid}/tasks", headers=_h(pres, cid))
    assert r2.status_code == 200
    assert any(t["id"] == task["id"] for t in r2.json())


def test_create_task_rejects_off_scale_points(client):
    """Points are a fixed scale (5/10/20/50), not a free-form range."""
    pres = _register(client, "pres@offscale.com", "Pres")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    r = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Bad points", "points": 25},
        headers=_h(pres, cid),
    )
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"


def test_create_task_default_points(client):
    """No points supplied defaults to 10 — one of the allowed values."""
    pres = _register(client, "pres@defaultpts.com", "Pres")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    r = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Default points"},
        headers=_h(pres, cid),
    )
    assert r.status_code == 201, r.text
    assert r.json()["points"] == 10


def test_update_task_points(client):
    """Lead+ can change a task's points to another allowed value after creation."""
    pres = _register(client, "pres@updatepts.com", "Pres")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Reweigh me", "points": 10},
        headers=_h(pres, cid),
    ).json()

    r = client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"points": 50},
        headers=_h(pres, cid),
    )
    assert r.status_code == 200, r.text
    assert r.json()["points"] == 50


def test_update_task_rejects_off_scale_points(client):
    pres = _register(client, "pres@updatebad.com", "Pres")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Reweigh me badly", "points": 10},
        headers=_h(pres, cid),
    ).json()

    r = client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"points": 15},
        headers=_h(pres, cid),
    )
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR"


def test_member_cannot_update_task_points(client):
    """Changing points is a field edit — same Lead+/creator-hierarchy gate as title."""
    pres = _register(client, "pres@memberpts.com", "Pres")
    mem = _register(client, "mem@memberpts.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)
    mem_id = _approve_join(client, pres, cid, club["code"], mem, "member", domain["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Assigned task", "points": 10},
        headers=_h(pres, cid),
    ).json()
    client.post(
        f"/clubs/{cid}/tasks/{task['id']}/assign",
        json={"assignee_ids": [mem_id]},
        headers=_h(pres, cid),
    )

    r = client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"points": 50},
        headers=_h(mem, cid),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "LEAD_REQUIRED"


def test_create_task_requires_lead(client):
    """A member (below lead) cannot create a task."""
    pres = _register(client, "pres@lead.com", "President")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    # Register and manually add a member via the join flow.
    mem = _register(client, "mem@lead.com", "MemUser")

    # Join request
    r = client.post(
        "/clubs/join",
        json={
            "club_code": club["code"],
            "requested_role": "member",
            "requested_domain_id": domain["id"],
        },
        headers={"Authorization": f"Bearer {mem}"},
    )
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    client.put(
        f"/clubs/{cid}/requests/{rid}/approve",
        json={},
        headers=_h(pres, cid),
    )

    r2 = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Forbidden"},
        headers=_h(mem, cid),
    )
    assert r2.status_code == 403


def test_update_task_fields(client):
    pres = _register(client, "pres@upd.com", "Pres")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Old title"},
        headers=_h(pres, cid),
    ).json()

    r = client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"title": "New title", "status": "in_progress"},
        headers=_h(pres, cid),
    )
    assert r.status_code == 200
    updated = r.json()
    assert updated["title"] == "New title"
    assert updated["status"] == "in_progress"


def test_delete_task(client):
    pres = _register(client, "pres@del.com", "Pres")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Delete me"},
        headers=_h(pres, cid),
    ).json()

    r = client.delete(f"/clubs/{cid}/tasks/{task['id']}", headers=_h(pres, cid))
    assert r.status_code == 204

    r2 = client.get(f"/clubs/{cid}/tasks", headers=_h(pres, cid))
    assert all(t["id"] != task["id"] for t in r2.json())


# ── Assignment ────────────────────────────────────────────────────────────────

def test_assign_task(client):
    pres = _register(client, "pres@assign.com", "Pres")
    mem = _register(client, "mem@assign.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    mem_user_id = _approve_join(client, pres, cid, club["code"], mem, "member", domain["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Assign test", "points": 50},
        headers=_h(pres, cid),
    ).json()

    r2 = client.post(
        f"/clubs/{cid}/tasks/{task['id']}/assign",
        json={"assignee_ids": [mem_user_id]},
        headers=_h(pres, cid),
    )
    assert r2.status_code == 200
    assert any(a["id"] == mem_user_id for a in r2.json()["assignees"])


def test_assign_nonmember_rejected(client):
    pres = _register(client, "pres@noass.com", "Pres")
    outsider = _register(client, "out@noass.com", "Out")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Bad assign"},
        headers=_h(pres, cid),
    ).json()

    # Decode outsider's user_id by registering and checking /auth/me
    me_r = client.get("/auth/me", headers={"Authorization": f"Bearer {outsider}"})
    outsider_id = me_r.json()["id"]

    r = client.post(
        f"/clubs/{cid}/tasks/{task['id']}/assign",
        json={"assignee_ids": [outsider_id]},
        headers=_h(pres, cid),
    )
    assert r.status_code == 422
    assert r.json()["code"] == "NOT_MEMBERS"


# ── Points awarding ───────────────────────────────────────────────────────────

def test_completion_awards_points_to_assignees(client, session):
    pres = _register(client, "pres@pts.com", "Pres")
    mem = _register(client, "mem@pts.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    mem_user_id = _approve_join(client, pres, cid, club["code"], mem, "member", domain["id"])

    # Create and assign task (50 points)
    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Point task", "points": 50},
        headers=_h(pres, cid),
    ).json()
    client.post(
        f"/clubs/{cid}/tasks/{task['id']}/assign",
        json={"assignee_ids": [mem_user_id]},
        headers=_h(pres, cid),
    )

    # Mark completed (Lead+ = president)
    r2 = client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"status": "completed"},
        headers=_h(pres, cid),
    )
    assert r2.status_code == 200, r2.text

    # points_ledger has an entry
    ledger = session.exec(
        select(PointsLedger).where(
            PointsLedger.task_id == task["id"],
            PointsLedger.user_id == mem_user_id,
        )
    ).first()
    assert ledger is not None
    assert ledger.delta == 50

    # club_members.points is updated
    membership = session.exec(
        select(ClubMember).where(
            ClubMember.user_id == mem_user_id,
            ClubMember.club_id == cid,
        )
    ).first()
    assert membership is not None
    assert membership.points == 50


def test_completion_is_idempotent(client, session):
    """Re-completing a task (reopen → complete) awards points exactly once."""
    pres = _register(client, "pres@idem.com", "Pres")
    mem = _register(client, "mem@idem.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    mem_user_id = _approve_join(client, pres, cid, club["code"], mem, "member", domain["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Idempotent", "points": 20},
        headers=_h(pres, cid),
    ).json()
    client.post(
        f"/clubs/{cid}/tasks/{task['id']}/assign",
        json={"assignee_ids": [mem_user_id]},
        headers=_h(pres, cid),
    )

    # Complete → reopen → complete again
    url = f"/clubs/{cid}/tasks/{task['id']}"
    client.put(url, json={"status": "completed"}, headers=_h(pres, cid))
    client.put(url, json={"status": "todo"}, headers=_h(pres, cid))
    client.put(url, json={"status": "completed"}, headers=_h(pres, cid))

    # Only one ledger entry
    entries = session.exec(
        select(PointsLedger).where(
            PointsLedger.task_id == task["id"],
            PointsLedger.user_id == mem_user_id,
        )
    ).all()
    assert len(entries) == 1

    membership = session.exec(
        select(ClubMember).where(
            ClubMember.user_id == mem_user_id,
            ClubMember.club_id == cid,
        )
    ).first()
    assert membership.points == 20  # awarded once


def test_member_cannot_complete_task(client):
    """A member below Lead must not be able to mark a task completed."""
    pres = _register(client, "pres@nocomp.com", "Pres")
    mem = _register(client, "mem@nocomp.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    _approve_join(client, pres, cid, club["code"], mem, "member", domain["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Cannot complete"},
        headers=_h(pres, cid),
    ).json()

    r2 = client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"status": "completed"},
        headers=_h(mem, cid),
    )
    assert r2.status_code == 403
    assert r2.json()["code"] == "LEAD_REQUIRED_FOR_COMPLETION"


# ── Leaderboard ───────────────────────────────────────────────────────────────

def test_leaderboard_sorted_by_points(client):
    pres = _register(client, "pres@lb.com", "Pres")
    mem = _register(client, "mem@lb.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid, "LBDomain")

    _approve_join(client, pres, cid, club["code"], mem, "member", domain["id"])

    r = client.get(f"/clubs/{cid}/leaderboard", headers=_h(pres, cid))
    assert r.status_code == 200
    entries = r.json()
    # The president is a Head, excluded from the competition entirely.
    assert len(entries) >= 1
    assert entries[0]["rank"] == 1
    assert "points" in entries[0]
    # Verify ordering
    points = [e["points"] for e in entries]
    assert points == sorted(points, reverse=True)


def test_leaderboard_excludes_heads(client):
    """Heads (lead and up) don't compete for rank — a club with none yet should just
    show an empty board rather than pinning the president at 0 pts."""
    pres = _register(client, "pres@lbh.com", "Pres")
    club = _create_club(client, pres)
    cid = club["id"]

    r = client.get(f"/clubs/{cid}/leaderboard", headers=_h(pres, cid))
    assert r.status_code == 200
    assert r.json() == []


def test_leaderboard_domain_filter(client):
    pres = _register(client, "pres@lbf.com", "Pres")
    mem = _register(client, "mem@lbf.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid, "FilterDomain")

    _approve_join(client, pres, cid, club["code"], mem, "member", domain["id"])

    # Domain filter — only the member in that domain
    r2 = client.get(
        f"/clubs/{cid}/leaderboard",
        params={"domain_id": domain["id"]},
        headers=_h(pres, cid),
    )
    assert r2.status_code == 200
    entries = r2.json()
    # President has no domain; only the member should appear
    assert all(e["domain_id"] == domain["id"] for e in entries)


def test_leaderboard_non_exec_cannot_see_other_domains(client):
    """Below joint_secretary, the domain isn't a choice: a member's own domain_id is
    what the server uses regardless of what the request asks for, and the whole-club
    "all domains" view (no domain_id at all) is equally out of reach."""
    pres = _register(client, "pres@lbscope.com", "Pres")
    mem = _register(client, "mem@lbscope.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain_a = _create_domain(client, pres, cid, "DomainA")
    domain_b = _create_domain(client, pres, cid, "DomainB")
    _approve_join(client, pres, cid, club["code"], mem, "member", domain_a["id"])

    # Explicitly asking for a domain that isn't theirs still returns their own.
    r = client.get(
        f"/clubs/{cid}/leaderboard",
        params={"domain_id": domain_b["id"]},
        headers=_h(mem, cid),
    )
    assert r.status_code == 200
    assert all(e["domain_id"] == domain_a["id"] for e in r.json())

    # No domain_id at all (the "All Domains" request) is scoped the same way.
    r2 = client.get(f"/clubs/{cid}/leaderboard", headers=_h(mem, cid))
    assert r2.status_code == 200
    assert all(e["domain_id"] == domain_a["id"] for e in r2.json())

    # The president, being joint_secretary+, really does get the other domain.
    r3 = client.get(
        f"/clubs/{cid}/leaderboard",
        params={"domain_id": domain_b["id"]},
        headers=_h(pres, cid),
    )
    assert r3.status_code == 200
    assert all(e["domain_id"] == domain_b["id"] for e in r3.json())


# ── Status-update authorization ──────────────────────────────────────────────

def test_member_cannot_update_unassigned_task(client):
    """A member cannot change status of a task they are not assigned to."""
    pres = _register(client, "pres@nostat.com", "Pres")
    mem = _register(client, "mem@nostat.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    _approve_join(client, pres, cid, club["code"], mem, "member", domain["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Not assigned"},
        headers=_h(pres, cid),
    ).json()

    r = client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"status": "in_progress"},
        headers=_h(mem, cid),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "NOT_ASSIGNEE"


def test_member_can_update_own_assigned_task_status(client):
    """A member can move their own assigned task between todo and in_progress."""
    pres = _register(client, "pres@ownstat.com", "Pres")
    mem = _register(client, "mem@ownstat.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    mem_id = _approve_join(client, pres, cid, club["code"], mem, "member", domain["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Assigned task"},
        headers=_h(pres, cid),
    ).json()
    client.post(
        f"/clubs/{cid}/tasks/{task['id']}/assign",
        json={"assignee_ids": [mem_id]},
        headers=_h(pres, cid),
    )

    r = client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"status": "in_progress"},
        headers=_h(mem, cid),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "in_progress"


def test_member_cannot_reopen_completed_task(client):
    """A member cannot reopen a completed task — only Lead+ can."""
    pres = _register(client, "pres@noreo.com", "Pres")
    mem = _register(client, "mem@noreo.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    mem_id = _approve_join(client, pres, cid, club["code"], mem, "member", domain["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Will complete"},
        headers=_h(pres, cid),
    ).json()
    client.post(
        f"/clubs/{cid}/tasks/{task['id']}/assign",
        json={"assignee_ids": [mem_id]},
        headers=_h(pres, cid),
    )
    client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"status": "completed"},
        headers=_h(pres, cid),
    )

    r = client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"status": "todo"},
        headers=_h(mem, cid),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "LEAD_REQUIRED_FOR_REOPEN"


# ── Domain-scoping for Leads ──────────────────────────────────────────────────

def test_lead_cannot_create_task_in_wrong_domain(client):
    """A Lead may only create tasks in their own domain; attempts on other domains are 403."""
    pres = _register(client, "pres@leaddom.com", "Pres")
    lead_user = _register(client, "lead@leaddom.com", "Lead")
    club = _create_club(client, pres)
    cid = club["id"]
    domain_a = _create_domain(client, pres, cid, "Domain A")
    domain_b = _create_domain(client, pres, cid, "Domain B")

    _approve_join(client, pres, cid, club["code"], lead_user, "lead", domain_a["id"])

    # Cross-domain create — must fail
    r = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain_b["id"], "title": "Cross-domain task"},
        headers=_h(lead_user, cid),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "WRONG_DOMAIN"

    # Own-domain create — must succeed
    r2 = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain_a["id"], "title": "Own domain task"},
        headers=_h(lead_user, cid),
    )
    assert r2.status_code == 201


def test_list_tasks_domain_scoped_for_member(client):
    """A member's task board only shows their own domain's tasks — a Technical task is
    invisible to a Design member, not just unassignable."""
    pres = _register(client, "pres@listscope.com", "Pres")
    mem = _register(client, "mem@listscope.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    tech = _create_domain(client, pres, cid, "Technical")
    design = _create_domain(client, pres, cid, "Design")

    _approve_join(client, pres, cid, club["code"], mem, "member", design["id"])

    client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": tech["id"], "title": "Technical-only task"},
        headers=_h(pres, cid),
    )
    client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": design["id"], "title": "Design task"},
        headers=_h(pres, cid),
    )

    r = client.get(f"/clubs/{cid}/tasks", headers=_h(mem, cid))
    assert r.status_code == 200
    titles = [t["title"] for t in r.json()]
    assert "Design task" in titles
    assert "Technical-only task" not in titles


def test_list_tasks_exec_sees_all_domains(client):
    """Exec roles (joint_secretary+) aren't domain-scoped — they see every task."""
    pres = _register(client, "pres@listscope2.com", "Pres")
    club = _create_club(client, pres)
    cid = club["id"]
    tech = _create_domain(client, pres, cid, "Technical")
    design = _create_domain(client, pres, cid, "Design")

    client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": tech["id"], "title": "Technical task"},
        headers=_h(pres, cid),
    )
    client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": design["id"], "title": "Design task"},
        headers=_h(pres, cid),
    )

    r = client.get(f"/clubs/{cid}/tasks", headers=_h(pres, cid))
    assert r.status_code == 200
    titles = [t["title"] for t in r.json()]
    assert "Technical task" in titles
    assert "Design task" in titles


def test_lead_cannot_edit_or_delete_task_in_other_domain(client):
    """A Lead's edit/delete reach is domain-scoped, checked before the creator-hierarchy
    rule even runs — a Technical Lead can't touch a Design task the President made."""
    pres = _register(client, "pres@crossdom.com", "Pres")
    lead = _register(client, "lead@crossdom.com", "Lead")
    club = _create_club(client, pres)
    cid = club["id"]
    tech = _create_domain(client, pres, cid, "Technical")
    design = _create_domain(client, pres, cid, "Design")

    _approve_join(client, pres, cid, club["code"], lead, "lead", tech["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": design["id"], "title": "Design task"},
        headers=_h(pres, cid),
    ).json()

    r = client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"title": "Hijacked by tech lead"},
        headers=_h(lead, cid),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "WRONG_DOMAIN"

    r2 = client.delete(f"/clubs/{cid}/tasks/{task['id']}", headers=_h(lead, cid))
    assert r2.status_code == 403
    assert r2.json()["code"] == "WRONG_DOMAIN"


def test_lead_cannot_change_status_of_task_in_other_domain(client):
    """A Lead's status authority (which otherwise bypasses the assignee check
    entirely — see test_update_task_fields) is domain-scoped too: before this fix, any
    Lead+ could move ANY task's status club-wide regardless of domain."""
    pres = _register(client, "pres@crossdom2.com", "Pres")
    lead = _register(client, "lead@crossdom2.com", "Lead")
    club = _create_club(client, pres)
    cid = club["id"]
    tech = _create_domain(client, pres, cid, "Technical")
    design = _create_domain(client, pres, cid, "Design")

    _approve_join(client, pres, cid, club["code"], lead, "lead", tech["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": design["id"], "title": "Design task"},
        headers=_h(pres, cid),
    ).json()

    r = client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"status": "in_progress"},
        headers=_h(lead, cid),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "WRONG_DOMAIN"


def test_associate_can_assign_task(client):
    """An associate (below lead) can assign tasks within their own domain."""
    pres = _register(client, "pres@assocassign.com", "Pres")
    assoc = _register(client, "assoc@assocassign.com", "Assoc")
    # Need associate enabled
    club_r = client.post(
        "/clubs",
        json={"name": "AssocClub", "enabled_roles": ["member", "associate", "lead"]},
        headers={"Authorization": f"Bearer {pres}"},
    )
    club = club_r.json()
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    assoc_id = _approve_join(client, pres, cid, club["code"], assoc, "associate", domain["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Assign by assoc"},
        headers=_h(pres, cid),
    ).json()

    r = client.post(
        f"/clubs/{cid}/tasks/{task['id']}/assign",
        json={"assignee_ids": [assoc_id]},
        headers=_h(assoc, cid),
    )
    assert r.status_code == 200
    assert any(a["id"] == assoc_id for a in r.json()["assignees"])


# ── Cross-tenant isolation ────────────────────────────────────────────────────

# ── Creator-hierarchy for edit/delete ────────────────────────────────────────

def test_secretary_cannot_edit_presidents_task(client):
    """A Secretary outranks a Lead but not a President — Lead+ alone must not be
    enough to edit a task created by someone who outranks the editor."""
    pres = _register(client, "pres@hier1.com", "Pres")
    sec = _register(client, "sec@hier1.com", "Secretary")
    club = client.post(
        "/clubs",
        json={"name": "HierClub1", "enabled_roles": ["member", "lead", "secretary"]},
        headers={"Authorization": f"Bearer {pres}"},
    ).json()
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    _approve_join(client, pres, cid, club["code"], sec, "secretary", None)

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Pres task"},
        headers=_h(pres, cid),
    ).json()

    r = client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"title": "Hijacked"},
        headers=_h(sec, cid),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "CANNOT_MODIFY_TASK"


def test_president_can_edit_secretarys_task(client):
    """A President outranks a Secretary — editing the Secretary's task must succeed."""
    pres = _register(client, "pres@hier2.com", "Pres")
    sec = _register(client, "sec@hier2.com", "Secretary")
    club = client.post(
        "/clubs",
        json={"name": "HierClub2", "enabled_roles": ["member", "lead", "secretary"]},
        headers={"Authorization": f"Bearer {pres}"},
    ).json()
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    _approve_join(client, pres, cid, club["code"], sec, "secretary", None)

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Sec task"},
        headers=_h(sec, cid),
    ).json()

    r = client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"title": "Updated by pres"},
        headers=_h(pres, cid),
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Updated by pres"


def test_creator_can_always_edit_own_task(client):
    """The creator can edit their own task regardless of who else outranks them."""
    pres = _register(client, "pres@hier3.com", "Pres")
    lead = _register(client, "lead@hier3.com", "Lead")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    _approve_join(client, pres, cid, club["code"], lead, "lead", domain["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Lead's own task"},
        headers=_h(lead, cid),
    ).json()

    r = client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"title": "Lead edited own"},
        headers=_h(lead, cid),
    )
    assert r.status_code == 200


def test_peer_lead_cannot_delete_anothers_task(client):
    """Two Leads in the *same* domain are peers — neither outranks the other, so one
    cannot delete a task created by the other even though both clear the Lead+ floor.
    Same domain on purpose, so this isolates the hierarchy rule from the (separately
    tested) domain-scoping rule."""
    pres = _register(client, "pres@hier4.com", "Pres")
    lead_a = _register(client, "leada@hier4.com", "LeadA")
    lead_b = _register(client, "leadb@hier4.com", "LeadB")
    club = _create_club(client, pres)
    cid = club["id"]
    domain_a = _create_domain(client, pres, cid, "DomA")

    _approve_join(client, pres, cid, club["code"], lead_a, "lead", domain_a["id"])
    _approve_join(client, pres, cid, club["code"], lead_b, "lead", domain_a["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain_a["id"], "title": "Lead A's task"},
        headers=_h(lead_a, cid),
    ).json()

    r = client.delete(f"/clubs/{cid}/tasks/{task['id']}", headers=_h(lead_b, cid))
    assert r.status_code == 403
    assert r.json()["code"] == "CANNOT_MODIFY_TASK"


# ── Accept (first-come-first-served self-assignment) ─────────────────────────

def test_member_can_accept_unassigned_task(client):
    pres = _register(client, "pres@accept1.com", "Pres")
    mem = _register(client, "mem@accept1.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    mem_id = _approve_join(client, pres, cid, club["code"], mem, "member", domain["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Up for grabs"},
        headers=_h(pres, cid),
    ).json()

    r = client.post(f"/clubs/{cid}/tasks/{task['id']}/accept", headers=_h(mem, cid))
    assert r.status_code == 200, r.text
    assert [a["id"] for a in r.json()["assignees"]] == [mem_id]


def test_accept_task_already_taken_rejected(client):
    pres = _register(client, "pres@accept2.com", "Pres")
    mem1 = _register(client, "mem1@accept2.com", "Member1")
    mem2 = _register(client, "mem2@accept2.com", "Member2")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    _approve_join(client, pres, cid, club["code"], mem1, "member", domain["id"])
    _approve_join(client, pres, cid, club["code"], mem2, "member", domain["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Race"},
        headers=_h(pres, cid),
    ).json()

    r1 = client.post(f"/clubs/{cid}/tasks/{task['id']}/accept", headers=_h(mem1, cid))
    assert r1.status_code == 200

    r2 = client.post(f"/clubs/{cid}/tasks/{task['id']}/accept", headers=_h(mem2, cid))
    assert r2.status_code == 409
    assert r2.json()["code"] == "TASK_ALREADY_TAKEN"


def test_accept_task_wrong_domain_rejected(client):
    """A member cannot accept a task outside their own domain — same rule that keeps
    it off their board in the first place (see test_list_tasks_domain_scoped_for_member)."""
    pres = _register(client, "pres@accept3.com", "Pres")
    mem = _register(client, "mem@accept3.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain_a = _create_domain(client, pres, cid, "DomA")
    domain_b = _create_domain(client, pres, cid, "DomB")

    _approve_join(client, pres, cid, club["code"], mem, "member", domain_a["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain_b["id"], "title": "Other domain task"},
        headers=_h(pres, cid),
    ).json()

    r = client.post(f"/clubs/{cid}/tasks/{task['id']}/accept", headers=_h(mem, cid))
    assert r.status_code == 403
    assert r.json()["code"] == "WRONG_DOMAIN"


def test_accept_task_exec_can_cross_domain(client):
    """Exec roles (joint_secretary+) aren't domain-scoped, so they can accept a task
    in any domain."""
    pres = _register(client, "pres@accept5.com", "Pres")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Presidential pickup"},
        headers=_h(pres, cid),
    ).json()

    r = client.post(f"/clubs/{cid}/tasks/{task['id']}/accept", headers=_h(pres, cid))
    assert r.status_code == 200, r.text


def test_accept_completed_task_rejected(client):
    pres = _register(client, "pres@accept4.com", "Pres")
    mem = _register(client, "mem@accept4.com", "Member")
    club = _create_club(client, pres)
    cid = club["id"]
    domain = _create_domain(client, pres, cid)

    _approve_join(client, pres, cid, club["code"], mem, "member", domain["id"])

    task = client.post(
        f"/clubs/{cid}/tasks",
        json={"domain_id": domain["id"], "title": "Already done"},
        headers=_h(pres, cid),
    ).json()
    client.put(
        f"/clubs/{cid}/tasks/{task['id']}",
        json={"status": "completed"},
        headers=_h(pres, cid),
    )

    r = client.post(f"/clubs/{cid}/tasks/{task['id']}/accept", headers=_h(mem, cid))
    assert r.status_code == 400
    assert r.json()["code"] == "TASK_COMPLETED"


def test_task_cross_tenant_denied(client):
    """Alice (member of club A) cannot access tasks in club B."""
    alice = _register(client, "alice@tct.com", "Alice")
    bob = _register(client, "bob@tct.com", "Bob")

    _create_club(client, alice, "Club A")
    club_b = _create_club(client, bob, "Club B")
    domain_b = _create_domain(client, bob, club_b["id"], "B Domain")

    client.post(
        f"/clubs/{club_b['id']}/tasks",
        json={"domain_id": domain_b["id"], "title": "Secret"},
        headers=_h(bob, club_b["id"]),
    )

    r = client.get(
        f"/clubs/{club_b['id']}/tasks",
        headers=_h(alice, club_b["id"]),
    )
    assert r.status_code == 403
    assert r.json()["code"] == "NOT_A_MEMBER"
