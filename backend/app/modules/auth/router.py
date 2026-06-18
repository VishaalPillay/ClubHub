"""Auth endpoints: register, login (access token in body per ADR-0002), and /me.

Refresh tokens and Google OAuth are intentionally deferred to a later step.
"""

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.db import get_session
from app.core.deps import get_current_user
from app.core.security import create_access_token
from app.models import User
from app.modules.auth import service
from app.modules.auth.schemas import LoginIn, MeOut, RegisterIn, TokenOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, session: Session = Depends(get_session)) -> TokenOut:
    user = service.register_user(session, body.name, body.email, body.password)
    return TokenOut(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, session: Session = Depends(get_session)) -> TokenOut:
    user = service.authenticate_user(session, body.email, body.password)
    return TokenOut(access_token=create_access_token(user.id))


@router.get("/me", response_model=MeOut)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
