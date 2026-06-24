"""Test fixtures — run against a REAL Postgres (never SQLite), per docs/adr/0001 & 0003.

A dedicated `clubhub_test` database is created on the same Postgres server. Its schema is
built by running the **Alembic migrations** (`alembic upgrade head`), not
`SQLModel.metadata.create_all`, so the migrations are the tested path and any model/migration
drift fails here. Each test runs inside an outer transaction that is rolled back at the end
(commits inside endpoints become savepoints), giving full isolation between tests.
"""

from collections.abc import Generator
from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlmodel import Session

from alembic import command
from app.core.config import settings
from app.core.db import get_session
from app.main import app

TEST_DB_NAME = "clubhub_test"
BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _ensure_test_database() -> str:
    """Drop and recreate the clubhub_test database; return its URL.

    Recreating from scratch guarantees the schema is built fresh by the migrations (no
    leftover tables from a previous create_all-based run).
    """
    base_url = make_url(settings.DATABASE_URL)
    test_url = base_url.set(database=TEST_DB_NAME)
    admin_url = base_url.set(database="postgres")

    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        # WITH (FORCE) terminates any lingering connections (PostgreSQL 13+).
        conn.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{TEST_DB_NAME}"'))
    admin_engine.dispose()
    return test_url.render_as_string(hide_password=False)


def _run_migrations(test_url: str) -> None:
    """Apply `alembic upgrade head` against the test database.

    env.py honours an explicit sqlalchemy.url override (see its db_url resolution), so this
    targets clubhub_test without mutating app settings.
    """
    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", test_url)
    command.upgrade(cfg, "head")


@pytest.fixture(scope="session")
def engine():
    test_url = _ensure_test_database()
    _run_migrations(test_url)
    eng = create_engine(test_url, pool_pre_ping=True)
    yield eng
    eng.dispose()


@pytest.fixture()
def session(engine) -> Generator[Session, None, None]:
    connection = engine.connect()
    transaction = connection.begin()
    # create_savepoint: endpoint commits become savepoints inside the outer transaction.
    db_session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield db_session
    finally:
        db_session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(session) -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
