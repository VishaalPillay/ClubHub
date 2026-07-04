"""Events endpoints — all club-scoped (bearer + X-Club-ID).

Manage (create/update/delete) is Joint-Secretary+ per the README role table;
viewing and RSVP are open to every member.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlmodel import Session

from app.core.db import get_session
from app.core.deps import ClubContext, verify_club_path
from app.modules.events import service
from app.modules.events.schemas import CreateEventIn, EventOut, UpdateEventIn

router = APIRouter(prefix="/clubs", tags=["Events"])


@router.get("/{club_id}/events", response_model=list[EventOut])
def list_events(
    club_id: int,
    status_filter: str | None = Query(default=None, alias="status"),
    ctx: ClubContext = Depends(verify_club_path()),
    session: Session = Depends(get_session),
):
    return service.list_events(session, ctx, status_filter)


@router.post("/{club_id}/events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(
    club_id: int,
    body: CreateEventIn,
    ctx: ClubContext = Depends(verify_club_path("joint_secretary")),
    session: Session = Depends(get_session),
):
    return service.create_event(
        session,
        ctx,
        body.title,
        body.type,
        body.description,
        body.event_date,
        body.event_time,
        body.location,
    )


@router.put("/{club_id}/events/{event_id}", response_model=EventOut)
def update_event(
    club_id: int,
    event_id: int,
    body: UpdateEventIn,
    ctx: ClubContext = Depends(verify_club_path("joint_secretary")),
    session: Session = Depends(get_session),
):
    return service.update_event(session, ctx, event_id, body.model_dump(exclude_unset=True))


@router.delete("/{club_id}/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    club_id: int,
    event_id: int,
    ctx: ClubContext = Depends(verify_club_path("joint_secretary")),
    session: Session = Depends(get_session),
) -> None:
    service.delete_event(session, ctx, event_id)


@router.post("/{club_id}/events/{event_id}/rsvp", response_model=EventOut)
def rsvp_event(
    club_id: int,
    event_id: int,
    ctx: ClubContext = Depends(verify_club_path()),
    session: Session = Depends(get_session),
):
    return service.rsvp_event(session, ctx, event_id)


@router.delete("/{club_id}/events/{event_id}/rsvp", response_model=EventOut)
def unrsvp_event(
    club_id: int,
    event_id: int,
    ctx: ClubContext = Depends(verify_club_path()),
    session: Session = Depends(get_session),
):
    return service.unrsvp_event(session, ctx, event_id)
