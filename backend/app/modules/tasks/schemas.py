"""Tasks request/response schemas (validation at the API edge)."""

from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

_VALID_STATUSES = frozenset({"todo", "in_progress", "completed"})

# A fixed points scale rather than a free-form range — keeps task weight comparable
# across a club instead of every creator picking their own arbitrary number.
ALLOWED_TASK_POINTS = frozenset({5, 10, 20, 50})


def _validate_points(v: int) -> int:
    if v not in ALLOWED_TASK_POINTS:
        raise ValueError(f"points must be one of {sorted(ALLOWED_TASK_POINTS)}, got {v}.")
    return v


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
    points: int = Field(default=10)
    due_date: date | None = None
    assignee_ids: list[int] = []

    @field_validator("points")
    @classmethod
    def points_must_be_allowed(cls, v: int) -> int:
        return _validate_points(v)


class UpdateTaskIn(BaseModel):
    title: str | None = None
    description: str | None = None
    due_date: date | None = None
    status: str | None = None
    points: int | None = None

    @field_validator("status")
    @classmethod
    def status_must_be_known(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALID_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(sorted(_VALID_STATUSES))}")
        return v

    @field_validator("points")
    @classmethod
    def points_must_be_allowed(cls, v: int | None) -> int | None:
        if v is None:
            return v
        return _validate_points(v)


class AssignTaskIn(BaseModel):
    assignee_ids: list[int]
