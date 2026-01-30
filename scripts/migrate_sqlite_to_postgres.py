#!/usr/bin/env python3
"""
Migrate data from SQLite to PostgreSQL for AlphaNote.

This script:
1. Reads all data from SQLite database
2. Inserts data into PostgreSQL in correct order (respecting foreign keys)
3. Resets SERIAL sequences after migration
4. Reports progress throughout

Usage:
    # Set DATABASE_URL environment variable for PostgreSQL connection
    export DATABASE_URL=postgresql://alphanote:password@localhost:5432/alphanote
    python scripts/migrate_sqlite_to_postgres.py

    # Or run via docker-compose
    docker-compose run --rm backend python /scripts/migrate_sqlite_to_postgres.py
"""

import os
import sqlite3
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Configuration
SQLITE_PATH = Path(os.environ.get("SQLITE_PATH", PROJECT_ROOT / "backend" / "data" / "alphanote.db"))
DATABASE_URL = os.environ.get("DATABASE_URL", None)

# Batch size for inserts
BATCH_SIZE = 1000

# Migration order (respects foreign key dependencies)
MIGRATION_ORDER = [
    "stock_basic",
    "stock_aliases",
    "daily_quotes",
    "transactions",
    "watchlist_groups",
    "watchlist_items",
    "saved_screeners",
    "zhihu_creators",
    "zhihu_content",
    "article_stock_ref",
    "crawler_config",
]

# Table schemas for INSERT statements
TABLE_COLUMNS = {
    "stock_basic": [
        "symbol", "name", "asset_type", "industry", "roe", "controller",
        "description", "listing_date", "is_blacklisted", "consecutive_loss_years",
        "created_at", "updated_at"
    ],
    "stock_aliases": ["id", "symbol", "alias", "created_at"],
    "daily_quotes": [
        "id", "symbol", "date", "open", "high", "low", "close",
        "volume", "turnover", "turnover_rate", "pe_ttm", "pb", "market_cap"
    ],
    "transactions": [
        "id", "symbol", "action", "price", "quantity", "date",
        "reason", "commission", "created_at"
    ],
    "watchlist_groups": ["id", "name", "sort_order", "created_at"],
    "watchlist_items": ["id", "group_id", "symbol", "sort_order", "added_at"],
    "saved_screeners": ["id", "name", "criteria_json", "created_at", "updated_at"],
    "zhihu_creators": [
        "user_id", "url_token", "user_nickname", "user_avatar", "user_link",
        "gender", "fans", "follows", "answer_count", "article_count",
        "voteup_count", "is_active", "last_crawled_at", "created_at"
    ],
    "zhihu_content": [
        "content_id", "content_type", "title", "content_text", "content_url",
        "created_time", "updated_time", "voteup_count", "comment_count",
        "author_id", "author_name", "author_avatar", "is_tagged", "created_at"
    ],
    "article_stock_ref": [
        "id", "article_id", "stock_symbol", "display_date", "original_date",
        "match_keyword", "match_score", "created_at"
    ],
    "crawler_config": ["id", "key", "value", "updated_at"],
}

# Tables with SERIAL/AUTOINCREMENT columns that need sequence reset
SERIAL_TABLES = [
    "stock_aliases",
    "daily_quotes",
    "transactions",
    "watchlist_groups",
    "watchlist_items",
    "saved_screeners",
    "article_stock_ref",
    "crawler_config",
]


def get_postgres_connection():
    """Get PostgreSQL connection."""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable not set")
    import psycopg2
    return psycopg2.connect(DATABASE_URL)


def get_sqlite_connection():
    """Get SQLite connection."""
    if not SQLITE_PATH.exists():
        raise FileNotFoundError(f"SQLite database not found: {SQLITE_PATH}")
    return sqlite3.connect(SQLITE_PATH)


def get_row_count(sqlite_conn, table: str) -> int:
    """Get row count from SQLite table."""
    cursor = sqlite_conn.cursor()
    cursor.execute(f"SELECT COUNT(*) FROM {table}")
    return cursor.fetchone()[0]


def clean_row(table: str, row: tuple, columns: list) -> tuple:
    """Clean row data for PostgreSQL compatibility."""
    if table == "stock_basic":
        # Convert ROE percentage string to float
        row = list(row)
        roe_idx = columns.index("roe")
        if row[roe_idx] is not None and isinstance(row[roe_idx], str):
            # Remove % and convert to float
            try:
                row[roe_idx] = float(row[roe_idx].replace("%", ""))
            except (ValueError, AttributeError):
                row[roe_idx] = None
        return tuple(row)
    return row


def migrate_table(sqlite_conn, pg_conn, table: str):
    """Migrate a single table from SQLite to PostgreSQL."""
    columns = TABLE_COLUMNS[table]
    sqlite_cursor = sqlite_conn.cursor()
    pg_cursor = pg_conn.cursor()

    # Get total rows
    total_rows = get_row_count(sqlite_conn, table)
    if total_rows == 0:
        print(f"  [SKIP] {table}: No data to migrate")
        return 0

    print(f"  [INFO] {table}: Migrating {total_rows} rows...")

    # Build SELECT query
    select_sql = f"SELECT {', '.join(columns)} FROM {table}"
    sqlite_cursor.execute(select_sql)

    # Build INSERT query with ON CONFLICT DO NOTHING
    placeholders = ", ".join(["%s"] * len(columns))
    insert_sql = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"

    # Migrate in batches
    migrated = 0
    batch = []

    for row in sqlite_cursor:
        # Clean row data for PostgreSQL compatibility
        cleaned_row = clean_row(table, row, columns)
        batch.append(cleaned_row)
        if len(batch) >= BATCH_SIZE:
            pg_cursor.executemany(insert_sql, batch)
            pg_conn.commit()
            migrated += len(batch)
            print(f"    Progress: {migrated}/{total_rows} ({100*migrated//total_rows}%)")
            batch = []

    # Insert remaining rows
    if batch:
        pg_cursor.executemany(insert_sql, batch)
        pg_conn.commit()
        migrated += len(batch)

    print(f"  [OK] {table}: Migrated {migrated} rows")
    return migrated


def reset_sequences(pg_conn):
    """Reset SERIAL sequences to max(id) + 1 for all tables."""
    print("\n[INFO] Resetting SERIAL sequences...")
    pg_cursor = pg_conn.cursor()

    for table in SERIAL_TABLES:
        try:
            # Get the sequence name (PostgreSQL convention: table_id_seq)
            seq_name = f"{table}_id_seq"

            # Get max id
            pg_cursor.execute(f"SELECT COALESCE(MAX(id), 0) FROM {table}")
            max_id = pg_cursor.fetchone()[0]

            if max_id > 0:
                # Reset sequence
                pg_cursor.execute(f"SELECT setval('{seq_name}', {max_id})")
                print(f"  [OK] {seq_name}: Reset to {max_id}")
            else:
                print(f"  [SKIP] {seq_name}: Table is empty")

        except Exception as e:
            print(f"  [WARN] {table}: Could not reset sequence - {e}")

    pg_conn.commit()


def verify_migration(sqlite_conn, pg_conn):
    """Verify row counts match between SQLite and PostgreSQL."""
    print("\n[INFO] Verifying migration...")
    sqlite_cursor = sqlite_conn.cursor()
    pg_cursor = pg_conn.cursor()

    all_match = True
    for table in MIGRATION_ORDER:
        sqlite_cursor.execute(f"SELECT COUNT(*) FROM {table}")
        sqlite_count = sqlite_cursor.fetchone()[0]

        pg_cursor.execute(f"SELECT COUNT(*) FROM {table}")
        pg_count = pg_cursor.fetchone()[0]

        if sqlite_count == pg_count:
            print(f"  [OK] {table}: {pg_count} rows")
        else:
            print(f"  [WARN] {table}: SQLite={sqlite_count}, PostgreSQL={pg_count}")
            all_match = False

    return all_match


def main():
    print("=" * 60)
    print("SQLite to PostgreSQL Migration for AlphaNote")
    print("=" * 60)
    print(f"\nSource: {SQLITE_PATH}")
    print(f"Target: {DATABASE_URL}")
    print()

    if not DATABASE_URL:
        print("[ERROR] DATABASE_URL environment variable not set")
        print("Example: export DATABASE_URL=postgresql://alphanote:password@localhost:5432/alphanote")
        sys.exit(1)

    if not SQLITE_PATH.exists():
        print(f"[ERROR] SQLite database not found: {SQLITE_PATH}")
        sys.exit(1)

    # Connect to databases
    print("[INFO] Connecting to databases...")
    sqlite_conn = get_sqlite_connection()
    pg_conn = get_postgres_connection()

    try:
        # Migrate each table
        print("\n[INFO] Starting migration...")
        total_migrated = 0

        for table in MIGRATION_ORDER:
            try:
                migrated = migrate_table(sqlite_conn, pg_conn, table)
                total_migrated += migrated
            except Exception as e:
                print(f"  [ERROR] {table}: {e}")
                pg_conn.rollback()

        # Reset sequences
        reset_sequences(pg_conn)

        # Verify migration
        all_match = verify_migration(sqlite_conn, pg_conn)

        print("\n" + "=" * 60)
        if all_match:
            print("[SUCCESS] Migration completed successfully!")
        else:
            print("[WARNING] Migration completed with some discrepancies")
        print(f"Total rows migrated: {total_migrated}")
        print("=" * 60)

    finally:
        sqlite_conn.close()
        pg_conn.close()


if __name__ == "__main__":
    main()
