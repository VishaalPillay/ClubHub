"""College-requests business logic (thin router -> fat service)."""

from sqlalchemy import func
from sqlmodel import Session, select

from app.models import CollegeRequest, User


def create_request(
    session: Session,
    user: User,
    name: str,
    country: str,
    state: str | None,
) -> CollegeRequest:
    """Log a request to add a missing college. Light dedupe: a matching pending
    request (case-insensitive name, exact country/state) is reused rather than
    duplicated — the caller still gets a 201 either way."""
    name = name.strip()
    existing = session.exec(
        select(CollegeRequest).where(
            func.lower(CollegeRequest.name) == name.lower(),
            CollegeRequest.country == country,
            CollegeRequest.state == state,
            CollegeRequest.status == "pending",
        )
    ).first()
    if existing:
        return existing

    row = CollegeRequest(name=name, country=country, state=state, requested_by=user.id)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row
