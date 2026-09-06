"""Role-change notices — a one-shot, per-user notification for either direction of a
rank change.

Created when a member is promoted or demoted (SYSTEM_DESIGN's gamification surface);
polled and acknowledged by the affected user's own session so the confetti/rain pop-up
can show on whatever page they happen to be on, then deleted. There is no `seen` flag —
this is not a notification inbox, just a one-time hand-off. Kept as `PromotionNotice`
rather than renamed wholesale when demote support was added — the table/model predate
that and a rename would touch every layer for no behavioral gain; `kind` is what
actually distinguishes the two now.
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, Column, Index, String
from sqlmodel import Field, SQLModel

from app.models.base import utcnow


class PromotionNotice(SQLModel, table=True):
    __tablename__ = "promotion_notices"
    __table_args__ = (
        Index("ix_promotion_notices_user", "user_id"),
        CheckConstraint("kind IN ('promote', 'demote')", name="chk_notice_kind"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    # Denormalized rather than a club_id FK: the notice should still read fine even if
    # the club is later deleted before the user has seen it.
    club_name: str
    new_role: str = Field(sa_column=Column(String, nullable=False))
    kind: str = Field(default="promote", sa_column=Column(String, nullable=False))
    message: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
