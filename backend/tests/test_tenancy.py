"""Cross-club isolation — SCAFFOLD.

Fleshed out into full HTTP-level assertions when the club-scoped modules are ported. For now
this proves the data-model invariant that get_club_context relies on: a user's membership is
scoped per club, so a member of club A has no membership row in club B.
"""

from sqlmodel import select

from app.models import Club, ClubMember, User


def test_membership_is_scoped_per_club(session):
    user = User(name="Bob", email="bob@example.com", password_hash="x")
    session.add(user)
    session.commit()
    session.refresh(user)

    club_a = Club(name="Club A", code="AAA-0001", owner_id=user.id)
    club_b = Club(name="Club B", code="BBB-0002", owner_id=user.id)
    session.add(club_a)
    session.add(club_b)
    session.commit()
    session.refresh(club_a)
    session.refresh(club_b)

    # Bob is a member of A only.
    session.add(ClubMember(user_id=user.id, club_id=club_a.id, role="member"))
    session.commit()

    in_a = session.exec(
        select(ClubMember).where(
            ClubMember.user_id == user.id, ClubMember.club_id == club_a.id
        )
    ).first()
    in_b = session.exec(
        select(ClubMember).where(
            ClubMember.user_id == user.id, ClubMember.club_id == club_b.id
        )
    ).first()

    assert in_a is not None and in_a.role == "member"
    assert in_b is None  # the isolation invariant: no leakage into club B
