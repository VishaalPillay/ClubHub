"""Leaderboard business logic — per-club, optionally per-domain (SYSTEM_DESIGN §7.2)."""

from sqlmodel import Session, select

from app.core.deps import ClubContext
from app.models import ClubMember, Domain, User


def get_leaderboard(
    session: Session, ctx: ClubContext, domain_id: int | None
) -> list[dict]:
    """Return members sorted by points desc. Backed by ix_club_members_club_points."""
    query = (
        select(ClubMember, User)
        .join(User, ClubMember.user_id == User.id)  # type: ignore[arg-type]
        .where(ClubMember.club_id == ctx.club_id)
        .order_by(ClubMember.points.desc())  # type: ignore[attr-defined]
    )
    if domain_id is not None:
        query = query.where(ClubMember.domain_id == domain_id)

    rows = list(session.exec(query).all())

    domain_ids = {cm.domain_id for cm, _ in rows if cm.domain_id is not None}
    domains = (
        {d.id: d.name for d in session.exec(select(Domain).where(Domain.id.in_(domain_ids))).all()}
        if domain_ids
        else {}
    )

    return [
        {
            "rank": i + 1,
            "user_id": user.id,
            "name": user.name,
            "role": cm.role,
            "domain_id": cm.domain_id,
            "domain_name": domains.get(cm.domain_id),
            "points": cm.points,
        }
        for i, (cm, user) in enumerate(rows)
    ]
