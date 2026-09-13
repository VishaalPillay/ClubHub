"""User-submitted requests to add a college missing from the curated picker list."""

from datetime import datetime

from sqlalchemy import Column, String, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.base import utcnow


class CollegeRequest(SQLModel, table=True):
    __tablename__ = "college_requests"

    id: int | None = Field(default=None, primary_key=True)
    name: str
    country: str
    state: str | None = Field(default=None)
    requested_by: int | None = Field(default=None, foreign_key="users.id", ondelete="SET NULL")
    # Role/status fields are VARCHAR per ADR-0001, validated at the edge.
    # pending -> approved (promoted into `colleges`) | duplicate (folded into an existing
    # College by the promotion script) | rejected (failed the junk-name heuristic).
    status: str = Field(
        default="pending", sa_column=Column(String, nullable=False, default="pending")
    )
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class CollegeRequestSupporter(SQLModel, table=True):
    """One row per distinct user backing a pending request; unique (college_request_id, user_id)
    makes re-requesting idempotent and gives the promotion script an honest distinct-requester
    count to threshold on — mirrors EventRsvp's uq_event_rsvp pattern (app/models/content.py)."""

    __tablename__ = "college_request_supporters"
    __table_args__ = (
        UniqueConstraint("college_request_id", "user_id", name="uq_college_request_supporter"),
    )

    id: int | None = Field(default=None, primary_key=True)
    college_request_id: int = Field(foreign_key="college_requests.id", ondelete="CASCADE")
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
