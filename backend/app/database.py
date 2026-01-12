"""SQLite database connection and session management."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    pass


# SQLite connection with check_same_thread=False for FastAPI async
engine = create_engine(
    f"sqlite:///{settings.database_path}",
    connect_args={"check_same_thread": False},
    echo=settings.debug,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
