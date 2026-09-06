"""Notice response schema (API contract)."""

from datetime import datetime

from pydantic import BaseModel


class NoticeOut(BaseModel):
    id: int
    club_name: str
    new_role: str
    kind: str
    message: str | None
    created_at: datetime
