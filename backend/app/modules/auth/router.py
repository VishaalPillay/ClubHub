"""Auth endpoints: register, login, google, refresh, logout, and /me.

Access token is returned in the JSON body (ADR-0002); the refresh token travels only in an
httpOnly cookie scoped to /auth so it never touches JavaScript. /google verifies a Google
Identity Services ID token server-side and issues the exact same session pair.
"""

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from sqlmodel import Session

from app.core.config import settings
from app.core.db import get_session
from app.core.deps import get_current_user
from app.core.exceptions import AppError
from app.core.ratelimit import limiter
from app.core.security import create_access_token
from app.models import User
from app.modules.auth import service
from app.modules.auth.schemas import (
    GoogleAuthIn,
    GoogleTokenOut,
    LoginIn,
    MeOut,
    RegisterIn,
    TokenOut,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

_COOKIE_PATH = "/auth"  # the cookie only rides on /auth/* requests


def _set_refresh_cookie(response: Response, raw: str) -> None:
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=raw,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path=_COOKIE_PATH,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def register(
    request: Request,
    body: RegisterIn,
    response: Response,
    session: Session = Depends(get_session),
) -> TokenOut:
    user = service.register_user(session, body.name, body.email, body.password)
    _set_refresh_cookie(response, service.issue_refresh_token(session, user.id))
    return TokenOut(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenOut)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def login(
    request: Request,
    body: LoginIn,
    response: Response,
    session: Session = Depends(get_session),
) -> TokenOut:
    user = service.authenticate_user(session, body.email, body.password)
    _set_refresh_cookie(response, service.issue_refresh_token(session, user.id))
    return TokenOut(access_token=create_access_token(user.id))


@router.post("/google", response_model=GoogleTokenOut)
@limiter.limit(settings.RATE_LIMIT_AUTH)
def google(
    request: Request,
    body: GoogleAuthIn,
    response: Response,
    session: Session = Depends(get_session),
) -> GoogleTokenOut:
    """Sign in / sign up with a Google ID token. Same session contract as register/login."""
    user, is_new = service.authenticate_google(session, body.credential)
    _set_refresh_cookie(response, service.issue_refresh_token(session, user.id))
    return GoogleTokenOut(access_token=create_access_token(user.id), is_new=is_new)


@router.post("/refresh", response_model=TokenOut)
def refresh(
    response: Response,
    session: Session = Depends(get_session),
    refresh_token: str | None = Cookie(default=None, alias=settings.REFRESH_COOKIE_NAME),
) -> TokenOut:
    """Rotate the refresh token and mint a new access token. No bearer required."""
    if not refresh_token:
        raise AppError(
            status.HTTP_401_UNAUTHORIZED, "No refresh token cookie.", "NO_REFRESH_TOKEN"
        )
    user, raw_new = service.rotate_refresh_token(session, refresh_token)
    _set_refresh_cookie(response, raw_new)
    return TokenOut(access_token=create_access_token(user.id))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    session: Session = Depends(get_session),
    refresh_token: str | None = Cookie(default=None, alias=settings.REFRESH_COOKIE_NAME),
) -> None:
    """Revoke the presented refresh token (if any) and clear the cookie. Idempotent."""
    if refresh_token:
        service.revoke_refresh_token(session, refresh_token)
    response.delete_cookie(key=settings.REFRESH_COOKIE_NAME, path=_COOKIE_PATH)


@router.get("/me", response_model=MeOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
