"""Join-request governance (approve / reject).

The user-facing submit/withdraw/list-own flow lives in modules/clubs; this is the admin
queue. The final role must satisfy the same grant caps as a promotion by the approver.
"""

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.deps import ClubContext
from app.core.exceptions import AppError
from app.core.permissions import DOMAIN_SCOPED_ROLES, can_grant_role
from app.core.tenant import tenant_query
from app.models import ClubMember, Domain, JoinRequest, User
from app.models.base import utcnow


def list_pending(session: Session, ctx: ClubContext) -> list[dict]:
    requests = list(
        session.exec(
            tenant_query(JoinRequest, ctx).where(JoinRequest.status == "pending")
        ).all()
    )
    user_ids = {r.user_id for r in requests}
    users = (
        {u.id: u for u in session.exec(select(User).where(User.id.in_(user_ids))).all()}
        if user_ids
        else {}
    )
    domains = {d.id: d.name for d in session.exec(tenant_query(Domain, ctx)).all()}
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "user_name": users[r.user_id].name if r.user_id in users else "",
            "requested_role": r.requested_role,
            "requested_domain_id": r.requested_domain_id,
            "requested_domain_name": domains.get(r.requested_domain_id),
            "message": r.message,
            "created_at": r.created_at,
        }
        for r in requests
    ]


def _load_pending_request(session: Session, ctx: ClubContext, request_id: int) -> JoinRequest:
    jr = session.exec(
        tenant_query(JoinRequest, ctx).where(JoinRequest.id == request_id)
    ).first()
    # 404 if absent, owned by another club, or already resolved — never leak cross-club
    # existence, and only act on pending requests.
    if jr is None or jr.status != "pending":
        raise AppError(
            status.HTTP_404_NOT_FOUND,
            "Pending join request not found in this club.",
            "REQUEST_NOT_FOUND",
        )
    return jr


def _validate_domain(
    session: Session, ctx: ClubContext, role: str, domain_id: int | None
) -> int | None:
    if role not in DOMAIN_SCOPED_ROLES:
        return None
    if domain_id is None:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A domain is required for a domain-scoped role.",
            "DOMAIN_REQUIRED",
        )
    domain = session.get(Domain, domain_id)
    if domain is None or domain.club_id != ctx.club_id:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "The domain does not belong to this club.",
            "DOMAIN_NOT_IN_CLUB",
        )
    return domain_id


def approve(
    session: Session,
    ctx: ClubContext,
    request_id: int,
    role_override: str | None,
    domain_id_override: int | None,
) -> dict:
    jr = _load_pending_request(session, ctx, request_id)

    final_role = role_override or jr.requested_role
    if not can_grant_role(ctx.role, final_role):
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "You cannot approve into a role at or above your own rank "
            "(secretaries and joint-secretaries are capped at 'lead').",
            "FORBIDDEN_GRANT",
        )

    requested_domain = (
        domain_id_override if domain_id_override is not None else jr.requested_domain_id
    )
    final_domain_id = _validate_domain(session, ctx, final_role, requested_domain)

    existing = session.exec(
        tenant_query(ClubMember, ctx).where(ClubMember.user_id == jr.user_id)
    ).first()
    if existing is not None:
        raise AppError(
            status.HTTP_409_CONFLICT, "This user is already a member.", "ALREADY_MEMBER"
        )

    session.add(
        ClubMember(
            user_id=jr.user_id,
            club_id=ctx.club_id,
            role=final_role,
            domain_id=final_domain_id,
        )
    )
    jr.status = "approved"
    jr.reviewed_by = ctx.user_id
    jr.reviewed_at = utcnow()
    session.add(jr)
    try:
        session.commit()
    except IntegrityError:
        # uq_user_club race: another approver created the membership first.
        session.rollback()
        raise AppError(
            status.HTTP_409_CONFLICT, "This user is already a member.", "ALREADY_MEMBER"
        ) from None

    return {
        "request_id": request_id,
        "user_id": jr.user_id,
        "role": final_role,
        "domain_id": final_domain_id,
        "status": "approved",
    }


def reject(session: Session, ctx: ClubContext, request_id: int) -> dict:
    jr = _load_pending_request(session, ctx, request_id)
    jr.status = "rejected"
    jr.reviewed_by = ctx.user_id
    jr.reviewed_at = utcnow()
    session.add(jr)
    session.commit()
    return {"id": request_id, "status": "rejected"}
