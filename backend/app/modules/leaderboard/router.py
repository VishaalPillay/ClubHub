"""Leaderboard endpoint — club-scoped, optional domain filter."""

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.db import get_session
from app.core.deps import ClubContext, verify_club_path
from app.modules.leaderboard import service
from app.modules.leaderboard.schemas import LeaderboardEntry

router = APIRouter(prefix="/clubs", tags=["Leaderboard"])


@router.get("/{club_id}/leaderboard", response_model=list[LeaderboardEntry])
def get_leaderboard(
    club_id: int,
    domain_id: int | None = Query(default=None, description="Filter to a single domain."),
    ctx: ClubContext = Depends(verify_club_path()),
    session: Session = Depends(get_session),
):
    return service.get_leaderboard(session, ctx, domain_id)
