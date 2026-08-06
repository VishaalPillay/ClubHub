"""Database engine + session dependency (replaces the MySQL connection pool)."""

from collections.abc import Generator

from sqlmodel import Session, create_engine

from app.core.config import settings

# pool_pre_ping avoids handing out dead connections after the DB restarts; pool_recycle
# retires them before an idle timeout can strand one, so the pre-ping rarely has to pay a
# wasted round-trip. The pool is capped at 10 (5 + 5) rather than SQLAlchemy's default 15 to
# leave connection headroom on a single small box for psql and the nightly pg_dump.
engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_size=5,
    max_overflow=5,
)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a transactional session."""
    with Session(engine) as session:
        yield session
