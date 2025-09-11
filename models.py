# models.py
from typing import List, Optional
from sqlmodel import Field, SQLModel, Relationship

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    hashed_password: str
    role: str # 'president', 'lead', 'member'
    
    domain_id: Optional[int] = Field(default=None, foreign_key="domain.id")
    
    # Relationship Attributes
    domain: Optional["Domain"] = Relationship(back_populates="members")
    
    # Explicitly define the foreign keys for each relationship to resolve ambiguity
    created_tasks: List["Task"] = Relationship(
        back_populates="creator",
        sa_relationship_kwargs={"foreign_keys": "[Task.creator_id]"}
    )
    assigned_tasks: List["Task"] = Relationship(
        back_populates="assignee",
        sa_relationship_kwargs={"foreign_keys": "[Task.assignee_id]"}
    )

class Domain(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    
    # Relationship Attributes
    members: List["User"] = Relationship(back_populates="domain")
    tasks: List["Task"] = Relationship(back_populates="domain")

class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: Optional[str] = None
    status: str = Field(default="todo") # 'todo', 'in_progress', 'completed'
    
    domain_id: int = Field(foreign_key="domain.id")
    assignee_id: int = Field(foreign_key="user.id")
    creator_id: int = Field(foreign_key="user.id")

    # Relationship Attributes
    domain: "Domain" = Relationship(back_populates="tasks")
    
    # Explicitly define the foreign keys for each relationship to resolve ambiguity
    assignee: "User" = Relationship(
        back_populates="assigned_tasks",
        sa_relationship_kwargs={"foreign_keys": "[Task.assignee_id]"},
    )
    creator: "User" = Relationship(
        back_populates="created_tasks",
        sa_relationship_kwargs={"foreign_keys": "[Task.creator_id]"},
    )