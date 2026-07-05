"""Global user identity + profile (one row per person, no club context)."""

from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.base import utcnow


class RefreshToken(SQLModel, table=True):
    """Server-side refresh-token record (opaque token; only the SHA-256 hash is stored).

    Rotation: each /auth/refresh revokes the presented row and inserts a replacement.
    A revoked hash presented again means the token leaked (reuse) — all of the user's
    active tokens are revoked in response. See docs/adr/0002-auth-token-contract.md.
    """

    __tablename__ = "refresh_tokens"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True, ondelete="CASCADE")
    token_hash: str = Field(unique=True, index=True)
    expires_at: datetime = Field(nullable=False)
    revoked_at: datetime | None = Field(default=None)  # null = active
    created_at: datetime = Field(default_factory=utcnow, nullable=False)


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
    country: str | None = Field(default=None)
    state: str | None = Field(default=None)
    age: int | None = Field(default=None)
    github_url: str | None = Field(default=None)
    linkedin_url: str | None = Field(default=None)
    instagram_url: str | None = Field(default=None)
    avatar_url: str | None = Field(default=None)

    created_at: datetime = Field(default_factory=utcnow, nullable=False)
