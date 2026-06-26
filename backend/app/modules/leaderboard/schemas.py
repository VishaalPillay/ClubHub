"""Leaderboard response schemas."""

from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    name: str
    role: str
    domain_id: int | None
    domain_name: str | None
    points: int
