"""Clubs business logic (thin router -> fat service)."""

import secrets

from fastapi import status
from sqlalchemy import and_, or_
from sqlmodel import Session, select

from app.core.exceptions import AppError
from app.core.permissions import role_at_least
from app.models import Club, ClubMember, Domain, JoinRequest

# Roles that require a domain assignment on join.
_DOMAIN_SCOPED_ROLES: frozenset[str] = frozenset({"member", "associate", "lead"})

# The invite code is a shareable secret; only ranks that could plausibly need to hand it
# out (the same threshold that reviews join requests) may see it via /clubs/my.
_CODE_VISIBLE_FROM: str = "joint_secretary"

# Unambiguous base-32 alphabet (no O/0, I/1 look-alikes).
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


# ── Code generation ───────────────────────────────────────────────────────────

def generate_code(session: Session, name: str) -> str:
    """Return a unique, human-friendly club code (e.g. CS-X7K2P)."""
    alpha = [c.upper() for c in name if c.isascii() and c.isalpha()]
    if len(alpha) >= 2:
        prefix = alpha[0] + alpha[1]
    elif len(alpha) == 1:
        prefix = alpha[0] + "L"
    else:
        prefix = "CL"

    for _ in range(10):
        suffix = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(5))
        code = f"{prefix}-{suffix}"
        if not session.exec(select(Club).where(Club.code == code)).first():
            return code

    raise AppError(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "Could not generate a unique club code after 10 attempts. Please try again.",
        "CODE_GENERATION_FAILED",
    )


# ── Club CRUD ─────────────────────────────────────────────────────────────────

def create_club(
    session: Session,
    user_id: int,
    name: str,
    description: str | None,
    enabled_roles: list[str],
    institution: str | None = None,
) -> Club:
    code = generate_code(session, name)
    club = Club(
        name=name,
        description=description,
        code=code,
        owner_id=user_id,
        enabled_roles=enabled_roles,
        institution=institution,
    )
    session.add(club)
    session.flush()  # populate club.id without committing the outer transaction

    session.add(ClubMember(user_id=user_id, club_id=club.id, role="president", domain_id=None))
    session.commit()
    session.refresh(club)
    return club


def get_my_clubs(session: Session, user_id: int) -> list[dict]:
    """Return clubs the user belongs to, annotated with their role + domain_id."""
    rows = session.exec(
        select(ClubMember, Club)
        .join(Club, ClubMember.club_id == Club.id)
        .where(ClubMember.user_id == user_id)
    ).all()
    # Refinement: construct dicts explicitly — don't rely on from_attributes over a Row.
    return [
        {
            "id": club.id,
            "name": club.name,
            "description": club.description,
            "institution": club.institution,
            "code": club.code if role_at_least(cm.role, _CODE_VISIBLE_FROM) else None,
            "role": cm.role,
            "domain_id": cm.domain_id,
        }
        for cm, club in rows
    ]


def get_directory(session: Session, viewer_institution: str | None) -> list[dict]:
    """Public clubs are visible to everyone; institution-scoped clubs only to viewers
    whose own profile institution matches. Unlisted clubs never appear here."""
    conditions = [Club.visibility == "public"]
    if viewer_institution:
        conditions.append(
            and_(Club.visibility == "institution", Club.institution == viewer_institution)
        )
    clubs = list(session.exec(select(Club).where(or_(*conditions))).all())
    club_ids = [c.id for c in clubs]

    domains_by_club: dict[int, list[Domain]] = {}
    if club_ids:
        for d in session.exec(select(Domain).where(Domain.club_id.in_(club_ids))).all():
            domains_by_club.setdefault(d.club_id, []).append(d)

    return [
        {
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "institution": c.institution,
            "enabled_roles": c.enabled_roles,
            "accepting_requests": c.accepting_requests,
            "domains": [
                {"id": d.id, "name": d.name, "description": d.description}
                for d in domains_by_club.get(c.id, [])
            ],
        }
        for c in clubs
    ]


def lookup_by_code(session: Session, code: str) -> dict:
    club = session.exec(select(Club).where(Club.code == code.upper())).first()
    if club is None:
        raise AppError(status.HTTP_404_NOT_FOUND, "No club found with that code.", "CLUB_NOT_FOUND")

    domains = list(session.exec(select(Domain).where(Domain.club_id == club.id)).all())
    return {
        "id": club.id,
        "name": club.name,
        "code": club.code,
        "description": club.description,
        "enabled_roles": club.enabled_roles,
        "domains": [
            {"id": d.id, "name": d.name, "description": d.description} for d in domains
        ],
    }


def get_club(session: Session, club_id: int) -> Club:
    club = session.get(Club, club_id)
    if club is None:
        raise AppError(status.HTTP_404_NOT_FOUND, "Club not found.", "CLUB_NOT_FOUND")
    return club


def update_club(
    session: Session,
    club_id: int,
    name: str | None,
    description: str | None,
    institution: str | None,
    visibility: str | None,
    accepting_requests: bool | None,
    enabled_roles: list[str] | None,
) -> Club:
    club = get_club(session, club_id)
    if name is not None:
        club.name = name
    if description is not None:
        club.description = description
    if institution is not None:
        club.institution = institution
    if visibility is not None:
        club.visibility = visibility
    if accepting_requests is not None:
        club.accepting_requests = accepting_requests
    if enabled_roles is not None:
        club.enabled_roles = enabled_roles
    session.add(club)
    session.commit()
    session.refresh(club)
    return club


# ── Join flow ─────────────────────────────────────────────────────────────────

def get_pending_requests(session: Session, user_id: int) -> list[dict]:
    """Return the current user's own JoinRequests with club metadata."""
    rows = session.exec(
        select(JoinRequest, Club)
        .join(Club, JoinRequest.club_id == Club.id)
        .where(JoinRequest.user_id == user_id)
    ).all()
    # Refinement: construct dicts explicitly — don't rely on from_attributes over a Row.
    # `code` is deliberately omitted (see PendingItem) — a pending requester isn't a
    # member and may never have seen the invite code (e.g. requested via the directory).
    return [
        {
            "id": jr.id,
            "club_id": jr.club_id,
            "club_name": club.name,
            "requested_role": jr.requested_role,
            "status": jr.status,
            "created_at": jr.created_at,
        }
        for jr, club in rows
    ]


def join_club(
    session: Session,
    user_id: int,
    club_code: str | None,
    club_id: int | None,
    requested_role: str,
    requested_domain_id: int | None,
    message: str | None,
    requester_institution: str | None = None,
) -> JoinRequest:
    # 1. Resolve club.
    # `club_id` (the directory "request to join" path) only ever resolves clubs the
    # directory would actually list: never "unlisted", and "institution"-scoped clubs
    # only for a requester whose own institution matches — otherwise a copy-pasted club
    # URL/id would bypass the same visibility scoping the directory itself enforces.
    # `club_code` (the invite-code path) is a deliberate override: leadership sharing the
    # code out-of-band is itself the authorization, so it works regardless of visibility.
    if club_id is not None:
        club = session.get(Club, club_id)
        if club is not None:
            if club.visibility == "unlisted":
                club = None
            elif club.visibility == "institution" and (
                not requester_institution or club.institution != requester_institution
            ):
                club = None
    else:
        club = session.exec(select(Club).where(Club.code == (club_code or "").upper())).first()
    if club is None:
        raise AppError(status.HTTP_404_NOT_FOUND, "No club found with that code.", "CLUB_NOT_FOUND")

    # 1b. A club can stay listed/browsable while paused on intake — this blocks every
    # submission path (code or directory), not just the directory's own button.
    if not club.accepting_requests:
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "This club is not currently accepting join requests.",
            "CLUB_NOT_RECRUITING",
        )

    # 2. State checks first (per refinement: state before payload errors).
    existing_member = session.exec(
        select(ClubMember).where(
            ClubMember.user_id == user_id,
            ClubMember.club_id == club.id,
        )
    ).first()
    if existing_member:
        raise AppError(
            status.HTTP_409_CONFLICT, "You are already a member of this club.", "ALREADY_MEMBER"
        )

    existing_request = session.exec(
        select(JoinRequest).where(
            JoinRequest.user_id == user_id,
            JoinRequest.club_id == club.id,
            JoinRequest.status == "pending",
        )
    ).first()
    if existing_request:
        raise AppError(
            status.HTTP_409_CONFLICT,
            "You already have a pending request for this club.",
            "DUPLICATE_REQUEST",
        )

    # 3. Payload validation.
    enabled = club.enabled_roles or []
    if requested_role not in enabled:
        raise AppError(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Role '{requested_role}' is not enabled for this club.",
            "ROLE_NOT_ENABLED",
        )

    # 4. Domain rules: domain-scoped roles require a valid in-club domain.
    if requested_role in _DOMAIN_SCOPED_ROLES:
        if requested_domain_id is None:
            raise AppError(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "A domain is required when requesting a domain-scoped role.",
                "DOMAIN_REQUIRED",
            )
        domain = session.get(Domain, requested_domain_id)
        if domain is None or domain.club_id != club.id:
            raise AppError(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "The requested domain does not belong to this club.",
                "DOMAIN_NOT_IN_CLUB",
            )
    else:
        # Exec roles carry no domain assignment.
        requested_domain_id = None

    jr = JoinRequest(
        user_id=user_id,
        club_id=club.id,
        requested_role=requested_role,
        requested_domain_id=requested_domain_id,
        status="pending",
        message=message,
    )
    session.add(jr)
    session.commit()
    session.refresh(jr)
    return jr


def withdraw_request(session: Session, user_id: int, request_id: int) -> None:
    jr = session.get(JoinRequest, request_id)
    if jr is None:
        raise AppError(
            status.HTTP_404_NOT_FOUND, "Join request not found.", "REQUEST_NOT_FOUND"
        )
    if jr.user_id != user_id:
        raise AppError(
            status.HTTP_403_FORBIDDEN,
            "You can only withdraw your own requests.",
            "NOT_YOUR_REQUEST",
        )
    session.delete(jr)
    session.commit()
