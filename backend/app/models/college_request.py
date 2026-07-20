"""User-submitted requests to add a college missing from the curated picker list."""

from datetime import datetime

from sqlalchemy import Column, String
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
    status: str = Field(
        default="pending", sa_column=Column(String, nullable=False, default="pending")
    )
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
