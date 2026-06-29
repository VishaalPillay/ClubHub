"""Users/profile request/response schemas (validation at the API edge)."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, HttpUrl, model_validator


class ProfileOut(BaseModel):
    """The full profile — wider than auth's MeOut, which stays partial for compat."""

    id: int
    name: str
    email: EmailStr
    institution: str | None = None
    age: int | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    instagram_url: str | None = None
    avatar_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateProfileIn(BaseModel):
    """Profile-only fields. Partial: any field omitted is left untouched; an
    explicit null clears it (except `name`, which is NOT NULL on the model).

    URL fields are validated as real URLs on input but stored/returned as plain
    strings (the columns are VARCHAR) — see service.update_profile.
    """

    name: str | None = Field(default=None, min_length=1, max_length=255)
    institution: str | None = Field(default=None, max_length=255)
    age: int | None = Field(default=None, ge=13, le=120)
    github_url: HttpUrl | None = None
    linkedin_url: HttpUrl | None = None
    instagram_url: HttpUrl | None = None
    avatar_url: HttpUrl | None = None

    @model_validator(mode="after")
    def name_not_explicitly_null(self) -> "UpdateProfileIn":
        # `name is None` by itself just means "omitted"; only reject an explicit null.
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be set to null")
        return self
