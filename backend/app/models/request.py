"""Join requests (outsiders -> club) and action requests (Lead-raised promote/kick approvals)."""

from datetime import datetime

from sqlalchemy import CheckConstraint, Column, Index, String
from sqlmodel import Field, SQLModel

from app.models.base import utcnow


class JoinRequest(SQLModel, table=True):
    __tablename__ = "join_requests"
    __table_args__ = (Index("ix_join_requests_club_status", "club_id", "status"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id")
    club_id: int = Field(foreign_key="clubs.id")
    requested_role: str = Field(sa_column=Column(String, nullable=False))
    requested_domain_id: int | None = Field(default=None, foreign_key="domains.id")
    status: str = Field(
        default="pending", sa_column=Column(String, nullable=False, default="pending")
    )
    message: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    reviewed_by: int | None = Field(default=None, foreign_key="users.id")
    reviewed_at: datetime | None = Field(default=None)


class ActionRequest(SQLModel, table=True):
    __tablename__ = "action_requests"
    __table_args__ = (
        # A kick carries no target role (SYSTEM_DESIGN §5.2).
        CheckConstraint("action_type <> 'kick' OR new_role IS NULL", name="chk_kick_no_role"),
        Index("ix_action_requests_club_status", "club_id", "status"),
    )

    id: int | None = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="clubs.id")
    requester_id: int = Field(foreign_key="users.id")
    target_id: int = Field(foreign_key="users.id")
    action_type: str = Field(sa_column=Column(String, nullable=False))  # promote | kick
    new_role: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    reason: str
    status: str = Field(
        default="pending", sa_column=Column(String, nullable=False, default="pending")
    )
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    resolved_by: int | None = Field(default=None, foreign_key="users.id")
    resolved_at: datetime | None = Field(default=None)
