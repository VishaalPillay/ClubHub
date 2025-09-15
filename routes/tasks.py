# routes/tasks.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from models import Task, User
from schemas import TaskCreate, TaskPublic, TaskUpdate
from database import engine
from auth import require_role, get_current_user

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.post("/", response_model=TaskPublic, status_code=status.HTTP_201_CREATED)
def create_task(
    task_create: TaskCreate,
    current_user: User = Depends(require_role("lead"))
):
    """
    Create a new task. Only accessible by a lead.
    The task is automatically assigned to the lead's domain.
    """
    with Session(engine) as session:
        # Security Check: Ensure the assignee is a member of the lead's domain
        assignee = session.get(User, task_create.assignee_id)
        if not assignee or assignee.domain_id != current_user.domain_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Assignee must be a member of your domain.",
            )

        new_task = Task(
            title=task_create.title,
            description=task_create.description,
            assignee_id=task_create.assignee_id,
            creator_id=current_user.id,
            domain_id=current_user.domain_id,
        )
        session.add(new_task)
        session.commit()
        session.refresh(new_task)
        return new_task

@router.get("/my", response_model=List[TaskPublic])
def get_my_tasks(current_user: User = Depends(require_role("member"))):
    """
    Get all tasks assigned to the currently logged-in member.
    """
    with Session(engine) as session:
        tasks = session.exec(select(Task).where(Task.assignee_id == current_user.id)).all()
        return tasks

@router.patch("/{task_id}/status", response_model=TaskPublic)
def update_task_status(
    task_id: int,
    task_update: TaskUpdate,
    current_user: User = Depends(require_role("member")),
):
    """
    Update the status of a task. Only accessible by the member assigned to the task.
    """
    with Session(engine) as session:
        task_to_update = session.get(Task, task_id)

        if not task_to_update:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Security Check: Ensure the user is the assignee of the task
        if task_to_update.assignee_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update tasks assigned to you.",
            )

        task_to_update.status = task_update.status
        session.add(task_to_update)
        session.commit()
        session.refresh(task_to_update)
        return task_to_update