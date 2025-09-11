# main.py
from datetime import timedelta
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select # We still need Session and select here

# Import models to ensure they are registered
from models import User

# Import routers and auth functions
from routes.users import router as users_router
from auth import verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

# Import the database functions from our new file
from database import engine, create_db_and_tables

app = FastAPI(title="ClubHub API")

@app.on_event("startup")
def on_startup():
    # This now calls the function from database.py
    create_db_and_tables()

# Include the users router
app.include_router(users_router)

@app.post("/token", tags=["Authentication"])
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == form_data.username)).first()
        
        if not user or not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        # Add role and domain_id to the token
        token_data = {
            "sub": user.email,
            "role": user.role,
            "domain_id": user.domain_id
        }

        access_token = create_access_token(
            data=token_data, expires_delta=access_token_expires
        )
        
        return {"access_token": access_token, "token_type": "bearer"}

@app.get("/")
def read_root():
    return {"message": "Welcome to ClubHub"}