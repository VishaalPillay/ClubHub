"""Events business logic — CRUD (Joint-Secretary+) and member RSVP.

`event_rsvps` is the source of truth for attendance; `events.attendees` is the cached count,
updated in the same transaction (mirrors ClubMember.points <- points_ledger). The unique
(event_id, user_id) constraint makes RSVP idempotent even under a race.
"""

from datetime import date, time

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.deps import ClubContext
from app.core.exceptions import AppError
from app.core.tenant import tenant_query
from app.models import Event, EventRsvp, User

# ── Helpers ───────────────────────────────────────────────────────────────────

def _enrich(session: Session, ctx: ClubContext, events: list[Event]) -> list[dict]:
    """Attach creator_name and the caller's RSVP flag (batched, no N+1)."""
    if not events:
        return []

    creator_ids = {e.creator_id for e in events}
    creators = {
        u.id: u.name
        for u in session.exec(select(User).where(User.id.in_(creator_ids))).all()
    }

    event_ids = {e.id for e in events}
    my_rsvps = {
        r.event_id
        for r in session.exec(
            select(EventRsvp).where(
                EventRsvp.user_id == ctx.user_id,
                EventRsvp.event_id.in_(event_ids),
            )
        ).all()
    }

    return [
        {
            "id": e.id,
            "club_id": e.club_id,
            "creator_id": e.creator_id,
            "creator_name": creators.get(e.creator_id, ""),
            "title": e.title,
            "type": e.type,
            "description": e.description,
            "event_date": e.event_date,
            "event_time": e.event_time,
            "location": e.location,
            "status": e.status,
            "attendees": e.attendees,
            "my_rsvp": e.id in my_rsvps,
            "created_at": e.created_at,
        }
        for e in events
    ]


def _load_event(session: Session, ctx: ClubContext, eid: int) -> Event:
    event = session.exec(tenant_query(Event, ctx).where(Event.id == eid)).first()
    if event is None:
        raise AppError(
            status.HTTP_404_NOT_FOUND, "Event not found in this club.", "EVENT_NOT_FOUND"
        )
    return event


# ── Service functions ─────────────────────────────────────────────────────────

def list_events(session: Session, ctx: ClubContext, status_filter: str | None) -> list[dict]:
    """All club events (any member), soonest event_date first, undated last."""
    query = tenant_query(Event, ctx)
    if status_filter is not None:
        query = query.where(Event.status == status_filter)
    events = list(
        session.exec(
            query.order_by(Event.event_date.asc().nulls_last(), Event.created_at.desc())
        ).all()
    )
    return _enrich(session, ctx, events)


def create_event(
    session: Session,
    ctx: ClubContext,
    title: str,
    event_type: str,
    description: str | None,
    event_date: date | None,
    event_time: time | None,
    location: str | None,
) -> dict:
    event = Event(
        club_id=ctx.club_id,
        creator_id=ctx.user_id,
        title=title,
        type=event_type,
        description=description,
        event_date=event_date,
        event_time=event_time,
        location=location,
    )
    session.add(event)
    session.commit()
    session.refresh(event)
    return _enrich(session, ctx, [event])[0]


def update_event(session: Session, ctx: ClubContext, eid: int, changes: dict) -> dict:
    """Apply the provided (already-validated) fields; None means 'not provided'."""
    event = _load_event(session, ctx, eid)

    for field, value in changes.items():
        if value is not None:
            setattr(event, field, value)

    session.add(event)
    session.commit()
    session.refresh(event)
    return _enrich(session, ctx, [event])[0]


def delete_event(session: Session, ctx: ClubContext, eid: int) -> None:
    event = _load_event(session, ctx, eid)
    session.delete(event)
    session.commit()


def rsvp_event(session: Session, ctx: ClubContext, eid: int) -> dict:
    """Idempotent RSVP: an existing row is a no-op; a new one bumps the cached count."""
    event = _load_event(session, ctx, eid)

    existing = session.exec(
        select(EventRsvp).where(EventRsvp.event_id == eid, EventRsvp.user_id == ctx.user_id)
    ).first()
    if existing is None:
        session.add(EventRsvp(club_id=ctx.club_id, event_id=eid, user_id=ctx.user_id))
        event.attendees += 1
        session.add(event)
        try:
            session.commit()
        except IntegrityError:
            # Concurrent double-RSVP hit uq_event_rsvp — the other request won; that's fine.
            session.rollback()
        session.refresh(event)

    return _enrich(session, ctx, [event])[0]


def unrsvp_event(session: Session, ctx: ClubContext, eid: int) -> dict:
    """Idempotent un-RSVP: removing a non-existent RSVP is a no-op."""
    event = _load_event(session, ctx, eid)

    existing = session.exec(
        select(EventRsvp).where(EventRsvp.event_id == eid, EventRsvp.user_id == ctx.user_id)
    ).first()
    if existing is not None:
        session.delete(existing)
        event.attendees = max(0, event.attendees - 1)
        session.add(event)
        session.commit()
        session.refresh(event)

    return _enrich(session, ctx, [event])[0]
