"""Users/profile endpoints — identity-scoped (bearer only, no X-Club-ID).

Profile reads + writes live here. GET /auth/me stays as-is (partial, and still
consumed by the frontend); GET /users/me returns the full profile.
"""

from fastapi import APIRouter, Depends, File, UploadFile
from sqlmodel import Session

from app.core.db import get_session
from app.core.deps import get_current_user
from app.models import User
from app.modules.users import service
from app.modules.users.schemas import ProfileOut, UpdateProfileIn

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=ProfileOut)
def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.put("/me", response_model=ProfileOut)
def update_me(
    payload: UpdateProfileIn,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> User:
    return service.update_profile(session, current_user, payload)


@router.post("/me/avatar", response_model=ProfileOut)
def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> User:
    """Upload a profile picture (multipart). Validated/resized server-side; see service."""
    data = file.file.read()
    return service.set_avatar(session, current_user, data, file.content_type)
