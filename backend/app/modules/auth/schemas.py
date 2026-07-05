"""Auth request/response schemas (validation at the API edge)."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthIn(BaseModel):
    """The ID token (JWT `credential`) issued by Google Identity Services on the client."""

    credential: str = Field(min_length=1)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class GoogleTokenOut(TokenOut):
    """TokenOut plus `is_new` so the frontend can route first-time users to the profile step."""

    is_new: bool


class MeOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    institution: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
