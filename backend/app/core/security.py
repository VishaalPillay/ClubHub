"""Password hashing + JWT helpers (ported from the prototype auth.py)."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int, expires_delta: timedelta | None = None) -> str:
    """Access token carries only the user id (`sub`) — global identity, no club context."""
    expire = datetime.now(UTC) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> int | None:
    """Return the user id from a valid token, or None if invalid/expired."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        sub = payload.get("sub")
        return int(sub) if sub is not None else None
    except (JWTError, ValueError):
        return None


def generate_refresh_token() -> tuple[str, str]:
    """Return (raw, hash) for a new opaque refresh token.

    The raw value goes to the client (httpOnly cookie); only the SHA-256 hash is stored.
    A high-entropy random secret doesn't need a slow hash — sha256 is enough (unlike passwords).
    """
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    """Deterministic hash for looking a presented refresh token up in the database."""
    return hashlib.sha256(raw.encode()).hexdigest()
