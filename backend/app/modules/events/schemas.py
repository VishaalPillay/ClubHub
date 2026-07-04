"""Events request/response schemas (validation at the API edge)."""

from datetime import date, datetime, time

from pydantic import BaseModel, Field, field_validator

_VALID_TYPES = frozenset({"hackathon", "tech_talk", "workshop", "social"})
_VALID_STATUSES = frozenset({"upcoming", "past", "cancelled"})


class EventOut(BaseModel):
    id: int
    club_id: int
    creator_id: int
    creator_name: str
    title: str
    type: str
    description: str | None
    event_date: date | None
    event_time: time | None
    location: str | None
    status: str
    attendees: int
    my_rsvp: bool
    created_at: datetime


class CreateEventIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    type: str
    description: str | None = None
    event_date: date | None = None
    event_time: time | None = None
    location: str | None = None

    @field_validator("type")
    @classmethod
    def type_must_be_known(cls, v: str) -> str:
        if v not in _VALID_TYPES:
            raise ValueError(f"type must be one of: {', '.join(sorted(_VALID_TYPES))}")
        return v


class UpdateEventIn(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    type: str | None = None
    description: str | None = None
    event_date: date | None = None
    event_time: time | None = None
    location: str | None = None
    status: str | None = None

    @field_validator("type")
    @classmethod
    def type_must_be_known(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALID_TYPES:
            raise ValueError(f"type must be one of: {', '.join(sorted(_VALID_TYPES))}")
        return v

    @field_validator("status")
    @classmethod
    def status_must_be_known(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(_VALID_STATUSES))}")
        return v
