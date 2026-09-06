"""Promotion notice endpoints — identity-scoped (bearer only, no X-Club-ID), mirroring
the users module's /me pattern.
"""

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.db import get_session
from app.core.deps import get_current_user
from app.models import User
from app.modules.notices import service
from app.modules.notices.schemas import NoticeOut

router = APIRouter(prefix="/users/me/notices", tags=["Notices"])


@router.get("", response_model=list[NoticeOut])
def list_my_notices(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return service.list_notices(session, current_user.id)


@router.delete("/{notice_id}", status_code=status.HTTP_204_NO_CONTENT)
def ack_notice(
    notice_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    service.ack_notice(session, current_user.id, notice_id)
