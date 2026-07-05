"""Media storage — one interface, two backends (local disk for dev, S3 for prod).

`save_media(key, data, content_type)` is the single chokepoint for storing uploaded
bytes; it returns the public URL to persist (e.g. on `users.avatar_url`). The backend
is picked by `settings.STORAGE_BACKEND` so the calling code never branches:

- "local": writes under MEDIA_ROOT and returns MEDIA_BASE_URL-based URLs. The app
  mounts StaticFiles at /media for this backend (see main.py). Dev only — files on
  an ephemeral container/host do not survive redeploys.
- "s3": puts the object into S3_BUCKET (public-read via bucket policy is the deploy's
  concern) and returns S3_PUBLIC_BASE_URL-based URLs (CloudFront etc.), falling back
  to the standard bucket URL.
"""

from pathlib import Path

from app.core.config import settings


def save_media(key: str, data: bytes, content_type: str) -> str:
    """Store `data` under `key` (e.g. "avatars/7/ab12….webp") and return its public URL."""
    if settings.STORAGE_BACKEND == "s3":
        return _save_s3(key, data, content_type)
    return _save_local(key, data)


def _save_local(key: str, data: bytes) -> str:
    root = Path(settings.MEDIA_ROOT).resolve()
    path = (root / key).resolve()
    if not path.is_relative_to(root):  # defense in depth — keys are server-generated
        raise ValueError(f"media key escapes MEDIA_ROOT: {key!r}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return f"{settings.MEDIA_BASE_URL.rstrip('/')}/{key}"


def _save_s3(key: str, data: bytes, content_type: str) -> str:
    import boto3  # imported lazily so the local backend never needs AWS config

    client = boto3.client("s3", region_name=settings.S3_REGION or None)
    client.put_object(
        Bucket=settings.S3_BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type,
        CacheControl="public, max-age=31536000, immutable",  # keys are content-unique
    )
    if settings.S3_PUBLIC_BASE_URL:
        return f"{settings.S3_PUBLIC_BASE_URL.rstrip('/')}/{key}"
    return f"https://{settings.S3_BUCKET}.s3.{settings.S3_REGION}.amazonaws.com/{key}"
