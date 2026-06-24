"""Tasks, their assignments, and the points ledger (idempotent gamification awards)."""

from datetime import date, datetime

from sqlalchemy import Column, Index, String, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.base import utcnow


class Task(SQLModel, table=True):
    __tablename__ = "tasks"
    __table_args__ = (Index("ix_tasks_club_domain", "club_id", "domain_id"),)

    id: int | None = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="clubs.id", ondelete="CASCADE")
    domain_id: int = Field(foreign_key="domains.id", ondelete="CASCADE")
    title: str
    description: str | None = Field(default=None)
    # Status stored as VARCHAR (todo|in_progress|completed), validated at the edge.
    status: str = Field(default="todo", sa_column=Column(String, nullable=False, default="todo"))
    points: int = Field(default=0)  # weightage awarded to each assignee on completion
    due_date: date | None = Field(default=None)
    creator_id: int = Field(foreign_key="users.id", ondelete="RESTRICT")
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    completed_at: datetime | None = Field(default=None)


class TaskAssignment(SQLModel, table=True):
    __tablename__ = "task_assignments"

    task_id: int = Field(foreign_key="tasks.id", primary_key=True, ondelete="CASCADE")
    user_id: int = Field(foreign_key="users.id", primary_key=True, ondelete="CASCADE")


class PointsLedger(SQLModel, table=True):
    __tablename__ = "points_ledger"
    # A task credits a given member at most once -> idempotent awards (SYSTEM_DESIGN §7.1).
    __table_args__ = (UniqueConstraint("task_id", "user_id", name="uq_ledger_task_user"),)

    id: int | None = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="clubs.id", index=True, ondelete="CASCADE")
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    task_id: int = Field(foreign_key="tasks.id", ondelete="CASCADE")
    delta: int
    reason: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
