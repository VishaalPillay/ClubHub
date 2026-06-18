"""Database engine + session dependency (replaces the MySQL connection pool)."""

from collections.abc import Generator

from sqlmodel import Session, create_engine

from app.core.config import settings

# pool_pre_ping avoids handing out dead connections after the DB restarts.
engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a transactional session."""
    with Session(engine) as session:
        yield session
