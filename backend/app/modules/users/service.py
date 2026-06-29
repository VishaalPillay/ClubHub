"""Users/profile business logic (thin router -> fat service)."""

from sqlmodel import Session

from app.models import User
from app.modules.users.schemas import UpdateProfileIn


def update_profile(session: Session, user: User, payload: UpdateProfileIn) -> User:
    """Apply a partial profile update to the already-loaded user.

    `exclude_unset` keeps this a true partial update — only the fields the client
    actually sent are touched. `mode="json"` coerces the HttpUrl values back to
    plain strings so they fit the VARCHAR columns.
    """
    changes = payload.model_dump(exclude_unset=True, mode="json")
    for field, value in changes.items():
        setattr(user, field, value)

    session.add(user)
    session.commit()
    session.refresh(user)
    return user
