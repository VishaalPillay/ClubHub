"""College-requests business logic (thin router -> fat service)."""

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models import CollegeRequest, CollegeRequestSupporter, User


def create_request(
    session: Session,
    user: User,
    name: str,
    country: str,
    state: str | None,
) -> CollegeRequest:
    """Log a request to add a missing college. Light dedupe: a matching pending
    request (case-insensitive name, exact country/state) is reused rather than
    duplicated — the caller still gets a 201 either way. Each distinct requester
    is recorded via CollegeRequestSupporter so the promotion script can threshold
    on genuine demand rather than raw request count."""
    name = name.strip()
    existing = session.exec(
        select(CollegeRequest).where(
            func.lower(CollegeRequest.name) == name.lower(),
            CollegeRequest.country == country,
            CollegeRequest.state == state,
            CollegeRequest.status == "pending",
        )
    ).first()

    row = existing
    if row is None:
        row = CollegeRequest(name=name, country=country, state=state, requested_by=user.id)
        session.add(row)
        session.commit()
        session.refresh(row)

    _add_supporter(session, row.id, user.id)
    return row


def _add_supporter(session: Session, college_request_id: int, user_id: int) -> None:
    already = session.exec(
        select(CollegeRequestSupporter).where(
            CollegeRequestSupporter.college_request_id == college_request_id,
            CollegeRequestSupporter.user_id == user_id,
        )
    ).first()
    if already is not None:
        return
    session.add(
        CollegeRequestSupporter(college_request_id=college_request_id, user_id=user_id)
    )
    try:
        session.commit()
    except IntegrityError:
        # Concurrent duplicate requests from the same user hit the unique constraint —
        # the other request won; that's fine, the vote is recorded either way.
        session.rollback()
