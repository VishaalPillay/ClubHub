"""Auth business logic (thin router -> fat service)."""

from fastapi import status
from sqlmodel import Session, select

from app.core.exceptions import AppError
from app.core.security import hash_password, verify_password
from app.models import User


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
