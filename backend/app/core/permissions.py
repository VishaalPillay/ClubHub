"""Role hierarchy + rank helpers (single source of truth for RBAC ordering).

Stored as strings per docs/adr/0001; ordering comes from this list, not enum ordinals.
"""

from enum import StrEnum

# Ordered low -> high authority.
ROLE_HIERARCHY: list[str] = [
    "member",
    "associate",
    "lead",
    "joint_secretary",
    "secretary",
    "vice_president",
    "president",
]


class Role(StrEnum):
    member = "member"
    associate = "associate"
    lead = "lead"
    joint_secretary = "joint_secretary"
    secretary = "secretary"
    vice_president = "vice_president"
    president = "president"


def role_rank(role: str) -> int:
    """Index of a role in the hierarchy (higher = more authority)."""
    return ROLE_HIERARCHY.index(role)


def role_at_least(role: str, minimum: str) -> bool:
    return role_rank(role) >= role_rank(minimum)
