"""Action-request governance: Lead/Associate 'propose', Secretary+ 'authorize'.

A Lead (or Associate) who cannot manage members directly proposes a promote/kick within
their own domain; a Secretary-rank reviewer then authorizes or rejects it.
"""

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.deps import ClubContext
from app.core.exceptions import AppError
from app.core.permissions import can_manage, role_rank
from app.core.tenant import tenant_query
from app.models import ActionRequest, ClubMember, User
from app.models.base import utcnow

# Only Leads and Associates raise action requests; higher roles manage members directly.
_PROPOSER_ROLES = frozenset({"lead", "associate"})
# A promote proposal may not aim above this role.
_PROMOTE_CEILING = "associate"


def create(
    session: Session,
    ctx: ClubContext,
    target_id: int,
    action_type: str,
    new_role: str | None,
    reason: str,
) -> ActionRequest:
    if ctx.role not in _PROPOSER_ROLES:
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "Only leads and associates raise action requests; higher roles manage members "
            "directly.",
            "MANAGE_DIRECTLY",
        )

    target = session.exec(
        tenant_query(ClubMember, ctx).where(ClubMember.user_id == target_id)
    ).first()
    if target is None:
        raise AppError(
            status.HTTP_404_NOT_FOUND, "Member not found in this club.", "MEMBER_NOT_FOUND"
        )
    if target.domain_id != ctx.domain_id:
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "You can only act on members in your own domain.",
            "OUTSIDE_YOUR_DOMAIN",
        )
    if not can_manage(ctx.role, target.role):
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "You can only act on members ranked below you.",
            "CANNOT_MANAGE_RANK",
        )

    if action_type == "promote":
        if new_role is None:
            raise AppError(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "A promote request requires new_role.",
                "NEW_ROLE_REQUIRED",
            )
        if ctx.role == "associate":
            raise AppError(
                status.HTTP_403_FORBIDDEN,
                "Associates cannot raise promotion requests.",
                "ASSOCIATE_CANNOT_PROMOTE",
            )
        if role_rank(new_role) > role_rank(_PROMOTE_CEILING):
            raise AppError(
                status.HTTP_403_FORBIDDEN,
                "A promotion request may not exceed 'associate'.",
                "PROMOTE_CAP_EXCEEDED",
            )

    action = ActionRequest(
        club_id=ctx.club_id,
        requester_id=ctx.user_id,
        target_id=target_id,
        action_type=action_type,
        new_role=new_role,
        reason=reason,
        status="pending",
    )
    session.add(action)
    session.commit()
    session.refresh(action)
    return action


def list_pending(session: Session, ctx: ClubContext) -> list[dict]:
    requests = list(
        session.exec(
            tenant_query(ActionRequest, ctx).where(ActionRequest.status == "pending")
        ).all()
    )
    user_ids = {r.requester_id for r in requests} | {r.target_id for r in requests}
    users = (
        {u.id: u for u in session.exec(select(User).where(User.id.in_(user_ids))).all()}
        if user_ids
        else {}
    )
    return [
        {
            "id": r.id,
            "requester_id": r.requester_id,
            "requester_name": users[r.requester_id].name if r.requester_id in users else "",
            "target_id": r.target_id,
            "target_name": users[r.target_id].name if r.target_id in users else "",
            "action_type": r.action_type,
            "new_role": r.new_role,
            "reason": r.reason,
            "created_at": r.created_at,
        }
        for r in requests
    ]


def _load_pending(session: Session, ctx: ClubContext, request_id: int) -> ActionRequest:
    ar = session.exec(
        tenant_query(ActionRequest, ctx).where(ActionRequest.id == request_id)
    ).first()
    # 404 if absent, owned by another club, or already resolved (first approver wins).
    if ar is None or ar.status != "pending":
        raise AppError(
            status.HTTP_404_NOT_FOUND,
            "Pending action request not found in this club.",
            "REQUEST_NOT_FOUND",
        )
    return ar


def approve(session: Session, ctx: ClubContext, request_id: int) -> ActionRequest:
    ar = _load_pending(session, ctx, request_id)

    target = session.exec(
        tenant_query(ClubMember, ctx).where(ClubMember.user_id == ar.target_id)
    ).first()

    if ar.action_type == "kick":
        if target is not None:
            session.delete(target)
    else:  # promote
        if target is None:
            raise AppError(
                status.HTTP_404_NOT_FOUND,
                "The target is no longer a member of this club.",
                "MEMBER_NOT_FOUND",
            )
        target.role = ar.new_role
        session.add(target)

    ar.status = "approved"
    ar.resolved_by = ctx.user_id
    ar.resolved_at = utcnow()
    session.add(ar)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise AppError(
            status.HTTP_409_CONFLICT,
            "This action request could not be applied.",
            "ACTION_APPLY_CONFLICT",
        ) from None
    session.refresh(ar)
    return ar


def reject(session: Session, ctx: ClubContext, request_id: int) -> dict:
    ar = _load_pending(session, ctx, request_id)
    ar.status = "rejected"
    ar.resolved_by = ctx.user_id
    ar.resolved_at = utcnow()
    session.add(ar)
    session.commit()
    return {"id": request_id, "status": "rejected"}
