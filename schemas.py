# schemas.py
from typing import Optional
from pydantic import BaseModel, EmailStr

# Properties to receive via API on user creation
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str # 'president', 'lead', 'member'
    domain_id: Optional[int] = None

# Properties to return to client
class UserPublic(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    domain_id: Optional[int] = None

    class Config:
        from_attributes = True

# Properties for the JWT Token
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Properties to receive via API on domain creation
class DomainCreate(BaseModel):
    name: str

# Properties to return to client
class DomainPublic(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

# === NEW: Task Schemas ===
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assignee_id: int

class TaskPublic(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: str
    assignee_id: int
    creator_id: int

    class Config:
        from_attributes = True

class TaskUpdate(BaseModel):
    status: str