"""Members request/response schemas (validation at the API edge)."""

from datetime import datetime

from pydantic import BaseModel, field_validator

from app.core.permissions import ROLE_HIERARCHY


class UpdateRoleIn(BaseModel):
    new_role: str
    new_domain_id: int | None = None

    @field_validator("new_role")
    @classmethod
    def role_must_be_known(cls, v: str) -> str:
        if v not in ROLE_HIERARCHY:
            raise ValueError(f"Unknown role '{v}'.")
        return v


class MemberOut(BaseModel):
    """One entry in GET /clubs/{id}/members and the result of a role change."""

    user_id: int
    name: str
    email: str
    role: str
    domain_id: int | None
    domain_name: str | None
    points: int
    joined_at: datetime
