"""Clubs request/response schemas (validation at the API edge)."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.permissions import ROLE_HIERARCHY

# president is auto-assigned to the creator and is never a join-requestable role.
_SELECTABLE_ROLES: set[str] = set(ROLE_HIERARCHY) - {"president"}

# "public" = any student; "institution" = only students whose profile institution matches
# the club's; "unlisted" = not in the directory at all (invite code only).
_VISIBILITY_VALUES: set[str] = {"public", "institution", "unlisted"}


def _validate_visibility(v: str | None) -> str | None:
    if v is not None and v not in _VISIBILITY_VALUES:
        raise ValueError(f"visibility must be one of {sorted(_VISIBILITY_VALUES)}, got {v!r}.")
    return v


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
    institution: str | None = Field(default=None, max_length=255)
    enabled_roles: list[str]

    @field_validator("enabled_roles")
    @classmethod
    def roles_must_be_valid(cls, v: list[str]) -> list[str]:
        return _validate_enabled_roles(v)


class UpdateClubIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    institution: str | None = Field(default=None, max_length=255)
    visibility: str | None = None
    accepting_requests: bool | None = None
    enabled_roles: list[str] | None = None

    @field_validator("enabled_roles")
    @classmethod
    def roles_must_be_valid(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        return _validate_enabled_roles(v)

    @field_validator("visibility")
    @classmethod
    def visibility_must_be_valid(cls, v: str | None) -> str | None:
        return _validate_visibility(v)


class JoinClubIn(BaseModel):
    """Either `club_code` (invite-code flow) or `club_id` (request-to-join a public
    club straight from the directory, no code needed) must be given."""
    club_code: str | None = None
    club_id: int | None = None
    requested_role: str
    requested_domain_id: int | None = None
    message: str | None = None

    @model_validator(mode="after")
    def require_an_identifier(self) -> "JoinClubIn":
        if not self.club_code and self.club_id is None:
            raise ValueError("Either club_code or club_id is required.")
        return self


# ── Response schemas ──────────────────────────────────────────────────────────

class ClubOut(BaseModel):
    """Returned on POST /clubs."""
    id: int
    name: str
    description: str | None
    code: str
    visibility: str
    accepting_requests: bool
    enabled_roles: list[str] | None
    institution: str | None

    model_config = {"from_attributes": True}


class MyClubItem(BaseModel):
    """One entry in GET /clubs/my — annotated with this user's membership.

    `code` is the invite secret: only visible to members who could plausibly need to
    share it (Joint-Secretary+, the same threshold that reviews join requests). Lower
    ranks get `null` — the frontend simply doesn't render the code row for them.
    """
    id: int
    name: str
    description: str | None
    institution: str | None
    code: str | None
    role: str
    domain_id: int | None


class DomainBrief(BaseModel):
    """Embedded domain shape used inside LookupOut / DirectoryItem."""
    id: int
    name: str
    description: str | None


class DirectoryItem(BaseModel):
    """One entry in GET /clubs/directory. The join `code` is deliberately omitted —
    it is an invite secret; public/institution clubs are instead requestable by `id`
    via POST /clubs/join. `enabled_roles`/`domains` let the client build that request
    without a second round-trip. `accepting_requests=false` means the club is browsable
    but paused on intake — the client renders "Not Recruiting" instead of a join button."""
    id: int
    name: str
    description: str | None
    institution: str | None
    enabled_roles: list[str] | None
    accepting_requests: bool
    domains: list[DomainBrief]


class LookupOut(BaseModel):
    """Response for GET /clubs/lookup?code="""
    id: int
    name: str
    code: str
    description: str | None
    enabled_roles: list[str] | None
    domains: list[DomainBrief]


class PendingItem(BaseModel):
    """One entry in GET /clubs/pending. `code` is deliberately omitted — a pending
    requester is not yet a member and may have arrived via the directory (never having
    seen an invite code at all); leaking it here would be the same invite-secret problem
    the directory already avoids."""
    id: int
    club_id: int
    club_name: str
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
    """Response for GET /clubs/{id} and PUT /clubs/{id}. Both are Vice-President+ only
    (the settings page) — the full detail, including the invite code, is an executive view."""
    id: int
    name: str
    description: str | None
    code: str
    visibility: str
    accepting_requests: bool
    enabled_roles: list[str] | None
    institution: str | None

    model_config = {"from_attributes": True}
