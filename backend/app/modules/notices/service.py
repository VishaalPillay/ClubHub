"""Promotion notices business logic.

Identity-scoped, not club-scoped: a notice belongs to a user regardless of which club
they're currently viewing, so this never goes through `tenant_query`.
"""

from sqlmodel import Session, select

from app.models import PromotionNotice


def create_promotion_notice(
    session: Session,
    user_id: int,
    club_name: str,
    new_role: str,
    message: str | None,
    kind: str = "promote",
) -> None:
    session.add(
        PromotionNotice(
            user_id=user_id, club_name=club_name, new_role=new_role, message=message, kind=kind
        )
    )
    session.commit()


def list_notices(session: Session, user_id: int) -> list[PromotionNotice]:
    return list(
        session.exec(
            select(PromotionNotice)
            .where(PromotionNotice.user_id == user_id)
            .order_by(PromotionNotice.created_at)
        ).all()
    )


def ack_notice(session: Session, user_id: int, notice_id: int) -> None:
    """Delete the notice once it's been shown. Silently no-ops for a foreign or
    already-gone id — the frontend doesn't need to distinguish those from success."""
    notice = session.get(PromotionNotice, notice_id)
    if notice is not None and notice.user_id == user_id:
        session.delete(notice)
        session.commit()
