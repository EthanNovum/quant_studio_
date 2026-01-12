#!/usr/bin/env python3
"""Initialize SQLite database with schema for AlphaNote."""

import os
import sqlite3
from pathlib import Path

# Paths - use environment variables or defaults
BASE_DIR = Path(__file__).parent
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR / "data"))
DB_PATH = Path(os.environ.get("DATABASE_PATH", DATA_DIR / "alphanote.db"))


def init_database():
    """Create all tables for AlphaNote."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # stock_basic - Static stock/fund information
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stock_basic (
            symbol TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            asset_type TEXT DEFAULT 'stock' CHECK(asset_type IN ('stock', 'etf', 'lof')),
            industry TEXT,
            roe REAL,
            controller TEXT,
            description TEXT,
            listing_date DATE,
            is_blacklisted INTEGER DEFAULT 0,
            consecutive_loss_years INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # daily_quotes - Historical price data
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_quotes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            date DATE NOT NULL,
            open REAL NOT NULL,
            high REAL NOT NULL,
            low REAL NOT NULL,
            close REAL NOT NULL,
            volume REAL,
            turnover REAL,
            turnover_rate REAL,
            pe_ttm REAL,
            pb REAL,
            market_cap REAL,
            UNIQUE(symbol, date),
            FOREIGN KEY (symbol) REFERENCES stock_basic(symbol)
        )
    """)

    # Create indexes for daily_quotes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_quotes_symbol ON daily_quotes(symbol)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_quotes_date ON daily_quotes(date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_quotes_symbol_date ON daily_quotes(symbol, date)")

    # transactions - User trade records
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            action TEXT NOT NULL CHECK(action IN ('BUY', 'SELL', 'DIVIDEND')),
            price REAL NOT NULL,
            quantity REAL NOT NULL,
            date DATE NOT NULL,
            reason TEXT,
            commission REAL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (symbol) REFERENCES stock_basic(symbol)
        )
    """)

    # Create indexes for transactions
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_symbol ON transactions(symbol)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)")

    # watchlist_groups - Folder organization
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS watchlist_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # watchlist_items - Stocks in watchlist
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS watchlist_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            symbol TEXT NOT NULL,
            sort_order INTEGER DEFAULT 0,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(group_id, symbol),
            FOREIGN KEY (group_id) REFERENCES watchlist_groups(id) ON DELETE CASCADE,
            FOREIGN KEY (symbol) REFERENCES stock_basic(symbol)
        )
    """)

    # Create index for watchlist_items
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_watchlist_group ON watchlist_items(group_id)")

    # saved_screeners - Saved filter strategies
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS saved_screeners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            criteria_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()

    print(f"Database initialized at: {DB_PATH}")


if __name__ == "__main__":
    init_database()
