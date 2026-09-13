"""Auto-promotes college_requests with enough distinct support into the public `colleges`
table — the automated half of the "Can't find your college?" flow (see
frontend/src/features/auth/CollegeSelect.tsx and app/modules/college_requests/).

Run via scripts/promote-college-requests.sh (weekly cron on the droplet), or directly:
    docker compose run --rm api python -m app.scripts.promote_college_requests

No human review — the distinct-requester threshold is what keeps this cheap and honest:
getting COLLEGE_PROMOTION_THRESHOLD separate registered accounts to independently type the
same missing college is hard for one spammer to fake (rate-limited, auth-required, one vote
per user via CollegeRequestSupporter) but trivial for a real institution's actual students.
See COLLEGE_PROMOTION_* in app/core/config.py for the tunable knobs and their trade-offs.
"""

import re
from difflib import SequenceMatcher

from sqlmodel import Session, select

from app.core.config import settings
from app.core.db import engine
from app.models import College, CollegeRequest, CollegeRequestSupporter

_MIN_LETTERS = 2  # fewer than this and it's not a name ("123", "???", "aa")


def _normalize(name: str) -> str:
    return re.sub(r"\s+", " ", name).strip()


def _is_junk(name: str) -> bool:
    return sum(c.isalpha() for c in name) < _MIN_LETTERS


def _best_match(session: Session, name: str, country: str, state: str | None) -> College | None:
    """Most similar already-promoted college in the same country/state, if any close enough
    to count as the same institution under a different spelling/abbreviation."""
    candidates = session.exec(
        select(College).where(College.country == country, College.state == state)
    ).all()
    if not candidates:
        return None
    ratio, best = max(
        ((SequenceMatcher(None, name.lower(), c.name.lower()).ratio(), c) for c in candidates),
        key=lambda pair: pair[0],
    )
    return best if ratio >= settings.COLLEGE_PROMOTION_MIN_SIMILARITY else None


def promote_pending(session: Session) -> dict[str, int]:
    """Process every pending CollegeRequest once. Idempotent — only touches status='pending'
    rows, so re-running (e.g. a retried cron run) is a no-op for anything already resolved."""
    counts = {"approved": 0, "duplicate": 0, "rejected": 0, "skipped": 0}

    pending = session.exec(
        select(CollegeRequest)
        .where(CollegeRequest.status == "pending")
        .order_by(CollegeRequest.created_at)
    ).all()

    for req in pending:
        supporters = session.exec(
            select(CollegeRequestSupporter).where(
                CollegeRequestSupporter.college_request_id == req.id
            )
        ).all()
        if len(supporters) < settings.COLLEGE_PROMOTION_THRESHOLD:
            counts["skipped"] += 1
            continue

        name = _normalize(req.name)
        if _is_junk(name):
            req.status = "rejected"
            session.add(req)
            session.commit()
            counts["rejected"] += 1
            print(f"[promote-colleges] rejected (junk name): {req.name!r}")
            continue

        match = _best_match(session, name, req.country, req.state)
        if match is not None:
            req.status = "duplicate"
            session.add(req)
            session.commit()
            counts["duplicate"] += 1
            print(f"[promote-colleges] duplicate of {match.name!r}: {req.name!r}")
            continue

        session.add(
            College(name=name, country=req.country, state=req.state, source_request_id=req.id)
        )
        req.status = "approved"
        session.add(req)
        session.commit()
        counts["approved"] += 1
        print(f"[promote-colleges] promoted: {name!r} ({req.country}/{req.state or '-'})")

    return counts


if __name__ == "__main__":
    with Session(engine) as _session:
        result = promote_pending(_session)
    print(f"[promote-colleges] done: {result}")
