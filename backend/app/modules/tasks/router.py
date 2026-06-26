"""Tasks endpoints — all club-scoped (bearer + X-Club-ID)."""

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.db import get_session
from app.core.deps import ClubContext, verify_club_path
from app.modules.tasks import service
from app.modules.tasks.schemas import AssignTaskIn, CreateTaskIn, TaskOut, UpdateTaskIn

router = APIRouter(prefix="/clubs", tags=["Tasks"])


@router.get("/{club_id}/tasks", response_model=list[TaskOut])
def list_tasks(
    club_id: int,
    ctx: ClubContext = Depends(verify_club_path()),
    session: Session = Depends(get_session),
):
    return service.list_tasks(session, ctx)


@router.post(
    "/{club_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    club_id: int,
    body: CreateTaskIn,
    ctx: ClubContext = Depends(verify_club_path("lead")),
    session: Session = Depends(get_session),
):
    return service.create_task(
        session,
        ctx,
        body.domain_id,
        body.title,
        body.description,
        body.points,
        body.due_date,
        body.assignee_ids,
    )


@router.put("/{club_id}/tasks/{task_id}", response_model=TaskOut)
def update_task(
    club_id: int,
    task_id: int,
    body: UpdateTaskIn,
    ctx: ClubContext = Depends(verify_club_path()),
    session: Session = Depends(get_session),
):
    return service.update_task(
        session,
        ctx,
        task_id,
        body.title,
        body.description,
        body.due_date,
        body.status,
    )


@router.delete("/{club_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    club_id: int,
    task_id: int,
    ctx: ClubContext = Depends(verify_club_path("lead")),
    session: Session = Depends(get_session),
) -> None:
    service.delete_task(session, ctx, task_id)


@router.post("/{club_id}/tasks/{task_id}/assign", response_model=TaskOut)
def assign_task(
    club_id: int,
    task_id: int,
    body: AssignTaskIn,
    ctx: ClubContext = Depends(verify_club_path("associate")),
    session: Session = Depends(get_session),
):
    return service.assign_task(session, ctx, task_id, body.assignee_ids)
