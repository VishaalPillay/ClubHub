"""users profile_completed

Revision ID: 22dca534e69f
Revises: e4a1f6c9d371
Create Date: 2026-07-16 17:17:38.244738

One-way registration-completion latch (see users.service.update_profile). Existing
accounts are grandfathered to TRUE so the new (app)-shell gate never bounces them
into the register wizard.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "22dca534e69f"
down_revision: str | None = "e4a1f6c9d371"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # server_default keeps the NOT NULL add valid on populated tables and protects
    # raw inserts; the ORM default (False) covers application writes.
    op.add_column(
        "users",
        sa.Column("profile_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # Grandfather every pre-existing account so nobody is bounced into registration.
    op.execute("UPDATE users SET profile_completed = TRUE")


def downgrade() -> None:
    op.drop_column("users", "profile_completed")
