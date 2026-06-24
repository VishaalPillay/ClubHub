"""Tenant scoping helper — the single chokepoint for club-scoped reads.

Routing every club-owned SELECT through `tenant_query` means the `club_id` filter cannot be
forgotten (the golden rule, SYSTEM_DESIGN §9.2). Only valid for models that carry a `club_id`
column; global identity (`User`) is fetched separately by id.
"""

from sqlmodel import select
from sqlmodel.sql.expression import SelectOfScalar

from app.core.deps import ClubContext


def tenant_query(model, ctx: ClubContext) -> SelectOfScalar:
    """Return `select(model).where(model.club_id == ctx.club_id)`.

    Chain further `.where(...)` clauses for additional filters, e.g.
    `tenant_query(ClubMember, ctx).where(ClubMember.user_id == target_id)`.
    """
    return select(model).where(model.club_id == ctx.club_id)
