"""Announcements request/response schemas (validation at the API edge)."""

from datetime import datetime

from pydantic import BaseModel, field_validator, model_validator

_VALID_TYPES = frozenset({"urgent", "general"})
_VALID_SCOPES = frozenset({"global", "domain"})


class AnnouncementOut(BaseModel):
    id: int
    club_id: int
    author_id: int
    author_name: str
    type: str
    title: str
    body: str
    scope: str
    domain_id: int | None
    domain_name: str | None
    created_at: datetime


class CreateAnnouncementIn(BaseModel):
    title: str
    body: str
    type: str = "general"
    scope: str = "global"
    domain_id: int | None = None

    @field_validator("type")
    @classmethod
    def type_must_be_known(cls, v: str) -> str:
        if v not in _VALID_TYPES:
            raise ValueError(f"type must be one of: {', '.join(sorted(_VALID_TYPES))}")
        return v

    @field_validator("scope")
    @classmethod
    def scope_must_be_known(cls, v: str) -> str:
        if v not in _VALID_SCOPES:
            raise ValueError(f"scope must be one of: {', '.join(sorted(_VALID_SCOPES))}")
        return v

    @model_validator(mode="after")
    def domain_required_for_domain_scope(self) -> "CreateAnnouncementIn":
        if self.scope == "domain" and self.domain_id is None:
            raise ValueError("domain_id is required when scope is 'domain'")
        return self


class UpdateAnnouncementIn(BaseModel):
    title: str | None = None
    body: str | None = None
    type: str | None = None

    @field_validator("type")
    @classmethod
    def type_must_be_known(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALID_TYPES:
            raise ValueError(f"type must be one of: {', '.join(sorted(_VALID_TYPES))}")
        return v
