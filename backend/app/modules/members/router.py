"""Members endpoints — club-scoped roster, role changes, and removal."""

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.db import get_session
from app.core.deps import ClubContext, verify_club_path
from app.modules.members import service
from app.modules.members.schemas import MemberOut, UpdateRoleIn

router = APIRouter(prefix="/clubs", tags=["Members"])


@router.get("/{club_id}/members", response_model=list[MemberOut])
def list_members(
    club_id: int,
    ctx: ClubContext = Depends(verify_club_path()),
    session: Session = Depends(get_session),
):
    return service.list_members(session, ctx)


@router.put("/{club_id}/members/{user_id}/role", response_model=MemberOut)
def change_member_role(
    club_id: int,
    user_id: int,
    body: UpdateRoleIn,
    ctx: ClubContext = Depends(verify_club_path("joint_secretary")),
    session: Session = Depends(get_session),
):
    return service.change_role(session, ctx, user_id, body.new_role, body.new_domain_id)


@router.delete("/{club_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    club_id: int,
    user_id: int,
    ctx: ClubContext = Depends(verify_club_path("joint_secretary")),
    session: Session = Depends(get_session),
) -> None:
    service.remove_member(session, ctx, user_id)
