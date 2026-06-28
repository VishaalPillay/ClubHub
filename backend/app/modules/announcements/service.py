"""Announcements business logic — create, list (scope-filtered), update, delete."""

from fastapi import status
from sqlalchemy import or_
from sqlmodel import Session, select

from app.core.deps import ClubContext
from app.core.exceptions import AppError
from app.core.permissions import DOMAIN_SCOPED_ROLES, role_at_least
from app.core.tenant import tenant_query
from app.models import Announcement, Domain, User


# ── Enrichment helper ─────────────────────────────────────────────────────────

def _enrich(session: Session, announcements: list[Announcement]) -> list[dict]:
    """Attach author_name and domain_name (batched, no N+1)."""
    if not announcements:
        return []

    author_ids = {a.author_id for a in announcements}
    domain_ids = {a.domain_id for a in announcements if a.domain_id is not None}

    authors = {
        u.id: u.name
        for u in session.exec(select(User).where(User.id.in_(author_ids))).all()
    }
    domains = (
        {d.id: d.name for d in session.exec(select(Domain).where(Domain.id.in_(domain_ids))).all()}
        if domain_ids
        else {}
    )

    return [
        {
            "id": a.id,
            "club_id": a.club_id,
            "author_id": a.author_id,
            "author_name": authors.get(a.author_id, ""),
            "type": a.type,
            "title": a.title,
            "body": a.body,
            "scope": a.scope,
            "domain_id": a.domain_id,
            "domain_name": domains.get(a.domain_id) if a.domain_id else None,
            "created_at": a.created_at,
        }
        for a in announcements
    ]


def _load_announcement(session: Session, ctx: ClubContext, aid: int) -> Announcement:
    ann = session.exec(
        tenant_query(Announcement, ctx).where(Announcement.id == aid)
    ).first()
    if ann is None:
        raise AppError(
            status.HTTP_404_NOT_FOUND,
            "Announcement not found in this club.",
            "ANNOUNCEMENT_NOT_FOUND",
        )
    return ann


def _assert_can_modify(ctx: ClubContext, ann: Announcement) -> None:
    """Author or Vice-President+ may edit/delete; anyone else gets 403."""
    if ctx.user_id != ann.author_id and not role_at_least(ctx.role, "vice_president"):
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "Only the author or a Vice-President+ may modify this announcement.",
            "FORBIDDEN_ANNOUNCEMENT",
        )


# ── Service functions ─────────────────────────────────────────────────────────

def list_announcements(session: Session, ctx: ClubContext) -> list[dict]:
    """Return announcements the caller is allowed to see, newest first.

    Domain-scoped roles (member/associate/lead) see global announcements plus
    those targeted at their own domain. Exec roles (VP+) see everything.
    """
    base = tenant_query(Announcement, ctx)

    if ctx.role in DOMAIN_SCOPED_ROLES:
        if ctx.domain_id is not None:
            base = base.where(
                or_(
                    Announcement.scope == "global",
                    (Announcement.scope == "domain") & (Announcement.domain_id == ctx.domain_id),
                )
            )
        else:
            # Member approved without a domain assignment sees only global announcements.
            base = base.where(Announcement.scope == "global")

    announcements = list(
        session.exec(base.order_by(Announcement.created_at.desc())).all()
    )
    return _enrich(session, announcements)


def create_announcement(
    session: Session,
    ctx: ClubContext,
    title: str,
    body: str,
    ann_type: str,
    scope: str,
    domain_id: int | None,
) -> dict:
    if scope == "global":
        if not role_at_least(ctx.role, "vice_president"):
            raise AppError(
                status.HTTP_403_FORBIDDEN,
                "Only Vice-President+ may post global announcements.",
                "VP_REQUIRED_FOR_GLOBAL",
            )
        domain_id = None  # global announcements are never domain-targeted
    else:  # scope == "domain"
        # domain_id presence already guaranteed by the CreateAnnouncementIn model_validator.
        domain = session.get(Domain, domain_id)
        if domain is None or domain.club_id != ctx.club_id:
            raise AppError(
                status.HTTP_404_NOT_FOUND,
                "Domain not found in this club.",
                "DOMAIN_NOT_FOUND",
            )
        # Domain-scoped roles (Lead and below) may only post in their own domain.
        if ctx.role in DOMAIN_SCOPED_ROLES and ctx.domain_id != domain_id:
            raise AppError(
                status.HTTP_403_FORBIDDEN,
                "You can only post announcements in your own domain.",
                "WRONG_DOMAIN",
            )

    ann = Announcement(
        club_id=ctx.club_id,
        author_id=ctx.user_id,
        type=ann_type,
        title=title,
        body=body,
        scope=scope,
        domain_id=domain_id,
    )
    session.add(ann)
    session.commit()
    session.refresh(ann)
    return _enrich(session, [ann])[0]


def update_announcement(
    session: Session,
    ctx: ClubContext,
    aid: int,
    title: str | None,
    body: str | None,
    ann_type: str | None,
) -> dict:
    ann = _load_announcement(session, ctx, aid)
    _assert_can_modify(ctx, ann)

    if title is not None:
        ann.title = title
    if body is not None:
        ann.body = body
    if ann_type is not None:
        ann.type = ann_type

    session.add(ann)
    session.commit()
    session.refresh(ann)
    return _enrich(session, [ann])[0]


def delete_announcement(session: Session, ctx: ClubContext, aid: int) -> None:
    ann = _load_announcement(session, ctx, aid)
    _assert_can_modify(ctx, ann)
    session.delete(ann)
    session.commit()
