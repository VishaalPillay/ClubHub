# routes/domains.py
from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlmodel import Session, select

from models import Domain, User
from schemas import DomainCreate, DomainPublic
from database import engine
from auth import require_role, get_current_user

router = APIRouter(prefix="/domains", tags=["Domains"])

@router.post("/", response_model=DomainPublic, status_code=status.HTTP_201_CREATED)
def create_domain(
    domain_create: DomainCreate,
    current_user: User = Depends(require_role("president"))
):
    """
    Create a new domain. Only accessible by users with the 'president' role.
    """
    with Session(engine) as session:
        existing_domain = session.exec(select(Domain).where(Domain.name == domain_create.name)).first()
        if existing_domain:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Domain with name '{domain_create.name}' already exists."
            )

        new_domain = Domain(name=domain_create.name)
        session.add(new_domain)
        session.commit()
        session.refresh(new_domain)
        return new_domain

@router.get("/", response_model=List[DomainPublic])
def get_all_domains(current_user: User = Depends(get_current_user)):
    """
    Get a list of all domains. Accessible by any authenticated user.
    """
    with Session(engine) as session:
        domains = session.exec(select(Domain)).all()
        return domains