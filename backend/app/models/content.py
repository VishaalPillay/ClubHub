"""Announcements (club/domain-scoped) and events with RSVP."""

from datetime import date, datetime, time

from sqlalchemy import Column, Index, String, UniqueConstraint
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
    __table_args__ = (Index("ix_events_club_status", "club_id", "status"),)

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
    # Cached RSVP count — event_rsvps is the source of truth (mirrors ClubMember.points
    # caching the points_ledger). Updated in the same transaction as RSVP inserts/deletes.
    attendees: int = Field(default=0)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


class EventRsvp(SQLModel, table=True):
    """One row per member attending an event; unique (event_id, user_id) makes RSVP idempotent."""

    __tablename__ = "event_rsvps"
    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_event_rsvp"),)

    id: int | None = Field(default=None, primary_key=True)
    club_id: int = Field(foreign_key="clubs.id", index=True, ondelete="CASCADE")
    event_id: int = Field(foreign_key="events.id", ondelete="CASCADE")
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE")
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
