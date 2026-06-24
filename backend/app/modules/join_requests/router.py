"""Join-request admin endpoints — the approval queue (submit/withdraw live in clubs)."""

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.db import get_session
from app.core.deps import ClubContext, verify_club_path
from app.modules.join_requests import service
from app.modules.join_requests.schemas import (
    ApprovedMemberOut,
    ApproveJoinIn,
    JoinRequestItem,
    ReviewOut,
)

router = APIRouter(prefix="/clubs", tags=["Join Requests"])


@router.get("/{club_id}/requests", response_model=list[JoinRequestItem])
def list_requests(
    club_id: int,
    ctx: ClubContext = Depends(verify_club_path("joint_secretary")),
    session: Session = Depends(get_session),
):
    return service.list_pending(session, ctx)


@router.put("/{club_id}/requests/{request_id}/approve", response_model=ApprovedMemberOut)
def approve_request(
    club_id: int,
    request_id: int,
    body: ApproveJoinIn,
    ctx: ClubContext = Depends(verify_club_path("joint_secretary")),
    session: Session = Depends(get_session),
):
    return service.approve(
        session, ctx, request_id, body.role_override, body.domain_id_override
    )


@router.put("/{club_id}/requests/{request_id}/reject", response_model=ReviewOut)
def reject_request(
    club_id: int,
    request_id: int,
    ctx: ClubContext = Depends(verify_club_path("joint_secretary")),
    session: Session = Depends(get_session),
):
    return service.reject(session, ctx, request_id)
