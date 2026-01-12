#!/usr/bin/env python3
"""
Data update script (scraper) for AlphaNote using AkShare.

Usage:
    python scraper.py --mode daily                    # Update daily quotes (default 1 year)
    python scraper.py --mode daily --years 3          # Update daily quotes for 3 years
    python scraper.py --mode daily --start 20200101   # Update daily quotes from specific date
    python scraper.py --mode monthly                  # Update stock basic info
    python scraper.py --mode monthly --limit 100      # Update first 100 stocks only
    python scraper.py --mode monthly --type etf       # Update only ETF info
    python scraper.py --mode monthly --type lof       # Update only LOF info
    python scraper.py --mode monthly --type all       # Update stocks + ETF + LOF
"""

import argparse
import json
import logging
import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

import akshare as ak
import pandas as pd

# Paths - use environment variables or defaults
BASE_DIR = Path(__file__).parent
DATA_DIR = Path(os.environ.get("DATA_DIR", BASE_DIR / "data"))
DB_PATH = Path(os.environ.get("DATABASE_PATH", DATA_DIR / "alphanote.db"))
PROGRESS_PATH = Path(os.environ.get("PROGRESS_PATH", DATA_DIR / "progress.json"))
LOG_PATH = Path(os.environ.get("LOG_PATH", DATA_DIR / "update.log"))

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)


def write_progress(is_running: bool, mode: str = "", current: int = 0, total: int = 0, current_symbol: str = ""):
    """Write progress to JSON file for frontend polling."""
    progress = {
        "is_running": is_running,
        "mode": mode,
        "current": current,
        "total": total,
        "current_symbol": current_symbol,
        "started_at": datetime.now().isoformat() if is_running else None,
        "updated_at": datetime.now().isoformat(),
    }
    with open(PROGRESS_PATH, "w") as f:
        json.dump(progress, f, indent=2)


def is_trading_day() -> bool:
    """Check if today is a trading day using AkShare."""
    try:
        trade_dates = ak.tool_trade_date_hist_sina()
        today = datetime.now().strftime("%Y-%m-%d")
        return today in trade_dates["trade_date"].astype(str).values
    except Exception as e:
        logger.warning(f"Failed to check trading day: {e}. Assuming it's a trading day.")
        return True


def get_all_stocks() -> pd.DataFrame:
    """Get list of all A-share stocks."""
    try:
        stock_info = ak.stock_info_a_code_name()
        stock_info["asset_type"] = "stock"
        return stock_info
    except Exception as e:
        logger.error(f"Failed to get stock list: {e}")
        return pd.DataFrame()


def get_all_etfs() -> pd.DataFrame:
    """Get list of all ETFs."""
    try:
        etf_info = ak.fund_etf_spot_em()
        # Rename columns to match stock format
        etf_info = etf_info[["代码", "名称"]].rename(columns={"代码": "code", "名称": "name"})
        etf_info["asset_type"] = "etf"
        return etf_info
    except Exception as e:
        logger.error(f"Failed to get ETF list: {e}")
        return pd.DataFrame()


def get_all_lofs() -> pd.DataFrame:
    """Get list of all LOFs."""
    try:
        lof_info = ak.fund_lof_spot_em()
        # Rename columns to match stock format
        lof_info = lof_info[["代码", "名称"]].rename(columns={"代码": "code", "名称": "name"})
        lof_info["asset_type"] = "lof"
        return lof_info
    except Exception as e:
        logger.error(f"Failed to get LOF list: {e}")
        return pd.DataFrame()


def get_asset_type(symbol: str) -> str:
    """Determine asset type based on symbol pattern."""
    # ETF patterns
    if symbol.startswith(("51", "56", "58", "15", "16", "18")):
        return "etf"
    # LOF patterns
    if symbol.startswith(("50", "160", "161", "162", "163", "164", "165")):
        return "lof"
    return "stock"


def update_stock_basic(conn: sqlite3.Connection, assets: pd.DataFrame):
    """Update stock_basic table with basic info."""
    cursor = conn.cursor()
    total = len(assets)

    for i, row in assets.iterrows():
        symbol = row["code"]
        name = row["name"]
        asset_type = row.get("asset_type", "stock")

        write_progress(True, "monthly", i + 1, total, symbol)

        try:
            if asset_type == "stock":
                # Get detailed info for stocks
                try:
                    info = ak.stock_individual_info_em(symbol=symbol)
                    info_dict = dict(zip(info["item"], info["value"]))
                    industry = info_dict.get("行业", "")
                    controller = info_dict.get("实际控制人", "")
                    listing_date = info_dict.get("上市时间", "")
                except Exception:
                    industry, controller, listing_date = "", "", ""

                # Try to get ROE
                roe = None
                try:
                    financial = ak.stock_financial_abstract_ths(symbol=symbol, indicator="按报告期")
                    if not financial.empty and "净资产收益率" in financial.columns:
                        roe = financial["净资产收益率"].iloc[0]
                except Exception:
                    pass

                cursor.execute(
                    """
                    INSERT INTO stock_basic (symbol, name, asset_type, industry, roe, controller, listing_date, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(symbol) DO UPDATE SET
                        name = excluded.name,
                        asset_type = excluded.asset_type,
                        industry = excluded.industry,
                        roe = COALESCE(excluded.roe, roe),
                        controller = excluded.controller,
                        listing_date = excluded.listing_date,
                        updated_at = CURRENT_TIMESTAMP
                """,
                    (symbol, name, asset_type, industry, roe, controller, listing_date),
                )
            else:
                # For ETF/LOF, just store basic info
                cursor.execute(
                    """
                    INSERT INTO stock_basic (symbol, name, asset_type, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(symbol) DO UPDATE SET
                        name = excluded.name,
                        asset_type = excluded.asset_type,
                        updated_at = CURRENT_TIMESTAMP
                """,
                    (symbol, name, asset_type),
                )

            if (i + 1) % 50 == 0:
                conn.commit()
                logger.info(f"Progress: {i + 1}/{total} assets updated")

        except Exception as e:
            logger.warning(f"Failed to update {symbol}: {e}")
            # Still insert basic info
            cursor.execute(
                """
                INSERT OR IGNORE INTO stock_basic (symbol, name, asset_type)
                VALUES (?, ?, ?)
            """,
                (symbol, name, asset_type),
            )

    conn.commit()


def update_daily_quotes(conn: sqlite3.Connection, symbols: list[str] | None = None, start_date: str = None, fetch_all: bool = False, limit: int = None):
    """Update daily_quotes table with latest price data."""
    cursor = conn.cursor()

    # Default to 1 year ago if no start_date provided
    if start_date is None:
        start_date = (datetime.now() - timedelta(days=365)).strftime("%Y%m%d")

    # If no symbols provided, get from watchlist or all stocks
    if symbols is None:
        if fetch_all:
            # Fetch all assets from stock_basic
            if limit:
                cursor.execute("SELECT symbol, asset_type FROM stock_basic LIMIT ?", (limit,))
            else:
                cursor.execute("SELECT symbol, asset_type FROM stock_basic")
            symbol_types = {row[0]: row[1] for row in cursor.fetchall()}
        else:
            # Try watchlist first
            cursor.execute("""
                SELECT wi.symbol, COALESCE(sb.asset_type, 'stock') as asset_type
                FROM watchlist_items wi
                LEFT JOIN stock_basic sb ON wi.symbol = sb.symbol
            """)
            watchlist_data = cursor.fetchall()

            if watchlist_data:
                symbol_types = {row[0]: row[1] for row in watchlist_data}
            else:
                # Fallback to stocks in stock_basic with limit
                fallback_limit = limit if limit else 100
                cursor.execute("SELECT symbol, asset_type FROM stock_basic LIMIT ?", (fallback_limit,))
                symbol_types = {row[0]: row[1] for row in cursor.fetchall()}
    else:
        # Get asset types for provided symbols
        placeholders = ",".join("?" * len(symbols))
        cursor.execute(f"SELECT symbol, COALESCE(asset_type, 'stock') FROM stock_basic WHERE symbol IN ({placeholders})", symbols)
        symbol_types = {row[0]: row[1] for row in cursor.fetchall()}
        # For symbols not in DB, guess type
        for s in symbols:
            if s not in symbol_types:
                symbol_types[s] = get_asset_type(s)

    total = len(symbol_types)
    logger.info(f"Updating quotes for {total} assets from {start_date}")

    for i, (symbol, asset_type) in enumerate(symbol_types.items()):
        write_progress(True, "daily", i + 1, total, symbol)

        try:
            # Use different API based on asset type
            if asset_type == "etf":
                df = ak.fund_etf_hist_em(symbol=symbol, period="daily", start_date=start_date, adjust="qfq")
            elif asset_type == "lof":
                # LOF uses same API as ETF
                df = ak.fund_etf_hist_em(symbol=symbol, period="daily", start_date=start_date, adjust="qfq")
            else:
                df = ak.stock_zh_a_hist(symbol=symbol, period="daily", start_date=start_date, adjust="qfq")

            if df.empty:
                continue

            # Rename columns to English
            df = df.rename(
                columns={
                    "日期": "date",
                    "开盘": "open",
                    "收盘": "close",
                    "最高": "high",
                    "最低": "low",
                    "成交量": "volume",
                    "成交额": "turnover",
                    "换手率": "turnover_rate",
                }
            )

            # Insert data
            for _, row in df.iterrows():
                cursor.execute(
                    """
                    INSERT INTO daily_quotes (symbol, date, open, high, low, close, volume, turnover, turnover_rate)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(symbol, date) DO UPDATE SET
                        open = excluded.open,
                        high = excluded.high,
                        low = excluded.low,
                        close = excluded.close,
                        volume = excluded.volume,
                        turnover = excluded.turnover,
                        turnover_rate = excluded.turnover_rate
                """,
                    (
                        symbol,
                        row["date"],
                        row["open"],
                        row["high"],
                        row["low"],
                        row["close"],
                        row.get("volume"),
                        row.get("turnover"),
                        row.get("turnover_rate"),
                    ),
                )

            if (i + 1) % 10 == 0:
                conn.commit()
                logger.info(f"Progress: {i + 1}/{total} assets updated")

        except Exception as e:
            logger.warning(f"Failed to update quotes for {symbol} ({asset_type}): {e}")

    conn.commit()


def run_daily_update(start_date: str = None, skip_trading_check: bool = False, fetch_all: bool = False, limit: int = None):
    """Run daily update mode."""
    logger.info("Starting daily update...")

    if not skip_trading_check and not is_trading_day():
        logger.info("Not a trading day. Exiting. Use --force to override.")
        write_progress(False)
        return

    write_progress(True, "daily", 0, 0)

    conn = sqlite3.connect(DB_PATH)
    try:
        update_daily_quotes(conn, start_date=start_date, fetch_all=fetch_all, limit=limit)
        logger.info("Daily update completed successfully")
    except Exception as e:
        logger.error(f"Daily update failed: {e}")
    finally:
        conn.close()
        write_progress(False)


def run_monthly_update(limit: int = None, asset_types: list[str] = None):
    """Run monthly update mode."""
    if asset_types is None:
        asset_types = ["stock"]

    logger.info(f"Starting monthly update for: {asset_types}")
    write_progress(True, "monthly", 0, 0)

    conn = sqlite3.connect(DB_PATH)
    try:
        all_assets = pd.DataFrame()

        if "stock" in asset_types:
            stocks = get_all_stocks()
            if not stocks.empty:
                if limit:
                    stocks = stocks.head(limit)
                all_assets = pd.concat([all_assets, stocks], ignore_index=True)
                logger.info(f"Found {len(stocks)} stocks")

        if "etf" in asset_types:
            etfs = get_all_etfs()
            if not etfs.empty:
                if limit:
                    etfs = etfs.head(limit)
                all_assets = pd.concat([all_assets, etfs], ignore_index=True)
                logger.info(f"Found {len(etfs)} ETFs")

        if "lof" in asset_types:
            lofs = get_all_lofs()
            if not lofs.empty:
                if limit:
                    lofs = lofs.head(limit)
                all_assets = pd.concat([all_assets, lofs], ignore_index=True)
                logger.info(f"Found {len(lofs)} LOFs")

        if not all_assets.empty:
            update_stock_basic(conn, all_assets)
            logger.info("Monthly update completed successfully")
        else:
            logger.warning("No assets found to update")
    except Exception as e:
        logger.error(f"Monthly update failed: {e}")
    finally:
        conn.close()
        write_progress(False)


def main():
    parser = argparse.ArgumentParser(
        description="AlphaNote Data Scraper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scraper.py --mode daily                    # Update watchlist stocks (default 1 year)
  python scraper.py --mode daily --years 3          # Update watchlist for 3 years
  python scraper.py --mode daily --all              # Update ALL assets (1 year)
  python scraper.py --mode daily --all --years 5    # Update ALL assets for 5 years
  python scraper.py --mode daily --all --limit 500  # Update first 500 assets
  python scraper.py --mode daily --years 5 --force  # Update 5 years, ignore trading day check
  python scraper.py --mode daily --start 20200101   # Update from specific date
  python scraper.py --mode monthly                  # Update all stock basic info
  python scraper.py --mode monthly --type etf       # Update ETF basic info only
  python scraper.py --mode monthly --type lof       # Update LOF basic info only
  python scraper.py --mode monthly --type all       # Update stocks + ETF + LOF
  python scraper.py --mode monthly --limit 100      # Update first 100 items only
        """,
    )
    parser.add_argument(
        "--mode",
        type=str,
        choices=["daily", "monthly"],
        required=True,
        help="Update mode: daily (quotes) or monthly (basic info)",
    )
    parser.add_argument(
        "--type",
        type=str,
        choices=["stock", "etf", "lof", "all"],
        default="stock",
        help="Asset type to update in monthly mode (default: stock). Use 'all' for stocks + ETF + LOF.",
    )
    parser.add_argument(
        "--years",
        type=int,
        default=1,
        help="Number of years of historical data to fetch (default: 1). Only used with --mode daily.",
    )
    parser.add_argument(
        "--start",
        type=str,
        default=None,
        help="Start date in YYYYMMDD format (e.g., 20200101). Overrides --years. Only used with --mode daily.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        dest="fetch_all",
        help="Update all assets in stock_basic table, not just watchlist. Only used with --mode daily.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of assets to update.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force update even on non-trading days. Only used with --mode daily.",
    )
    args = parser.parse_args()

    if not DB_PATH.exists():
        logger.error(f"Database not found at {DB_PATH}. Run init_db.py first.")
        return

    if args.mode == "daily":
        # Determine start_date: --start takes priority, otherwise calculate from --years
        if args.start:
            start_date = args.start
        else:
            start_date = (datetime.now() - timedelta(days=365 * args.years)).strftime("%Y%m%d")
        run_daily_update(start_date=start_date, skip_trading_check=args.force, fetch_all=args.fetch_all, limit=args.limit)
    elif args.mode == "monthly":
        if args.type == "all":
            asset_types = ["stock", "etf", "lof"]
        else:
            asset_types = [args.type]
        run_monthly_update(limit=args.limit, asset_types=asset_types)


if __name__ == "__main__":
    main()
