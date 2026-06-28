"""Announcements endpoints — all club-scoped (bearer + X-Club-ID)."""

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.core.db import get_session
from app.core.deps import ClubContext, verify_club_path
from app.modules.announcements import service
from app.modules.announcements.schemas import (
    AnnouncementOut,
    CreateAnnouncementIn,
    UpdateAnnouncementIn,
)

router = APIRouter(prefix="/clubs", tags=["Announcements"])


@router.get("/{club_id}/announcements", response_model=list[AnnouncementOut])
def list_announcements(
    club_id: int,
    ctx: ClubContext = Depends(verify_club_path()),
    session: Session = Depends(get_session),
):
    return service.list_announcements(session, ctx)


@router.post(
    "/{club_id}/announcements",
    response_model=AnnouncementOut,
    status_code=status.HTTP_201_CREATED,
)
def create_announcement(
    club_id: int,
    body: CreateAnnouncementIn,
    ctx: ClubContext = Depends(verify_club_path("lead")),
    session: Session = Depends(get_session),
):
    return service.create_announcement(
        session,
        ctx,
        body.title,
        body.body,
        body.type,
        body.scope,
        body.domain_id,
    )


@router.put("/{club_id}/announcements/{announcement_id}", response_model=AnnouncementOut)
def update_announcement(
    club_id: int,
    announcement_id: int,
    payload: UpdateAnnouncementIn,
    ctx: ClubContext = Depends(verify_club_path()),
    session: Session = Depends(get_session),
):
    return service.update_announcement(
        session,
        ctx,
        announcement_id,
        payload.title,
        payload.body,
        payload.type,
    )


@router.delete("/{club_id}/announcements/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(
    club_id: int,
    announcement_id: int,
    ctx: ClubContext = Depends(verify_club_path()),
    session: Session = Depends(get_session),
) -> None:
    service.delete_announcement(session, ctx, announcement_id)
