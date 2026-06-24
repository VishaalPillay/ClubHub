"""Alembic environment.

Wires Alembic to the app's settings and to the full SQLModel metadata. Importing
`app.models` registers every table so autogenerate sees the complete schema (otherwise it
would produce an empty/no-op baseline).
"""

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

# Importing the package populates SQLModel.metadata with all tables.
import app.models  # noqa: F401
from alembic import context
from app.core.config import settings
from app.models import SQLModel

config = context.config
# Prefer an explicit override (set by tests/tooling via Config.set_main_option, e.g. the
# clubhub_test database) and fall back to app settings. The shipped alembic.ini leaves
# sqlalchemy.url empty, so the normal `alembic` CLI path is unchanged.
db_url = config.get_main_option("sqlalchemy.url") or settings.DATABASE_URL
config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=db_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
