"""Clubs request/response schemas (validation at the API edge)."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.permissions import ROLE_HIERARCHY

# president is auto-assigned to the creator and is never a join-requestable role.
_SELECTABLE_ROLES: set[str] = set(ROLE_HIERARCHY) - {"president"}


def _validate_enabled_roles(roles: list[str]) -> list[str]:
    invalid = [r for r in roles if r not in _SELECTABLE_ROLES]
    if invalid:
        raise ValueError(
            f"Invalid or non-selectable roles: {invalid}. "
            "'president' is assigned automatically and may not appear in enabled_roles."
        )
    return roles


class CreateClubIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    enabled_roles: list[str]

    @field_validator("enabled_roles")
    @classmethod
    def roles_must_be_valid(cls, v: list[str]) -> list[str]:
        return _validate_enabled_roles(v)


class UpdateClubIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    is_public: bool | None = None
    enabled_roles: list[str] | None = None

    @field_validator("enabled_roles")
    @classmethod
    def roles_must_be_valid(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        return _validate_enabled_roles(v)


class JoinClubIn(BaseModel):
    club_code: str
    requested_role: str
    requested_domain_id: int | None = None
    message: str | None = None


# ── Response schemas ──────────────────────────────────────────────────────────

class ClubOut(BaseModel):
    """Returned on POST /clubs."""
    id: int
    name: str
    description: str | None
    code: str
    is_public: bool
    enabled_roles: list[str] | None

    model_config = {"from_attributes": True}


class MyClubItem(BaseModel):
    """One entry in GET /clubs/my — annotated with this user's membership."""
    id: int
    name: str
    description: str | None
    code: str
    role: str
    domain_id: int | None


class DirectoryItem(BaseModel):
    """One entry in GET /clubs/directory. The join `code` is deliberately omitted —
    it is an invite secret and only surfaces via the authenticated lookup."""
    id: int
    name: str
    description: str | None
    institution: str | None

    model_config = {"from_attributes": True}


class DomainBrief(BaseModel):
    """Embedded domain shape used inside LookupOut."""
    id: int
    name: str
    description: str | None


class LookupOut(BaseModel):
    """Response for GET /clubs/lookup?code="""
    id: int
    name: str
    code: str
    description: str | None
    enabled_roles: list[str] | None
    domains: list[DomainBrief]


class PendingItem(BaseModel):
    """One entry in GET /clubs/pending."""
    id: int
    club_id: int
    club_name: str
    code: str
    requested_role: str
    status: str
    created_at: datetime


class JoinOut(BaseModel):
    """Response for POST /clubs/join (201)."""
    id: int
    club_id: int
    status: str

    model_config = {"from_attributes": True}


class ClubDetailOut(BaseModel):
    """Response for GET /clubs/{id} and PUT /clubs/{id}."""
    id: int
    name: str
    description: str | None
    code: str
    is_public: bool
    enabled_roles: list[str] | None
    institution: str | None

    model_config = {"from_attributes": True}
