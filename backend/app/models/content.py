"""Announcements (club/domain-scoped) and events (deferred from MVP UI, schema kept)."""

from datetime import date, datetime, time

from sqlalchemy import Column, Index, String
from sqlmodel import Field, SQLModel

from app.models.base import utcnow


class Announcement(SQLModel, table=True):
    __tablename__ = "announcements"
    __table_args__ = (Index("ix_announcements_club_scope", "club_id", "scope"),)

    id: int | None = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="clubs.id", ondelete="CASCADE")
    author_id: int = Field(foreign_key="users.id", ondelete="RESTRICT")
    type: str = Field(sa_column=Column(String, nullable=False))  # urgent | general
    title: str
    body: str
    scope: str = Field(default="global", sa_column=Column(String, nullable=False, default="global"))
    domain_id: int | None = Field(default=None, foreign_key="domains.id", ondelete="SET NULL")
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class Event(SQLModel, table=True):
    __tablename__ = "events"

    id: int | None = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="clubs.id", ondelete="CASCADE")
    creator_id: int = Field(foreign_key="users.id", ondelete="RESTRICT")
    title: str
    # hackathon | tech_talk | workshop | social
    type: str = Field(sa_column=Column(String, nullable=False))
    description: str | None = Field(default=None)
    event_date: date | None = Field(default=None)
    event_time: time | None = Field(default=None)
    location: str | None = Field(default=None)
    status: str = Field(
        default="upcoming", sa_column=Column(String, nullable=False, default="upcoming")
    )
    attendees: int = Field(default=0)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
