"""Seed demo data for local development (SQLModel/Postgres rewrite of the prototype seed).

Idempotent: if the demo club (code TEST-2024) already exists, seeding is skipped instead of
truncating tables. All seeded accounts use the password `password123`.

Run inside the container:  docker compose exec api python -m scripts.seed
"""

import random

from sqlmodel import Session, select

from app.core.db import engine
from app.core.security import hash_password
from app.models import Club, ClubMember, Domain, User

DEMO_CODE = "TEST-2024"
ALL_ROLES = [
    "president",
    "vice_president",
    "secretary",
    "joint_secretary",
    "lead",
    "associate",
    "member",
]


def seed() -> None:
    with Session(engine) as session:
        existing = session.exec(select(Club).where(Club.code == DEMO_CODE)).first()
        if existing is not None:
            print(f"[skip] Demo club '{DEMO_CODE}' already exists — nothing to seed.")
            return

        pwd = hash_password("password123")

        # 1. Executive users + their memberships
        execs = [
            ("Aarav President", "aarav@clubhub.com", "president", 1500),
            ("Priya VP", "priya@clubhub.com", "vice_president", 1400),
            ("Rohan Sec", "rohan@clubhub.com", "secretary", 1300),
            ("Neha JSec", "neha@clubhub.com", "joint_secretary", 1200),
        ]
        exec_rows: list[tuple[User, str, int]] = []
        for name, email, role, pts in execs:
            user = User(name=name, email=email, password_hash=pwd)
            session.add(user)
            exec_rows.append((user, role, pts))
        session.commit()
        for user, _, _ in exec_rows:
            session.refresh(user)

        owner = exec_rows[0][0]

        # 2. Club
        club = Club(
            name="Test Club",
            description="A test club for everything",
            code=DEMO_CODE,
            owner_id=owner.id,
            enabled_roles=ALL_ROLES,
        )
        session.add(club)
        session.commit()
        session.refresh(club)

        # Add execs to the club
        for user, role, pts in exec_rows:
            session.add(
                ClubMember(user_id=user.id, club_id=club.id, role=role, points=pts)
            )
        session.commit()

        # 3. Domains, each with 1 Lead, 2 Associates, 7 Members
        for dname in ["Technical", "Management", "Design"]:
            domain = Domain(club_id=club.id, name=dname, description=f"{dname} domain operations")
            session.add(domain)
            session.commit()
            session.refresh(domain)

            for i in range(1, 11):
                role = "lead" if i == 1 else "associate" if i <= 3 else "member"
                if role == "member":
                    points = random.randint(500, 1000)
                elif role == "associate":
                    points = random.randint(1000, 1200)
                else:
                    points = random.randint(1200, 1400)

                user = User(
                    name=f"{dname} {role.capitalize()} {i}",
                    email=f"{dname.lower()}_{i}@clubhub.com",
                    password_hash=pwd,
                )
                session.add(user)
                session.commit()
                session.refresh(user)

                session.add(
                    ClubMember(
                        user_id=user.id,
                        club_id=club.id,
                        role=role,
                        domain_id=domain.id,
                        points=points,
                    )
                )
            session.commit()

    print("\n[OK] Database seeded successfully!")
    print("-" * 40)
    print("TEST ACCOUNTS (password: password123):")
    print("  aarav@clubhub.com   (President)")
    print("  priya@clubhub.com   (VP)")
    print("  technical_1@clubhub.com (Lead - Technical)")
    print(f"\nCLUB CODE for joining: {DEMO_CODE}")
    print("-" * 40)


if __name__ == "__main__":
    seed()
