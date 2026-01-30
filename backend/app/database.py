"""Database connection and session management for PostgreSQL/SQLite."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import QueuePool

from app.config import settings


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    pass


def create_db_engine():
    """Create database engine with appropriate configuration."""
    database_url = settings.get_database_url()

    if database_url.startswith("sqlite"):
        # SQLite configuration
        return create_engine(
            database_url,
            connect_args={"check_same_thread": False},
            echo=settings.debug,
        )
    else:
        # PostgreSQL configuration with connection pooling
        return create_engine(
            database_url,
            poolclass=QueuePool,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            echo=settings.debug,
        )


engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
