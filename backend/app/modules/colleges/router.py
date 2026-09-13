"""Colleges endpoint — identity-scoped (bearer only, no X-Club-ID). Read-only public reference
data (not enumeration-sensitive the way /clubs/lookup is), so no rate limit."""

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.db import get_session
from app.core.deps import get_current_user
from app.models import User
from app.modules.colleges import service
from app.modules.colleges.schemas import CollegeOut

router = APIRouter(prefix="/colleges", tags=["Colleges"])


@router.get("", response_model=list[CollegeOut])
def get_colleges(
    country: str = Query(min_length=1, max_length=100),
    state: str | None = Query(default=None, max_length=100),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return service.list_colleges(session, country, state)
