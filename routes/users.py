# routes/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from models import User
from schemas import UserCreate, UserPublic
from auth import get_password_hash, get_current_user
from database import engine

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/register", response_model=UserPublic)
def register_user(user_create: UserCreate):
    with Session(engine) as session:
        # Check if user already exists
        existing_user = session.exec(select(User).where(User.email == user_create.email)).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        
        hashed_password = get_password_hash(user_create.password)
        
        new_user = User(
            name=user_create.name,
            email=user_create.email,
            hashed_password=hashed_password,
            role=user_create.role,
            domain_id=user_create.domain_id,
        )

        session.add(new_user)
        session.commit()
        session.refresh(new_user)
        
        return new_user

@router.get("/me", response_model=UserPublic)
def read_users_me(current_user: User = Depends(get_current_user)):
    # The get_current_user dependency will handle all the auth logic
    # If the code reaches here, the user is authenticated.
    return current_user