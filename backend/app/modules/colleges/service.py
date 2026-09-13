"""Colleges business logic (thin router -> fat service)."""

from sqlmodel import Session, select

from app.models import College


def list_colleges(session: Session, country: str, state: str | None) -> list[College]:
    """Community-promoted colleges for a country/state, for CollegeSelect to merge with the
    static curated list. Small table, alphabetical is enough — no pagination needed."""
    return session.exec(
        select(College)
        .where(College.country == country, College.state == state)
        .order_by(College.name)
    ).all()
