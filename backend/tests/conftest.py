"""Test fixtures — run against a REAL Postgres (never SQLite), per docs/adr/0001 & 0003.

A dedicated `clubhub_test` database is created on the same Postgres server. The schema is
created once per session; each test runs inside an outer transaction that is rolled back at
the end (commits inside endpoints become savepoints), giving full isolation between tests.
"""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlmodel import Session

from app.core.config import settings
from app.core.db import get_session
from app.main import app
from app.models import SQLModel

TEST_DB_NAME = "clubhub_test"


def _ensure_test_database() -> str:
    """Create the clubhub_test database if missing; return its URL."""
    base_url = make_url(settings.DATABASE_URL)
    test_url = base_url.set(database=TEST_DB_NAME)
    admin_url = base_url.set(database="postgres")

    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": TEST_DB_NAME},
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{TEST_DB_NAME}"'))
    admin_engine.dispose()
    return test_url.render_as_string(hide_password=False)


@pytest.fixture(scope="session")
def engine():
    test_url = _ensure_test_database()
    eng = create_engine(test_url, pool_pre_ping=True)
    # Known gap: create_all uses SQLModel metadata directly, not Alembic migrations.
    # Migration/model drift won't be caught here. TODO: replace with `alembic upgrade head`
    # against the test DB, or add a CI job that asserts autogenerate produces no diff.
    SQLModel.metadata.create_all(eng)
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
