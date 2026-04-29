# main.py
from datetime import timedelta
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
# Import routers and auth functions
from routes.users import router as users_router
from routes.domains import router as domains_router
from routes.tasks import router as tasks_router
from auth import verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

from database import get_db_connection, create_db_and_tables


app = FastAPI(title="ClubHub API")

@app.on_event("startup")
def on_startup():
    # This now calls the function from database.py
    create_db_and_tables()

# Include all three routers
app.include_router(users_router)
app.include_router(domains_router)
app.include_router(tasks_router) # <-- ADDED

@app.post("/token", tags=["Authentication"])
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    connection = Depends(get_db_connection)
):
    cursor = connection.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE email = %s", (form_data.username,))
    user = cursor.fetchone()
    cursor.close()

    
    if not user or not verify_password(form_data.password, user['hashed_password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

            
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Add role and domain_id to the token
    token_data = {
        "sub": user['email'],
        "role": user['role'],
        "domain_id": user['domain_id']
    }

    access_token = create_access_token(
        data=token_data, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/")
def read_root():
    return {"message": "Welcome to ClubHub"}