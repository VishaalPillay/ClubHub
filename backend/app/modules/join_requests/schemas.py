"""Join-request admin schemas (the approval side; submit/withdraw live in clubs)."""

from datetime import datetime

from pydantic import BaseModel, field_validator

from app.core.permissions import ROLE_HIERARCHY


class ApproveJoinIn(BaseModel):
    role_override: str | None = None
    domain_id_override: int | None = None

    @field_validator("role_override")
    @classmethod
    def role_must_be_known(cls, v: str | None) -> str | None:
        if v is not None and v not in ROLE_HIERARCHY:
            raise ValueError(f"Unknown role '{v}'.")
        return v


class JoinRequestItem(BaseModel):
    """One entry in GET /clubs/{id}/requests (pending only)."""

    id: int
    user_id: int
    user_name: str
    requested_role: str
    requested_domain_id: int | None
    requested_domain_name: str | None
    message: str | None
    created_at: datetime


class ApprovedMemberOut(BaseModel):
    """Result of approving a join request — the membership that was created."""

    request_id: int
    user_id: int
    role: str
    domain_id: int | None
    status: str


class ReviewOut(BaseModel):
    """Result of rejecting a join request."""

    id: int
    status: str
