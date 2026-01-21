"""FastAPI configuration using Pydantic Settings."""

import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    app_name: str = "AlphaNote API"
    debug: bool = False

    # Simple password protection (set via environment variable)
    auth_password: str = os.environ.get("AUTH_PASSWORD", "changeme")
    secret_key: str = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production")

    # Database - can be overridden by environment variable
    # Default: backend/data/alphanote.db (relative to backend directory)
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

    class Config:
        env_file = ".env"


settings = Settings()
