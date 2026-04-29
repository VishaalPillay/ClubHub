# routes/domains.py
from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from database import get_db_connection
from schemas import DomainCreate, DomainPublic
from auth import require_role, get_current_user

router = APIRouter(prefix="/domains", tags=["Domains"])

@router.post("/", response_model=DomainPublic, status_code=status.HTTP_201_CREATED)
def create_domain(
    domain_create: DomainCreate,
    current_user: dict = Depends(require_role("president")),
    connection = Depends(get_db_connection)
):
    """
    Create a new domain. Only accessible by users with the 'president' role.
    """
    cursor = connection.cursor(dictionary=True)
    
    # Check if domain exists
    cursor.execute("SELECT id FROM domains WHERE name = %s", (domain_create.name,))
    if cursor.fetchone():
        cursor.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Domain with name '{domain_create.name}' already exists."
        )

    # Insert domain
    cursor.execute("INSERT INTO domains (name) VALUES (%s)", (domain_create.name,))
    domain_id = cursor.lastrowid
    connection.commit()
    
    # Fetch result
    cursor.execute("SELECT id, name FROM domains WHERE id = %s", (domain_id,))
    new_domain = cursor.fetchone()
    cursor.close()
    
    return new_domain

@router.get("/", response_model=List[DomainPublic])
def get_all_domains(
    current_user: dict = Depends(get_current_user),
    connection = Depends(get_db_connection)
):
    """
    Get a list of all domains. Accessible by any authenticated user.
    """
    cursor = connection.cursor(dictionary=True)
    cursor.execute("SELECT id, name FROM domains")
    domains = cursor.fetchall()
    cursor.close()
    
    return domains