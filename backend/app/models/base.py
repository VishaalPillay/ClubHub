"""Shared helpers for model definitions."""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC timestamp for `timestamp without time zone` columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
