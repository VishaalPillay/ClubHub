"""Auth business logic (thin router -> fat service)."""

from datetime import timedelta

from fastapi import status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlmodel import Session, select

from app.core.config import settings
from app.core.exceptions import AppError
from app.core.security import (
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models import RefreshToken, User
from app.models.base import utcnow


def register_user(session: Session, name: str, email: str, password: str) -> User:
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing is not None:
        raise AppError(status.HTTP_409_CONFLICT, "Email already registered.", "EMAIL_TAKEN")

    user = User(name=name, email=email, password_hash=hash_password(password))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def authenticate_user(session: Session, email: str, password: str) -> User:
    user = session.exec(select(User).where(User.email == email)).first()
    # password_hash is null for Google-only accounts — reject password login for those too.
    if (
        user is None
        or user.password_hash is None
        or not verify_password(password, user.password_hash)
    ):
        raise AppError(
            status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.", "BAD_CREDENTIALS"
        )
    return user


def authenticate_google(session: Session, credential: str) -> tuple[User, bool]:
    """Sign in / sign up with a Google Identity Services ID token.

    Verifies the JWT's signature and audience against GOOGLE_CLIENT_ID, then resolves
    the account in precedence order: known `google_sub` -> sign in; matching email ->
    link Google to the existing account; otherwise create a password-less user.
    Returns (user, is_new) — the frontend routes brand-new users to the profile step.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise AppError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Google sign-in is not configured on this server.",
            "GOOGLE_NOT_CONFIGURED",
        )

    try:
        claims = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except ValueError as exc:  # bad signature, wrong audience, expired, malformed
        raise AppError(
            status.HTTP_401_UNAUTHORIZED, "Invalid Google credential.", "INVALID_GOOGLE_TOKEN"
        ) from exc

    sub: str = claims["sub"]
    email: str | None = claims.get("email")
    if not email or not claims.get("email_verified", False):
        raise AppError(
            status.HTTP_401_UNAUTHORIZED,
            "Google account has no verified email.",
            "GOOGLE_EMAIL_UNVERIFIED",
        )

    user = session.exec(select(User).where(User.google_sub == sub)).first()
    if user is not None:
        return user, False

    user = session.exec(select(User).where(User.email == email)).first()
    if user is not None:
        # Same verified email — link Google to the existing (password) account.
        user.google_sub = sub
        if user.avatar_url is None and claims.get("picture"):
            user.avatar_url = claims["picture"]
        session.add(user)
        session.commit()
        session.refresh(user)
        return user, False

    user = User(
        name=claims.get("name") or email.split("@")[0],
        email=email,
        google_sub=sub,
        avatar_url=claims.get("picture"),
        # password_hash stays None — authenticate_user rejects password login for these.
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user, True


# --- Refresh tokens (opaque, hashed at rest, rotated on every use — ADR-0002) ---


def issue_refresh_token(session: Session, user_id: int) -> str:
    """Create a refresh-token row for the user and return the raw (cookie) value."""
    raw, token_hash = generate_refresh_token()
    session.add(
        RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    session.commit()
    return raw


def rotate_refresh_token(session: Session, raw: str) -> tuple[User, str]:
    """Validate a presented refresh token, revoke it, and issue a replacement.

    Reuse detection: a *revoked* hash showing up again means the token was stolen and already
    rotated (by us or by the thief) — revoke every active token for that user so both parties
    are forced to log in again.
    """
    invalid = AppError(
        status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token.", "INVALID_REFRESH"
    )

    record = session.exec(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw))
    ).first()
    if record is None:
        raise invalid

    if record.revoked_at is not None:
        _revoke_all_for_user(session, record.user_id)
        raise AppError(
            status.HTTP_401_UNAUTHORIZED,
            "Refresh token reuse detected — all sessions revoked.",
            "REFRESH_REUSED",
        )

    if record.expires_at <= utcnow():
        raise invalid

    user = session.get(User, record.user_id)
    if user is None:
        raise invalid

    record.revoked_at = utcnow()
    session.add(record)

    raw_new, hash_new = generate_refresh_token()
    session.add(
        RefreshToken(
            user_id=record.user_id,
            token_hash=hash_new,
            expires_at=utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    session.commit()
    return user, raw_new


def revoke_refresh_token(session: Session, raw: str) -> None:
    """Best-effort revoke for logout — silently ignores unknown/already-revoked tokens."""
    record = session.exec(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw))
    ).first()
    if record is not None and record.revoked_at is None:
        record.revoked_at = utcnow()
        session.add(record)
        session.commit()


def _revoke_all_for_user(session: Session, user_id: int) -> None:
    active = session.exec(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
    ).all()
    now = utcnow()
    for token in active:
        token.revoked_at = now
        session.add(token)
    session.commit()
