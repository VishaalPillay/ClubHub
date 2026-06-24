"""fk ondelete rules

Revision ID: b7f3c1a9d2e4
Revises: cb9de7e06f67
Create Date: 2026-06-24 00:00:00.000000

Adds ON DELETE behaviour to every foreign key. The baseline created them all as plain
NO ACTION, which breaks domain deletion and won't cascade club deletion. Alembic
autogenerate does not diff FK ondelete changes, so these drop/recreate ops are hand-written.

Constraint names are PostgreSQL's defaults for the unnamed baseline FKs: <table>_<col>_fkey.
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7f3c1a9d2e4"
down_revision: str | None = "cb9de7e06f67"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# (constraint_name, table, referent_table, local_column, ondelete)
# Every referent PK column is "id". See docs/adr and the hardening plan for the rule matrix.
_FKS: list[tuple[str, str, str, str, str]] = [
    # club_id -> CASCADE everywhere; ownership/authorship user FKs -> RESTRICT;
    # nullable domain/reviewer FKs -> SET NULL; participation rows -> CASCADE.
    ("clubs_owner_id_fkey", "clubs", "users", "owner_id", "RESTRICT"),
    ("domains_club_id_fkey", "domains", "clubs", "club_id", "CASCADE"),
    ("club_members_user_id_fkey", "club_members", "users", "user_id", "CASCADE"),
    ("club_members_club_id_fkey", "club_members", "clubs", "club_id", "CASCADE"),
    ("club_members_domain_id_fkey", "club_members", "domains", "domain_id", "SET NULL"),
    ("tasks_club_id_fkey", "tasks", "clubs", "club_id", "CASCADE"),
    ("tasks_domain_id_fkey", "tasks", "domains", "domain_id", "CASCADE"),
    ("tasks_creator_id_fkey", "tasks", "users", "creator_id", "RESTRICT"),
    ("task_assignments_task_id_fkey", "task_assignments", "tasks", "task_id", "CASCADE"),
    ("task_assignments_user_id_fkey", "task_assignments", "users", "user_id", "CASCADE"),
    ("points_ledger_club_id_fkey", "points_ledger", "clubs", "club_id", "CASCADE"),
    ("points_ledger_user_id_fkey", "points_ledger", "users", "user_id", "CASCADE"),
    ("points_ledger_task_id_fkey", "points_ledger", "tasks", "task_id", "CASCADE"),
    ("join_requests_user_id_fkey", "join_requests", "users", "user_id", "CASCADE"),
    ("join_requests_club_id_fkey", "join_requests", "clubs", "club_id", "CASCADE"),
    (
        "join_requests_requested_domain_id_fkey",
        "join_requests",
        "domains",
        "requested_domain_id",
        "SET NULL",
    ),
    ("join_requests_reviewed_by_fkey", "join_requests", "users", "reviewed_by", "SET NULL"),
    ("action_requests_club_id_fkey", "action_requests", "clubs", "club_id", "CASCADE"),
    ("action_requests_requester_id_fkey", "action_requests", "users", "requester_id", "RESTRICT"),
    ("action_requests_target_id_fkey", "action_requests", "users", "target_id", "RESTRICT"),
    ("action_requests_resolved_by_fkey", "action_requests", "users", "resolved_by", "SET NULL"),
    ("announcements_club_id_fkey", "announcements", "clubs", "club_id", "CASCADE"),
    ("announcements_author_id_fkey", "announcements", "users", "author_id", "RESTRICT"),
    ("announcements_domain_id_fkey", "announcements", "domains", "domain_id", "SET NULL"),
    ("events_club_id_fkey", "events", "clubs", "club_id", "CASCADE"),
    ("events_creator_id_fkey", "events", "users", "creator_id", "RESTRICT"),
]


def upgrade() -> None:
    for name, table, referent, column, ondelete in _FKS:
        op.drop_constraint(name, table, type_="foreignkey")
        op.create_foreign_key(name, table, referent, [column], ["id"], ondelete=ondelete)


def downgrade() -> None:
    # Restore the original NO ACTION FKs (recreate without ondelete), same constraint names.
    for name, table, referent, column, _ondelete in _FKS:
        op.drop_constraint(name, table, type_="foreignkey")
        op.create_foreign_key(name, table, referent, [column], ["id"])
