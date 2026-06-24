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


# Roles that carry a domain assignment (exec roles above 'lead' are club-wide).
DOMAIN_SCOPED_ROLES: frozenset[str] = frozenset({"member", "associate", "lead"})

# joint_secretary / secretary may only grant roles up to 'lead' (the promotion cap).
_CAPPED_GRANTERS: frozenset[str] = frozenset({"joint_secretary", "secretary"})
_GRANT_CEILING = "lead"


def role_rank(role: str) -> int:
    """Index of a role in the hierarchy (higher = more authority)."""
    return ROLE_HIERARCHY.index(role)


def role_at_least(role: str, minimum: str) -> bool:
    return role_rank(role) >= role_rank(minimum)


def can_manage(actor_role: str, target_role: str) -> bool:
    """True if the actor may manage (change-role / remove) the target.

    Managing someone requires strictly outranking them — equal rank is not enough, so a
    member can never act on a peer (or on themselves).
    """
    return role_rank(actor_role) > role_rank(target_role)


def can_grant_role(actor_role: str, new_role: str) -> bool:
    """True if the actor may assign `new_role` to someone.

    Two rules: you may never grant a role at or above your own rank, and capped granters
    (joint_secretary / secretary) may not grant anything above 'lead'.
    """
    if role_rank(new_role) >= role_rank(actor_role):
        return False
    if actor_role in _CAPPED_GRANTERS and role_rank(new_role) > role_rank(_GRANT_CEILING):
        return False
    return True
