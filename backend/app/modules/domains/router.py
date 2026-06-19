"""Domains endpoints — all club-scoped (bearer + X-Club-ID).

Prefix /clubs mirrors the URL shape (/clubs/{club_id}/domains/...) while keeping
this module independent of the clubs router.
"""

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.db import get_session
from app.core.deps import ClubContext, verify_club_path
from app.modules.domains import service
from app.modules.domains.schemas import CreateDomainIn, DomainOut, UpdateDomainIn

router = APIRouter(prefix="/clubs", tags=["Domains"])


@router.get("/{club_id}/domains", response_model=list[DomainOut])
def list_domains(
    club_id: int,
    ctx: ClubContext = Depends(verify_club_path()),
    session: Session = Depends(get_session),
):
    return service.list_domains(session, club_id)


@router.post(
    "/{club_id}/domains",
    response_model=DomainOut,
    status_code=status.HTTP_201_CREATED,
)
def create_domain(
    club_id: int,
    body: CreateDomainIn,
    ctx: ClubContext = Depends(verify_club_path("vice_president")),
    session: Session = Depends(get_session),
):
    return service.create_domain(session, club_id, body.name, body.description)


@router.put("/{club_id}/domains/{domain_id}", response_model=DomainOut)
def update_domain(
    club_id: int,
    domain_id: int,
    body: UpdateDomainIn,
    ctx: ClubContext = Depends(verify_club_path("vice_president")),
    session: Session = Depends(get_session),
):
    return service.update_domain(session, club_id, domain_id, body.name, body.description)


@router.delete("/{club_id}/domains/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_domain(
    club_id: int,
    domain_id: int,
    ctx: ClubContext = Depends(verify_club_path("vice_president")),
    session: Session = Depends(get_session),
) -> None:
    service.delete_domain(session, club_id, domain_id)
