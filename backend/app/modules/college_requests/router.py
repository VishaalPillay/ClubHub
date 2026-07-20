"""College-requests endpoint — identity-scoped (bearer only, no X-Club-ID)."""

from fastapi import APIRouter, Depends, Request, Response, status
from sqlmodel import Session

from app.core.config import settings
from app.core.db import get_session
from app.core.deps import get_current_user
from app.core.ratelimit import limiter
from app.models import User
from app.modules.college_requests import service
from app.modules.college_requests.schemas import CollegeRequestIn, CollegeRequestOut

router = APIRouter(prefix="/college-requests", tags=["College Requests"])


@router.post("", response_model=CollegeRequestOut, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_COLLEGE_REQUEST)
def request_college(
    request: Request,
    response: Response,
    body: CollegeRequestIn,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return service.create_request(session, current_user, body.name, body.country, body.state)
