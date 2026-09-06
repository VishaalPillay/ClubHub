"""add kind to promotion notices

Revision ID: e56859779389
Revises: 0b30cc8832b2
Create Date: 2026-09-06 11:12:33.771197

Demote now sends a notice too (previously promote-only), so the notice needs to say
which direction it was. Existing rows (this table is ephemeral — polled and deleted
within seconds of creation, so there's realistically nothing to backfill) default to
'promote' to match their only prior meaning.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e56859779389"
down_revision: str | None = "0b30cc8832b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "promotion_notices",
        sa.Column("kind", sa.String(), nullable=False, server_default="promote"),
    )
    op.alter_column("promotion_notices", "kind", server_default=None)
    op.create_check_constraint(
        "chk_notice_kind", "promotion_notices", "kind IN ('promote', 'demote')"
    )


def downgrade() -> None:
    op.drop_constraint("chk_notice_kind", "promotion_notices", type_="check")
    op.drop_column("promotion_notices", "kind")
