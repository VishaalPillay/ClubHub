"""app.scripts.promote_college_requests — the cron job that closes the loop on
college_requests, promoting ones with enough distinct support into `colleges` with no human
review (see scripts/promote-college-requests.sh)."""

from sqlmodel import select

from app.core.config import settings
from app.models import College, CollegeRequest
from app.scripts.promote_college_requests import promote_pending

# ── Helpers ───────────────────────────────────────────────────────────────────

def _register(client, email):
    r = client.post(
        "/auth/register",
        json={"name": "Someone", "email": email, "password": "password123"},
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def _request_college(client, token, name, country="India", state="Kerala"):
    r = client.post(
        "/college-requests",
        json={"name": name, "country": country, "state": state},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, r.text
    return r.json()


_supporter_seq = iter(range(100_000))


def _support(client, name, n, country="India", state="Kerala"):
    """n distinct users all request the same college name."""
    for _ in range(n):
        token = _register(client, f"supporter{next(_supporter_seq)}@college.com")
        _request_college(client, token, name, country, state)


# ── Threshold ────────────────────────────────────────────────────────────────

def test_below_threshold_stays_pending(client, session):
    _support(client, "Below Threshold College", settings.COLLEGE_PROMOTION_THRESHOLD - 1)

    counts = promote_pending(session)
    assert counts["approved"] == 0
    assert counts["skipped"] == 1

    row = session.exec(
        select(CollegeRequest).where(
            CollegeRequest.name == "Below Threshold College"
        )
    ).first()
    assert row.status == "pending"


def test_at_threshold_promotes(client, session):
    _support(client, "At Threshold College", settings.COLLEGE_PROMOTION_THRESHOLD)

    counts = promote_pending(session)
    assert counts["approved"] == 1

    req = session.exec(
        select(CollegeRequest).where(
            CollegeRequest.name == "At Threshold College"
        )
    ).first()
    assert req.status == "approved"

    college = session.exec(
        select(College).where(College.name == "At Threshold College")
    ).first()
    assert college is not None
    assert college.country == "India"
    assert college.state == "Kerala"
    assert college.source_request_id == req.id


# ── Fuzzy dedupe ─────────────────────────────────────────────────────────────

def test_near_duplicate_of_existing_college_is_marked_duplicate(client, session):
    session.add(College(name="ABC College", country="India", state="Kerala"))
    session.commit()

    _support(client, "abc  college", settings.COLLEGE_PROMOTION_THRESHOLD)  # case/whitespace only

    counts = promote_pending(session)
    assert counts["duplicate"] == 1
    assert counts["approved"] == 0

    req = session.exec(
        select(CollegeRequest).where(CollegeRequest.name == "abc  college")
    ).first()
    assert req.status == "duplicate"

    # No second College row was created for the near-duplicate name.
    matches = session.exec(
        select(College).where(College.country == "India", College.state == "Kerala")
    ).all()
    assert len(matches) == 1


# ── Junk filter ──────────────────────────────────────────────────────────────

def test_junk_name_rejected(client, session):
    _support(client, "12345", settings.COLLEGE_PROMOTION_THRESHOLD)

    counts = promote_pending(session)
    assert counts["rejected"] == 1
    assert counts["approved"] == 0

    req = session.exec(
        select(CollegeRequest).where(CollegeRequest.name == "12345")
    ).first()
    assert req.status == "rejected"


# ── Idempotency ──────────────────────────────────────────────────────────────

def test_rerunning_promotion_is_a_noop_for_resolved_rows(client, session):
    _support(client, "Rerun College", settings.COLLEGE_PROMOTION_THRESHOLD)

    first = promote_pending(session)
    assert first["approved"] == 1

    second = promote_pending(session)
    assert second == {"approved": 0, "duplicate": 0, "rejected": 0, "skipped": 0}
