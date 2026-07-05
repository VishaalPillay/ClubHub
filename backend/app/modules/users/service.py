"""Users/profile business logic (thin router -> fat service)."""

import io
import uuid

from fastapi import status
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlmodel import Session

from app.core import storage
from app.core.config import settings
from app.core.exceptions import AppError
from app.models import User
from app.modules.users.schemas import UpdateProfileIn

# Formats Pillow will accept from the wire; everything is re-encoded to WebP on save,
# so the stored bytes are never the client's original file.
_ACCEPTED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}
_AVATAR_SIZE = 512  # square, center-cropped


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


def set_avatar(session: Session, user: User, data: bytes, content_type: str | None) -> User:
    """Validate, normalize, and store an uploaded avatar; persist its URL on the user.

    The upload is decoded with Pillow (proving it is a real image, whatever the client
    claimed), EXIF-orientation corrected, center-cropped to a 512² square, and re-encoded
    as WebP under a content-unique key — old avatars are never overwritten, so stale
    URLs keep resolving and CDN caching can be immutable.
    """
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(data) > max_bytes:
        raise AppError(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"Image exceeds the {settings.MAX_UPLOAD_MB} MB limit.",
            "FILE_TOO_LARGE",
        )
    if content_type not in _ACCEPTED_CONTENT_TYPES:
        raise AppError(
            status.HTTP_400_BAD_REQUEST,
            "Unsupported image type — use PNG, JPEG, or WebP.",
            "UNSUPPORTED_MEDIA",
        )

    try:
        image = Image.open(io.BytesIO(data))
        image.load()  # force a full decode; corrupt files fail here, not on save
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise AppError(
            status.HTTP_400_BAD_REQUEST, "File is not a valid image.", "INVALID_IMAGE"
        ) from exc

    image = ImageOps.exif_transpose(image)
    image = image.convert("RGBA" if image.mode in ("RGBA", "LA", "P") else "RGB")
    image = ImageOps.fit(image, (_AVATAR_SIZE, _AVATAR_SIZE))

    out = io.BytesIO()
    image.save(out, format="WEBP", quality=85)

    key = f"avatars/{user.id}/{uuid.uuid4().hex}.webp"
    user.avatar_url = storage.save_media(key, out.getvalue(), "image/webp")

    session.add(user)
    session.commit()
    session.refresh(user)
    return user
