"""College-request request/response schemas (validation at the API edge)."""

from pydantic import BaseModel, Field


class CollegeRequestIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    country: str = Field(min_length=1, max_length=100)
    state: str | None = Field(default=None, max_length=100)


class CollegeRequestOut(BaseModel):
    id: int
    status: str

    model_config = {"from_attributes": True}
