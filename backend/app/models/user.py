"""Global user identity + profile (one row per person, no club context)."""

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.base import utcnow


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    # Nullable: a Google-only account has no password; a password-only account has no google_sub.
    password_hash: str | None = Field(default=None)
    google_sub: str | None = Field(default=None, unique=True, index=True)

    # Profile fields
    institution: str | None = Field(default=None)
    age: int | None = Field(default=None)
    github_url: str | None = Field(default=None)
    linkedin_url: str | None = Field(default=None)
    instagram_url: str | None = Field(default=None)
    avatar_url: str | None = Field(default=None)

    created_at: datetime = Field(default_factory=utcnow, nullable=False)
