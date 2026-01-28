#!/usr/bin/env python3
"""
Article tagging script for DangInvest.
Matches Zhihu articles with stock keywords and creates article_stock_ref entries.

Usage:
    python scripts/tag_articles.py [--all]

This script:
1. Reads untagged articles from zhihu_content
2. Builds keyword dictionary from stock_basic and stock_aliases
3. Matches keywords in article title and content
4. Aligns dates to trading days
5. Creates article_stock_ref entries
"""

import argparse
import re
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Database path
DB_PATH = PROJECT_ROOT / "backend" / "data" / "alphanote.db"

# Matching weights
TITLE_WEIGHT = 10
CONTENT_WEIGHT = 1
MIN_SCORE_THRESHOLD = 2  # Minimum score to create a reference


def get_db_connection():
    """Get SQLite database connection."""
    return sqlite3.connect(DB_PATH)


def load_stock_keywords() -> Dict[str, List[str]]:
    """
    Load stock keywords from database.
    Returns: Dict mapping keyword -> list of symbols
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    keywords: Dict[str, List[str]] = {}

    try:
        # Load from stock_basic (symbol and name)
        cursor.execute("SELECT symbol, name FROM stock_basic")
        for symbol, name in cursor.fetchall():
            # Add symbol itself (e.g., "600519")
            if symbol not in keywords:
                keywords[symbol] = []
            keywords[symbol].append(symbol)

            # Add stock name (e.g., "贵州茅台")
            if name:
                if name not in keywords:
                    keywords[name] = []
                keywords[name].append(symbol)

        # Load from stock_aliases
        cursor.execute("SELECT symbol, alias FROM stock_aliases")
        for symbol, alias in cursor.fetchall():
            if alias:
                if alias not in keywords:
                    keywords[alias] = []
                keywords[alias].append(symbol)

        print(f"[INFO] Loaded {len(keywords)} keywords for {len(set(s for syms in keywords.values() for s in syms))} stocks")
        return keywords

    except Exception as e:
        print(f"[ERROR] Load keywords failed: {e}")
        return {}
    finally:
        conn.close()


def load_trading_days() -> Set[str]:
    """
    Load trading days from daily_quotes table.
    Returns: Set of trading day strings (YYYY-MM-DD)
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT DISTINCT date FROM daily_quotes ORDER BY date")
        days = {row[0] for row in cursor.fetchall()}
        print(f"[INFO] Loaded {len(days)} trading days")
        return days
    except Exception as e:
        print(f"[ERROR] Load trading days failed: {e}")
        return set()
    finally:
        conn.close()


def align_to_trading_day(date_str: str, trading_days: Set[str]) -> str:
    """
    Align a date to the nearest previous trading day.
    If the date is a trading day, return it as-is.
    If not (weekend/holiday), return the previous trading day.
    """
    if not trading_days:
        return date_str

    if date_str in trading_days:
        return date_str

    # Find the previous trading day
    try:
        date = datetime.strptime(date_str, "%Y-%m-%d")
        for i in range(1, 10):  # Look back up to 10 days
            prev_date = (date - timedelta(days=i)).strftime("%Y-%m-%d")
            if prev_date in trading_days:
                return prev_date
    except Exception:
        pass

    return date_str


def timestamp_to_date(timestamp: int) -> str:
    """Convert Unix timestamp to date string."""
    if not timestamp:
        return datetime.now().strftime("%Y-%m-%d")
    try:
        return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d")
    except Exception:
        return datetime.now().strftime("%Y-%m-%d")


def match_keywords(text: str, keywords: Dict[str, List[str]]) -> Dict[str, Tuple[int, str]]:
    """
    Match keywords in text.
    Returns: Dict mapping symbol -> (count, matched_keyword)
    """
    if not text:
        return {}

    matches: Dict[str, Tuple[int, str]] = {}

    for keyword, symbols in keywords.items():
        # Skip very short keywords (likely to cause false positives)
        if len(keyword) < 2:
            continue

        # Count occurrences
        count = len(re.findall(re.escape(keyword), text))
        if count > 0:
            for symbol in symbols:
                if symbol in matches:
                    # Keep the higher count
                    if count > matches[symbol][0]:
                        matches[symbol] = (count, keyword)
                else:
                    matches[symbol] = (count, keyword)

    return matches


def get_untagged_articles(tag_all: bool = False) -> List[Dict]:
    """Get articles that haven't been tagged yet."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if tag_all:
            cursor.execute("""
                SELECT content_id, title, content_text, created_time
                FROM zhihu_content
            """)
        else:
            cursor.execute("""
                SELECT content_id, title, content_text, created_time
                FROM zhihu_content
                WHERE is_tagged = 0
            """)

        articles = []
        for row in cursor.fetchall():
            articles.append({
                "content_id": row[0],
                "title": row[1] or "",
                "content_text": row[2] or "",
                "created_time": row[3] or 0,
            })

        print(f"[INFO] Found {len(articles)} articles to tag")
        return articles

    except Exception as e:
        print(f"[ERROR] Get articles failed: {e}")
        return []
    finally:
        conn.close()


def save_article_stock_ref(
    article_id: str,
    stock_symbol: str,
    display_date: str,
    original_date: str,
    match_keyword: str,
    match_score: int,
):
    """Save article-stock reference to database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check if reference already exists
        cursor.execute("""
            SELECT id FROM article_stock_ref
            WHERE article_id = ? AND stock_symbol = ?
        """, (article_id, stock_symbol))

        if cursor.fetchone():
            # Update existing
            cursor.execute("""
                UPDATE article_stock_ref
                SET display_date = ?, original_date = ?, match_keyword = ?, match_score = ?
                WHERE article_id = ? AND stock_symbol = ?
            """, (display_date, original_date, match_keyword, match_score, article_id, stock_symbol))
        else:
            # Insert new
            cursor.execute("""
                INSERT INTO article_stock_ref
                (article_id, stock_symbol, display_date, original_date, match_keyword, match_score, created_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (article_id, stock_symbol, display_date, original_date, match_keyword, match_score))

        conn.commit()
    except Exception as e:
        print(f"[ERROR] Save ref failed: {e}")
    finally:
        conn.close()


def mark_article_tagged(article_id: str):
    """Mark article as tagged."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE zhihu_content SET is_tagged = 1 WHERE content_id = ?
        """, (article_id,))
        conn.commit()
    except Exception as e:
        print(f"[ERROR] Mark tagged failed: {e}")
    finally:
        conn.close()


def clear_existing_refs():
    """Clear all existing article_stock_ref entries (for re-tagging)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM article_stock_ref")
        cursor.execute("UPDATE zhihu_content SET is_tagged = 0")
        conn.commit()
        print("[INFO] Cleared existing references")
    except Exception as e:
        print(f"[ERROR] Clear refs failed: {e}")
    finally:
        conn.close()


def tag_articles(tag_all: bool = False):
    """Main tagging function."""
    print(f"\n[INFO] Starting article tagging...")
    print(f"[INFO] Database: {DB_PATH}")

    # Load keywords
    keywords = load_stock_keywords()
    if not keywords:
        print("[ERROR] No keywords loaded. Make sure stock_basic table has data.")
        return

    # Load trading days
    trading_days = load_trading_days()

    # Clear existing refs if re-tagging all
    if tag_all:
        clear_existing_refs()

    # Get articles to tag
    articles = get_untagged_articles(tag_all)
    if not articles:
        print("[INFO] No articles to tag")
        return

    total_refs = 0
    tagged_articles = 0

    for article in articles:
        article_id = article["content_id"]
        title = article["title"]
        content = article["content_text"]
        created_time = article["created_time"]

        # Get original date
        original_date = timestamp_to_date(created_time)

        # Align to trading day
        display_date = align_to_trading_day(original_date, trading_days)

        # Match keywords in title (higher weight)
        title_matches = match_keywords(title, keywords)

        # Match keywords in content
        content_matches = match_keywords(content, keywords)

        # Combine matches with weights
        combined_scores: Dict[str, Tuple[int, str]] = {}

        for symbol, (count, keyword) in title_matches.items():
            score = count * TITLE_WEIGHT
            combined_scores[symbol] = (score, keyword)

        for symbol, (count, keyword) in content_matches.items():
            score = count * CONTENT_WEIGHT
            if symbol in combined_scores:
                existing_score, existing_keyword = combined_scores[symbol]
                combined_scores[symbol] = (existing_score + score, existing_keyword)
            else:
                combined_scores[symbol] = (score, keyword)

        # Save references for matches above threshold
        article_has_refs = False
        for symbol, (score, keyword) in combined_scores.items():
            if score >= MIN_SCORE_THRESHOLD:
                save_article_stock_ref(
                    article_id=article_id,
                    stock_symbol=symbol,
                    display_date=display_date,
                    original_date=original_date,
                    match_keyword=keyword,
                    match_score=score,
                )
                total_refs += 1
                article_has_refs = True

        # Mark article as tagged
        mark_article_tagged(article_id)
        tagged_articles += 1

        if article_has_refs:
            print(f"  [+] {title[:40]}... -> {len([s for s, (sc, _) in combined_scores.items() if sc >= MIN_SCORE_THRESHOLD])} stocks")

    print(f"\n[INFO] Tagging complete!")
    print(f"[INFO] Tagged {tagged_articles} articles")
    print(f"[INFO] Created {total_refs} article-stock references")


def main():
    parser = argparse.ArgumentParser(description="Tag Zhihu articles with stock keywords")
    parser.add_argument("--all", action="store_true", help="Re-tag all articles (clear existing refs)")
    args = parser.parse_args()

    tag_articles(tag_all=args.all)


if __name__ == "__main__":
    main()
