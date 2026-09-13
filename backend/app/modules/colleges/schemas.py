"""Colleges response schema (validation at the API edge)."""

from pydantic import BaseModel


class CollegeOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}
