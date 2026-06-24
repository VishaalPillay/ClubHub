"""Action-request schemas (Lead/Associate 'propose' -> Secretary 'authorize')."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.permissions import ROLE_HIERARCHY

_ACTION_TYPES = {"promote", "kick"}


class CreateActionRequestIn(BaseModel):
    target_id: int
    action_type: str
    new_role: str | None = None
    reason: str = Field(min_length=1)

    @field_validator("action_type")
    @classmethod
    def action_must_be_valid(cls, v: str) -> str:
        if v not in _ACTION_TYPES:
            raise ValueError("action_type must be 'promote' or 'kick'.")
        return v

    @field_validator("new_role")
    @classmethod
    def role_must_be_known(cls, v: str | None) -> str | None:
        if v is not None and v not in ROLE_HIERARCHY:
            raise ValueError(f"Unknown role '{v}'.")
        return v

    @model_validator(mode="after")
    def kick_has_no_role(self) -> "CreateActionRequestIn":
        # Mirrors the DB CHECK chk_kick_no_role at the edge.
        if self.action_type == "kick" and self.new_role is not None:
            raise ValueError("A kick request must not carry a new_role.")
        return self


class ActionRequestOut(BaseModel):
    """Result of creating / approving an action request."""

    id: int
    requester_id: int
    target_id: int
    action_type: str
    new_role: str | None
    reason: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ActionRequestItem(BaseModel):
    """One entry in GET /clubs/{id}/action-requests (pending only)."""

    id: int
    requester_id: int
    requester_name: str
    target_id: int
    target_name: str
    action_type: str
    new_role: str | None
    reason: str
    created_at: datetime


class ReviewOut(BaseModel):
    """Result of rejecting an action request."""

    id: int
    status: str
