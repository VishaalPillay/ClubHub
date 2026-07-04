"""Centralized model registry.

Importing this package imports every table so that `SQLModel.metadata` is fully populated
for Alembic autogenerate and for create_all in tests.
"""

from sqlmodel import SQLModel

from app.models.club import Club, ClubMember, Domain
from app.models.content import Announcement, Event, EventRsvp
from app.models.request import ActionRequest, JoinRequest
from app.models.task import PointsLedger, Task, TaskAssignment
from app.models.user import RefreshToken, User

__all__ = [
    "SQLModel",
    "User",
    "RefreshToken",
    "Club",
    "Domain",
    "ClubMember",
    "JoinRequest",
    "ActionRequest",
    "Task",
    "TaskAssignment",
    "PointsLedger",
    "Announcement",
    "Event",
    "EventRsvp",
]
