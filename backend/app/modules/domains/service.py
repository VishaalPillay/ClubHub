"""Domains business logic (thin router -> fat service)."""

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.exceptions import AppError
from app.models import Domain


def list_domains(session: Session, club_id: int) -> list[Domain]:
    return list(session.exec(select(Domain).where(Domain.club_id == club_id)).all())


def create_domain(
    session: Session, club_id: int, name: str, description: str | None
) -> Domain:
    domain = Domain(club_id=club_id, name=name, description=description)
    session.add(domain)
    try:
        session.commit()
    except IntegrityError:
        # Refinement: must rollback before raising, or the session is poisoned.
        session.rollback()
        raise AppError(
            status.HTTP_409_CONFLICT,
            f"A domain named '{name}' already exists in this club.",
            "DOMAIN_NAME_TAKEN",
        )
    session.refresh(domain)
    return domain


def _load_domain_in_club(session: Session, club_id: int, domain_id: int) -> Domain:
    domain = session.get(Domain, domain_id)
    if domain is None or domain.club_id != club_id:
        raise AppError(
            status.HTTP_404_NOT_FOUND, "Domain not found in this club.", "DOMAIN_NOT_FOUND"
        )
    return domain


def update_domain(
    session: Session,
    club_id: int,
    domain_id: int,
    name: str | None,
    description: str | None,
) -> Domain:
    domain = _load_domain_in_club(session, club_id, domain_id)
    if name is not None:
        domain.name = name
    if description is not None:
        domain.description = description
    session.add(domain)
    try:
        session.commit()
    except IntegrityError:
        # Refinement: rollback covers rename collisions too, not just create.
        session.rollback()
        raise AppError(
            status.HTTP_409_CONFLICT,
            f"A domain named '{name}' already exists in this club.",
            "DOMAIN_NAME_TAKEN",
        )
    session.refresh(domain)
    return domain


def delete_domain(session: Session, club_id: int, domain_id: int) -> None:
    domain = _load_domain_in_club(session, club_id, domain_id)
    session.delete(domain)
    session.commit()
