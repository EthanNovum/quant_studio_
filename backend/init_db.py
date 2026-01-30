#!/usr/bin/env python3
"""Initialize database schema for AlphaNote using SQLAlchemy ORM.

This script is database-agnostic and works with both PostgreSQL and SQLite.
"""

import os
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from app.config import settings
from app.database import Base, engine
from app.models import (
    StockBasic,
    StockAlias,
    DailyQuote,
    Transaction,
    WatchlistGroup,
    WatchlistItem,
    SavedScreener,
    ZhihuContent,
    ZhihuCreator,
    ArticleStockRef,
    CrawlerConfig,
)


def init_database():
    """Create all tables using SQLAlchemy ORM."""
    # For SQLite, ensure data directory exists
    if settings.get_database_url().startswith("sqlite"):
        data_dir = Path(settings.database_path).parent
        data_dir.mkdir(parents=True, exist_ok=True)

    # Create all tables
    Base.metadata.create_all(bind=engine)

    print(f"Database initialized: {settings.get_database_url()}")


if __name__ == "__main__":
    init_database()
