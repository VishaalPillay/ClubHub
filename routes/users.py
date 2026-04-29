# routes/users.py
from fastapi import APIRouter, Depends, HTTPException, status
from database import get_db_connection
from schemas import UserCreate, UserPublic
from auth import get_password_hash, get_current_user

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def register_user(
    user_create: UserCreate, 
    connection = Depends(get_db_connection)
):
    cursor = connection.cursor(dictionary=True)
    
    # Check if user already exists
    cursor.execute("SELECT id FROM users WHERE email = %s", (user_create.email,))
    if cursor.fetchone():
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    hashed_password = get_password_hash(user_create.password)
    
    # Insert new user
    insert_query = """
    INSERT INTO users (name, email, hashed_password, role, domain_id)
    VALUES (%s, %s, %s, %s, %s)
    """
    cursor.execute(insert_query, (
        user_create.name,
        user_create.email,
        hashed_password,
        user_create.role,
        user_create.domain_id
    ))
    
    user_id = cursor.lastrowid
    connection.commit()
    
    # Fetch the newly created user
    cursor.execute("SELECT id, name, email, role, domain_id FROM users WHERE id = %s", (user_id,))
    new_user = cursor.fetchone()
    cursor.close()
    
    return new_user

@router.get("/me", response_model=UserPublic)
def read_users_me(current_user: dict = Depends(get_current_user)):
    # The get_current_user dependency will handle all the auth logic
    return current_user