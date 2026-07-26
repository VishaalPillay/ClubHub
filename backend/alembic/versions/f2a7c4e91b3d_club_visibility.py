"""club visibility + accepting_requests

Revision ID: f2a7c4e91b3d
Revises: 0096ed622e47
Create Date: 2026-07-26 00:00:00.000000

Replaces the `is_public` boolean with a three-state `visibility` VARCHAR ("public" |
"institution" | "unlisted", per ADR-0001 — a boolean was already outgrowing itself) plus
an independent `accepting_requests` toggle (a club can stay listed/browsable while paused
on intake). Existing clubs are backfilled from their current `is_public` value so no club
changes behavior on upgrade.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f2a7c4e91b3d"
down_revision: str | None = "0096ed622e47"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "clubs",
        sa.Column("visibility", sa.String(), nullable=False, server_default="public"),
    )
    op.add_column(
        "clubs",
        sa.Column("accepting_requests", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    # Backfill from the column being replaced: public stayed public, everything that was
    # hidden becomes "unlisted" (the closest equivalent of the old is_public=False).
    op.execute("UPDATE clubs SET visibility = CASE WHEN is_public THEN 'public' ELSE 'unlisted' END")
    op.drop_column("clubs", "is_public")


def downgrade() -> None:
    op.add_column(
        "clubs",
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.execute("UPDATE clubs SET is_public = (visibility != 'unlisted')")
    op.drop_column("clubs", "accepting_requests")
    op.drop_column("clubs", "visibility")
