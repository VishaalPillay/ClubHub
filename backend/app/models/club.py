"""Club (the tenant), its sub-teams (domains), and memberships (the RBAC source of truth)."""

from datetime import datetime

from sqlalchemy import Column, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.models.base import utcnow


class Club(SQLModel, table=True):
    __tablename__ = "clubs"

    id: int | None = Field(default=None, primary_key=True)
    name: str
    description: str | None = Field(default=None)
    code: str = Field(unique=True, index=True)  # shareable join code, e.g. "AB-X7K2P"
    owner_id: int = Field(foreign_key="users.id", ondelete="RESTRICT")
    # Which sub-roles this club uses. JSONB (indexable) per docs/adr/0001 note.
    enabled_roles: list[str] | None = Field(default=None, sa_column=Column(JSONB))
    is_public: bool = Field(default=True)
    institution: str | None = Field(default=None)  # for future cross-institution features
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class Domain(SQLModel, table=True):
    __tablename__ = "domains"
    __table_args__ = (UniqueConstraint("club_id", "name", name="uq_club_domain"),)

    id: int | None = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="clubs.id", index=True, ondelete="CASCADE")
    name: str
    description: str | None = Field(default=None)


class ClubMember(SQLModel, table=True):
    __tablename__ = "club_members"
    __table_args__ = (
        UniqueConstraint("user_id", "club_id", name="uq_user_club"),
        Index("ix_club_members_club_role", "club_id", "role"),
        # Leaderboard: WHERE club_id = ? ORDER BY points DESC (SYSTEM_DESIGN §5.3).
        Index("ix_club_members_club_points", "club_id", "points"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    club_id: int = Field(foreign_key="clubs.id", ondelete="CASCADE")
    # Role stored as VARCHAR, validated by the Role enum at the edge (docs/adr/0001).
    role: str = Field(sa_column=Column(String, nullable=False))
    domain_id: int | None = Field(default=None, foreign_key="domains.id", ondelete="SET NULL")
    points: int = Field(default=0)  # cached running total; points_ledger is the source of truth
    joined_at: datetime = Field(default_factory=utcnow, nullable=False)
