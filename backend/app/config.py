"""FastAPI configuration using Pydantic Settings."""

import os
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    app_name: str = "AlphaNote API"
    debug: bool = False

    # Simple password protection (set via environment variable)
    auth_password: str = os.environ.get("AUTH_PASSWORD", "changeme")
    secret_key: str = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production")

    # Database URL - supports both PostgreSQL and SQLite
    # PostgreSQL: postgresql://user:password@host:port/dbname
    # SQLite: sqlite:///path/to/db.sqlite
    database_url: Optional[str] = os.environ.get("DATABASE_URL", None)

    # Legacy SQLite path (used as fallback if DATABASE_URL not set)
    database_path: Path = Path(
        os.environ.get("DATABASE_PATH", Path(__file__).parent.parent / "data" / "alphanote.db")
    )

    # Progress file
    progress_path: Path = Path(
        os.environ.get("PROGRESS_PATH", Path(__file__).parent.parent / "data" / "progress.json")
    )

    # Log file
    log_path: Path = Path(
        os.environ.get("LOG_PATH", Path(__file__).parent.parent / "data" / "update.log")
    )

    def get_database_url(self) -> str:
        """Get the database URL, falling back to SQLite if not configured."""
        if self.database_url:
            return self.database_url
        return f"sqlite:///{self.database_path}"

    class Config:
        env_file = ".env"


settings = Settings()
