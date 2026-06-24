"""Members business logic (thin router -> fat service).

The roster, role changes, and removal — the management half of the RBAC lifecycle. Every
club-scoped read goes through `tenant_query`; rank/grant rules come from `core.permissions`.
"""

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.deps import ClubContext
from app.core.exceptions import AppError
from app.core.permissions import (
    DOMAIN_SCOPED_ROLES,
    can_grant_role,
    can_manage,
    role_rank,
)
from app.core.tenant import tenant_query
from app.models import Club, ClubMember, Domain, User


def _user_map(session: Session, user_ids: set[int]) -> dict[int, User]:
    """Fetch global User rows by id (identity is not club-scoped, so no tenant_query)."""
    if not user_ids:
        return {}
    return {u.id: u for u in session.exec(select(User).where(User.id.in_(user_ids))).all()}


def _domain_map(session: Session, ctx: ClubContext) -> dict[int, str]:
    return {d.id: d.name for d in session.exec(tenant_query(Domain, ctx)).all()}


def _to_member_dict(member: ClubMember, user: User, domain_name: str | None) -> dict:
    return {
        "user_id": member.user_id,
        "name": user.name,
        "email": user.email,
        "role": member.role,
        "domain_id": member.domain_id,
        "domain_name": domain_name,
        "points": member.points,
        "joined_at": member.joined_at,
    }


def list_members(session: Session, ctx: ClubContext) -> list[dict]:
    members = list(session.exec(tenant_query(ClubMember, ctx)).all())
    users = _user_map(session, {m.user_id for m in members})
    domains = _domain_map(session, ctx)
    items = [_to_member_dict(m, users[m.user_id], domains.get(m.domain_id)) for m in members]
    # Rank descending (most senior first), then name ascending.
    items.sort(key=lambda x: (-role_rank(x["role"]), x["name"]))
    return items


def _load_member(session: Session, ctx: ClubContext, user_id: int) -> ClubMember:
    member = session.exec(
        tenant_query(ClubMember, ctx).where(ClubMember.user_id == user_id)
    ).first()
    if member is None:
        raise AppError(
            status.HTTP_404_NOT_FOUND, "Member not found in this club.", "MEMBER_NOT_FOUND"
        )
    return member


def _resolve_domain(
    session: Session,
    ctx: ClubContext,
    new_role: str,
    new_domain_id: int | None,
    current_domain_id: int | None,
) -> int | None:
    """Validate and return the domain a member should hold for `new_role`.

    Exec roles (above 'lead') carry no domain. Domain-scoped roles must resolve to a domain
    in this club, falling back to the member's current domain when none is supplied.
    """
    if new_role not in DOMAIN_SCOPED_ROLES:
        return None
    final_domain_id = new_domain_id if new_domain_id is not None else current_domain_id
    if final_domain_id is None:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A domain is required for a domain-scoped role.",
            "DOMAIN_REQUIRED",
        )
    domain = session.get(Domain, final_domain_id)
    if domain is None or domain.club_id != ctx.club_id:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "The domain does not belong to this club.",
            "DOMAIN_NOT_IN_CLUB",
        )
    return final_domain_id


def change_role(
    session: Session,
    ctx: ClubContext,
    user_id: int,
    new_role: str,
    new_domain_id: int | None,
) -> dict:
    member = _load_member(session, ctx, user_id)
    if not can_manage(ctx.role, member.role):
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "You can only manage members ranked below you.",
            "CANNOT_MANAGE_RANK",
        )
    if not can_grant_role(ctx.role, new_role):
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "You cannot grant a role at or above your own rank "
            "(secretaries and joint-secretaries are capped at 'lead').",
            "FORBIDDEN_GRANT",
        )

    member.domain_id = _resolve_domain(session, ctx, new_role, new_domain_id, member.domain_id)
    member.role = new_role
    session.add(member)
    session.commit()
    session.refresh(member)

    user = session.get(User, member.user_id)
    domain_name = None
    if member.domain_id is not None:
        domain = session.get(Domain, member.domain_id)
        domain_name = domain.name if domain else None
    return _to_member_dict(member, user, domain_name)


def remove_member(session: Session, ctx: ClubContext, user_id: int) -> None:
    member = _load_member(session, ctx, user_id)

    # Hard guards independent of rank: the owner and any president are never removable.
    club = session.get(Club, ctx.club_id)
    if club is not None and club.owner_id == user_id:
        raise AppError(
            status.HTTP_403_FORBIDDEN, "The club owner cannot be removed.", "CANNOT_REMOVE_OWNER"
        )
    if member.role == "president":
        raise AppError(
            status.HTTP_403_FORBIDDEN, "A president cannot be removed.", "CANNOT_REMOVE_PRESIDENT"
        )
    if not can_manage(ctx.role, member.role):
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "You can only remove members ranked below you.",
            "CANNOT_MANAGE_RANK",
        )

    session.delete(member)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise AppError(
            status.HTTP_409_CONFLICT,
            "This member could not be removed.",
            "MEMBER_REMOVE_CONFLICT",
        ) from None
