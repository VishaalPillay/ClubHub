"""Request dependencies: current user, club context, and role gating.

Ported from the prototype auth.py but backed by SQLModel sessions instead of raw cursors.
The golden rule (SYSTEM_DESIGN §9.2): club_id for any write comes from get_club_context,
never from the request body.
"""

from dataclasses import dataclass

from fastapi import Depends, Header, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from app.core.db import get_session
from app.core.exceptions import AppError
from app.core.permissions import role_at_least
from app.models import ClubMember, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


@dataclass
class ClubContext:
    user_id: int
    name: str
    email: str
    club_id: int
    role: str
    domain_id: int | None


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    """Decode the JWT (carries only the user id) and load the global user."""
    from app.core.security import decode_access_token

    credentials_error = AppError(
        status.HTTP_401_UNAUTHORIZED, "Could not validate credentials", "UNAUTHENTICATED"
    )

    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_error

    user = session.get(User, user_id)
    if user is None:
        raise credentials_error
    return user


def get_club_context(
    x_club_id: str | None = Header(default=None, alias="X-Club-ID"),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ClubContext:
    """Resolve the caller's membership (role + domain) for the active club."""
    if not x_club_id:
        raise AppError(
            status.HTTP_400_BAD_REQUEST,
            "X-Club-ID header is required for this endpoint.",
            "CLUB_ID_REQUIRED",
        )
    try:
        club_id = int(x_club_id)
    except ValueError:
        raise AppError(
            status.HTTP_400_BAD_REQUEST, "X-Club-ID must be an integer.", "BAD_CLUB_ID"
        ) from None

    membership = session.exec(
        select(ClubMember).where(
            ClubMember.user_id == current_user.id,
            ClubMember.club_id == club_id,
        )
    ).first()

    if membership is None:
        raise AppError(
            status.HTTP_403_FORBIDDEN, "You are not a member of this club.", "NOT_A_MEMBER"
        )

    return ClubContext(
        user_id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        club_id=club_id,
        role=membership.role,
        domain_id=membership.domain_id,
    )


def require_min_role(min_role: str):
    """Dependency factory: ensure the caller's role is at or above `min_role`."""

    def checker(ctx: ClubContext = Depends(get_club_context)) -> ClubContext:
        if not role_at_least(ctx.role, min_role):
            raise AppError(
                status.HTTP_403_FORBIDDEN,
                f"This action requires at least the '{min_role}' role.",
                "FORBIDDEN_RANK",
            )
        return ctx

    return checker


def verify_club_path(min_role: str = "member"):
    """Dependency factory: resolve club context, gate by role, then assert the URL path
    club_id matches the X-Club-ID header. Raises 400 CLUB_ID_MISMATCH on mismatch.

    Replaces the duplicated _assert_club_match helper that used to live in each router.
    Defaults to 'member' (the lowest role) so any membership passes the role gate.
    """
    _role_dep = require_min_role(min_role)

    def _check(
        club_id: int,
        ctx: ClubContext = Depends(_role_dep),
    ) -> ClubContext:
        if club_id != ctx.club_id:
            raise AppError(
                status.HTTP_400_BAD_REQUEST,
                "Path club_id does not match the X-Club-ID header.",
                "CLUB_ID_MISMATCH",
            )
        return ctx

    return _check
