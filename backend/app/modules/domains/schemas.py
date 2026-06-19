"""Domains request/response schemas (validation at the API edge)."""

from pydantic import BaseModel, Field


class CreateDomainIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class UpdateDomainIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class DomainOut(BaseModel):
    id: int
    name: str
    description: str | None

    model_config = {"from_attributes": True}
