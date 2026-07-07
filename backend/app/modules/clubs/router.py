"""Clubs endpoints.

Static GET paths (/my, /directory, /lookup, /pending) are declared BEFORE the
parameterised /{club_id} routes so FastAPI matches them correctly.
"""

from fastapi import APIRouter, Depends, Query, Request, status
from sqlmodel import Session

from app.core.config import settings
from app.core.db import get_session
from app.core.deps import ClubContext, get_current_user, verify_club_path
from app.core.ratelimit import limiter
from app.models import User
from app.modules.clubs import service
from app.modules.clubs.schemas import (
    ClubDetailOut,
    ClubOut,
    CreateClubIn,
    DirectoryItem,
    JoinClubIn,
    JoinOut,
    LookupOut,
    MyClubItem,
    PendingItem,
    UpdateClubIn,
)

router = APIRouter(prefix="/clubs", tags=["Clubs"])


# ── Identity-scoped (bearer only, no X-Club-ID) ───────────────────────────────

@router.get("/my", response_model=list[MyClubItem])
def my_clubs(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[dict]:
    return service.get_my_clubs(session, current_user.id)


@router.get("/directory", response_model=list[DirectoryItem])
def directory(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return service.get_directory(session)


@router.get("/lookup", response_model=LookupOut)
@limiter.limit(settings.RATE_LIMIT_JOIN)
def lookup(
    request: Request,
    code: str = Query(..., description="The club's shareable join code."),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    return service.lookup_by_code(session, code)


@router.get("/pending", response_model=list[PendingItem])
def pending_requests(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[dict]:
    return service.get_pending_requests(session, current_user.id)


@router.post("/join", response_model=JoinOut, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_JOIN)
def join_club(
    request: Request,
    body: JoinClubIn,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return service.join_club(
        session,
        current_user.id,
        body.club_code,
        body.requested_role,
        body.requested_domain_id,
        body.message,
    )


@router.delete("/join/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    service.withdraw_request(session, current_user.id, request_id)


@router.post("", response_model=ClubOut, status_code=status.HTTP_201_CREATED)
def create_club(
    body: CreateClubIn,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return service.create_club(
        session, current_user.id, body.name, body.description, body.enabled_roles
    )


# ── Club-scoped (bearer + X-Club-ID; path must match context) ─────────────────

@router.get("/{club_id}", response_model=ClubDetailOut)
def get_club(
    club_id: int,
    ctx: ClubContext = Depends(verify_club_path()),
    session: Session = Depends(get_session),
):
    return service.get_club(session, club_id)


@router.put("/{club_id}", response_model=ClubDetailOut)
def update_club(
    club_id: int,
    body: UpdateClubIn,
    ctx: ClubContext = Depends(verify_club_path("vice_president")),
    session: Session = Depends(get_session),
):
    return service.update_club(
        session, club_id, body.name, body.description, body.is_public, body.enabled_roles
    )
