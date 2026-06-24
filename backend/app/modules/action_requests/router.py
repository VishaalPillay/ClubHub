"""Action-request endpoints — propose (Lead/Associate) and authorize (Secretary+)."""

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.db import get_session
from app.core.deps import ClubContext, verify_club_path
from app.modules.action_requests import service
from app.modules.action_requests.schemas import (
    ActionRequestItem,
    ActionRequestOut,
    CreateActionRequestIn,
    ReviewOut,
)

router = APIRouter(prefix="/clubs", tags=["Action Requests"])


@router.post(
    "/{club_id}/action-requests",
    response_model=ActionRequestOut,
    status_code=status.HTTP_201_CREATED,
)
def create_action_request(
    club_id: int,
    body: CreateActionRequestIn,
    ctx: ClubContext = Depends(verify_club_path("associate")),
    session: Session = Depends(get_session),
):
    return service.create(
        session, ctx, body.target_id, body.action_type, body.new_role, body.reason
    )


@router.get("/{club_id}/action-requests", response_model=list[ActionRequestItem])
def list_action_requests(
    club_id: int,
    ctx: ClubContext = Depends(verify_club_path("joint_secretary")),
    session: Session = Depends(get_session),
):
    return service.list_pending(session, ctx)


@router.put(
    "/{club_id}/action-requests/{request_id}/approve", response_model=ActionRequestOut
)
def approve_action_request(
    club_id: int,
    request_id: int,
    ctx: ClubContext = Depends(verify_club_path("joint_secretary")),
    session: Session = Depends(get_session),
):
    return service.approve(session, ctx, request_id)


@router.put(
    "/{club_id}/action-requests/{request_id}/reject", response_model=ReviewOut
)
def reject_action_request(
    club_id: int,
    request_id: int,
    ctx: ClubContext = Depends(verify_club_path("joint_secretary")),
    session: Session = Depends(get_session),
):
    return service.reject(session, ctx, request_id)
