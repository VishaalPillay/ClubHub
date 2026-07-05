"""Application settings — env-driven, no secrets in code (replaces hardcoded values).

Values are read from the environment (and a local .env when present). See .env.example
and docs/adr/0003-execution-model.md for the DATABASE_URL host conventions.
"""

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Placeholder shipped in .env.example; the app must not boot with it (or an empty value).
_PLACEHOLDER_JWT_SECRET = "change-me-in-env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Runtime mode — set DEBUG=true to relax production-only guards (e.g. the JWT secret
    # check below) for local/host test runs. Never enable in production.
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+psycopg://clubhub:clubhub@db:5432/clubhub"

    # Auth / JWT — short-lived access token; long-lived refresh token in an httpOnly cookie
    # (rotated on every /auth/refresh; see docs/adr/0002-auth-token-contract.md).
    JWT_SECRET_KEY: str = _PLACEHOLDER_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    REFRESH_COOKIE_NAME: str = "clubhub_refresh"
    # False for local http (and the in-container test client, which drops Secure cookies over
    # http). MUST be set true in any HTTPS deployment — see the deployment checklist in ADR-0002.
    COOKIE_SECURE: bool = False

    # CORS — comma-separated list of explicit origins (never "*" with credentials).
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Google OAuth — GOOGLE_CLIENT_ID is the audience POST /auth/google verifies ID tokens
    # against; the endpoint returns 503 GOOGLE_NOT_CONFIGURED while it is empty.
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Media storage (avatar uploads) — "local" writes under MEDIA_ROOT and serves via /media
    # (dev only; not durable on ephemeral hosts); "s3" writes to S3_BUCKET and returns
    # S3_PUBLIC_BASE_URL-based URLs. Switch to s3 in any real deployment.
    STORAGE_BACKEND: str = "local"  # local | s3
    MEDIA_ROOT: str = "media"
    MEDIA_BASE_URL: str = "http://localhost:8000/media"
    S3_BUCKET: str = ""
    S3_REGION: str = ""
    S3_PUBLIC_BASE_URL: str = ""  # e.g. CloudFront domain; defaults to the bucket URL when empty
    MAX_UPLOAD_MB: int = 5

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @model_validator(mode="after")
    def _guard_jwt_secret(self) -> "Settings":
        """Fail fast on startup if the JWT secret is unset/placeholder (unless DEBUG)."""
        if not self.DEBUG and self.JWT_SECRET_KEY in ("", _PLACEHOLDER_JWT_SECRET):
            raise RuntimeError(
                "JWT_SECRET_KEY is unset or still the placeholder default. Set a real secret "
                '(python -c "import secrets; print(secrets.token_hex(32))") '
                "or set DEBUG=true for local/test runs."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
