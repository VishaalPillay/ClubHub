"""Shared helpers for model definitions."""

from datetime import UTC, datetime


def utcnow() -> datetime:
    """Naive UTC timestamp for `timestamp without time zone` columns."""
    return datetime.now(UTC).replace(tzinfo=None)
