"""Tasks request/response schemas (validation at the API edge)."""

from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

_VALID_STATUSES = frozenset({"todo", "in_progress", "completed"})

# Default cap until club-level config exists (SYSTEM_DESIGN §7.1).
MAX_TASK_POINTS = 100


class TaskAssigneeOut(BaseModel):
    id: int
    name: str


class TaskOut(BaseModel):
    id: int
    club_id: int
    domain_id: int
    domain_name: str
    title: str
    description: str | None
    status: str
    points: int
    due_date: date | None
    creator_id: int
    created_at: datetime
    completed_at: datetime | None
    assignees: list[TaskAssigneeOut]


class CreateTaskIn(BaseModel):
    domain_id: int
    title: str
    description: str | None = None
    points: int = Field(default=10, ge=0, le=MAX_TASK_POINTS)
    due_date: date | None = None
    assignee_ids: list[int] = []


class UpdateTaskIn(BaseModel):
    title: str | None = None
    description: str | None = None
    due_date: date | None = None
    status: str | None = None

    @field_validator("status")
    @classmethod
    def status_must_be_known(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(_VALID_STATUSES))}")
        return v


class AssignTaskIn(BaseModel):
    assignee_ids: list[int]
