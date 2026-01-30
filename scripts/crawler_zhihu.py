#!/usr/bin/env python3
"""
Simplified Zhihu crawler for DangInvest.
Crawls content from monitored Zhihu creators and saves to database.

Usage:
    python scripts/crawler_zhihu.py [--creators URL1,URL2] [--headless]

Based on MediaCrawler project (https://github.com/NanmiCoder/MediaCrawler)
Licensed under NON-COMMERCIAL LEARNING LICENSE 1.1
"""

import argparse
import asyncio
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import parse_qs, urlencode, urlparse

import httpx
from parsel import Selector

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Database configuration
DATABASE_URL = os.environ.get("DATABASE_URL", None)
DB_PATH = Path(os.environ.get("DATABASE_PATH", PROJECT_ROOT / "backend" / "data" / "alphanote.db"))

# Constants
ZHIHU_URL = "https://www.zhihu.com"
ZHIHU_ZHUANLAN_URL = "https://zhuanlan.zhihu.com"
CRAWL_INTERVAL = 3  # seconds between requests


def get_db_connection():
    """Get database connection (PostgreSQL or SQLite)."""
    if DATABASE_URL and DATABASE_URL.startswith("postgresql"):
        import psycopg2
        return psycopg2.connect(DATABASE_URL)
    else:
        import sqlite3
        return sqlite3.connect(DB_PATH)


def is_postgres():
    """Check if using PostgreSQL."""
    return DATABASE_URL and DATABASE_URL.startswith("postgresql")


def extract_text_from_html(html_content: str) -> str:
    """Extract plain text from HTML content."""
    if not html_content:
        return ""
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', html_content)
    # Decode HTML entities
    text = text.replace('&nbsp;', ' ')
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')
    text = text.replace('&amp;', '&')
    text = text.replace('&quot;', '"')
    return text.strip()


class ZhihuCrawler:
    """Simplified Zhihu crawler."""

    def __init__(self, cookies: str = "", headless: bool = True):
        self.cookies = cookies
        self.headless = headless
        self.start_timestamp = None  # Filter: only save content after this time
        self.end_timestamp = None    # Filter: only save content before this time
        self.headers = {
            "accept": "*/*",
            "accept-language": "zh-CN,zh;q=0.9",
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "x-api-version": "3.0.91",
            "x-app-za": "OS=Web",
            "x-requested-with": "fetch",
        }
        if cookies:
            self.headers["cookie"] = cookies

    async def request(self, url: str, params: Optional[Dict] = None) -> Dict:
        """Make HTTP request to Zhihu API."""
        try:
            async with httpx.AsyncClient() as client:
                if params:
                    url = f"{url}?{urlencode(params)}"
                response = await client.get(url, headers=self.headers, timeout=30)
                if response.status_code == 200:
                    return response.json()
                else:
                    print(f"[ERROR] Request failed: {response.status_code} - {url}")
                    return {}
        except Exception as e:
            print(f"[ERROR] Request error: {e}")
            return {}

    async def request_html(self, url: str) -> str:
        """Make HTTP request and return HTML."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=self.headers, timeout=30)
                if response.status_code == 200:
                    return response.text
                else:
                    print(f"[ERROR] Request failed: {response.status_code}")
                    return ""
        except Exception as e:
            print(f"[ERROR] Request error: {e}")
            return ""

    def extract_creator_from_html(self, url_token: str, html: str) -> Optional[Dict]:
        """Extract creator info from HTML page."""
        if not html:
            return None

        try:
            js_init_data = Selector(text=html).xpath(
                "//script[@id='js-initialData']/text()"
            ).get(default="")
            if not js_init_data:
                return None

            data = json.loads(js_init_data)
            users = data.get("initialState", {}).get("entities", {}).get("users", {})
            creator = users.get(url_token)
            if not creator:
                return None

            return {
                "user_id": creator.get("id", ""),
                "url_token": creator.get("urlToken", url_token),
                "user_nickname": creator.get("name", ""),
                "user_avatar": creator.get("avatarUrl", ""),
                "user_link": f"{ZHIHU_URL}/people/{url_token}",
                "gender": "男" if creator.get("gender") == 1 else ("女" if creator.get("gender") == 0 else "未知"),
                "fans": creator.get("followerCount", 0),
                "follows": creator.get("followingCount", 0),
                "answer_count": creator.get("answerCount", 0),
                "article_count": creator.get("articlesCount", 0),
                "voteup_count": creator.get("voteupCount", 0),
            }
        except Exception as e:
            print(f"[ERROR] Extract creator failed: {e}")
            return None

    def extract_content(self, item: Dict, content_type: str) -> Optional[Dict]:
        """Extract content from API response item."""
        try:
            if content_type == "answer":
                question = item.get("question", {})
                content_id = str(item.get("id", ""))
                question_id = str(question.get("id", ""))
                return {
                    "content_id": content_id,
                    "content_type": "answer",
                    "title": extract_text_from_html(question.get("title", "") or item.get("title", "")),
                    "content_text": extract_text_from_html(item.get("content", "")),
                    "content_url": f"{ZHIHU_URL}/question/{question_id}/answer/{content_id}",
                    "created_time": item.get("created_time", 0),
                    "updated_time": item.get("updated_time", 0),
                    "voteup_count": item.get("voteup_count", 0),
                    "comment_count": item.get("comment_count", 0),
                    "author_id": item.get("author", {}).get("id", ""),
                    "author_name": item.get("author", {}).get("name", ""),
                    "author_avatar": item.get("author", {}).get("avatar_url", ""),
                }
            elif content_type == "article":
                content_id = str(item.get("id", ""))
                return {
                    "content_id": content_id,
                    "content_type": "article",
                    "title": extract_text_from_html(item.get("title", "")),
                    "content_text": extract_text_from_html(item.get("content", "") or item.get("excerpt", "")),
                    "content_url": f"{ZHIHU_ZHUANLAN_URL}/p/{content_id}",
                    "created_time": item.get("created_time", 0) or item.get("created", 0),
                    "updated_time": item.get("updated_time", 0) or item.get("updated", 0),
                    "voteup_count": item.get("voteup_count", 0),
                    "comment_count": item.get("comment_count", 0),
                    "author_id": item.get("author", {}).get("id", ""),
                    "author_name": item.get("author", {}).get("name", ""),
                    "author_avatar": item.get("author", {}).get("avatar_url", ""),
                }
            return None
        except Exception as e:
            print(f"[ERROR] Extract content failed: {e}")
            return None

    async def get_creator_answers(self, url_token: str, offset: int = 0, limit: int = 20) -> Dict:
        """Get creator's answers."""
        url = f"{ZHIHU_URL}/api/v4/members/{url_token}/answers"
        params = {
            "include": "data[*].is_normal,comment_count,content,voteup_count,created_time,updated_time;data[*].question.title;data[*].author.name,avatar_url",
            "offset": offset,
            "limit": limit,
            "sort_by": "created",
        }
        return await self.request(url, params)

    async def get_creator_articles(self, url_token: str, offset: int = 0, limit: int = 20) -> Dict:
        """Get creator's articles."""
        url = f"{ZHIHU_URL}/api/v4/members/{url_token}/articles"
        params = {
            "include": "data[*].comment_count,content,voteup_count,created,updated;data[*].author.name,avatar_url",
            "offset": offset,
            "limit": limit,
            "sort_by": "created",
        }
        return await self.request(url, params)

    async def crawl_creator(self, creator_url: str) -> Dict:
        """Crawl a single creator's content."""
        # Extract url_token from URL
        url_token = creator_url.rstrip("/").split("/")[-1]
        print(f"\n[INFO] Crawling creator: {url_token}")

        # Get creator info
        html = await self.request_html(f"{ZHIHU_URL}/people/{url_token}")
        creator = self.extract_creator_from_html(url_token, html)
        if not creator:
            print(f"[ERROR] Failed to get creator info for {url_token}")
            return {"creator": None, "contents": []}

        print(f"[INFO] Creator: {creator['user_nickname']} (answers: {creator['answer_count']}, articles: {creator['article_count']})")

        # Save creator to DB
        self.save_creator(creator)

        contents = []

        # Crawl answers
        print(f"[INFO] Crawling answers...")
        offset = 0
        while True:
            res = await self.get_creator_answers(url_token, offset)
            if not res or not res.get("data"):
                break

            should_stop = False
            for item in res.get("data", []):
                content = self.extract_content(item, "answer")
                if content:
                    # Apply time filter
                    created_time = content.get("created_time", 0)
                    if self.start_timestamp and created_time < self.start_timestamp:
                        # Content is older than start date, stop crawling (since sorted by created)
                        should_stop = True
                        continue
                    if self.end_timestamp and created_time > self.end_timestamp:
                        # Content is newer than end date, skip it
                        continue
                    contents.append(content)
                    self.save_content(content)

            paging = res.get("paging", {})
            if paging.get("is_end", True) or should_stop:
                break

            offset += 20
            await asyncio.sleep(CRAWL_INTERVAL)

        print(f"[INFO] Crawled {len([c for c in contents if c['content_type'] == 'answer'])} answers")

        # Crawl articles
        print(f"[INFO] Crawling articles...")
        offset = 0
        while True:
            res = await self.get_creator_articles(url_token, offset)
            if not res or not res.get("data"):
                break

            should_stop = False
            for item in res.get("data", []):
                content = self.extract_content(item, "article")
                if content:
                    # Apply time filter
                    created_time = content.get("created_time", 0)
                    if self.start_timestamp and created_time < self.start_timestamp:
                        # Content is older than start date, stop crawling
                        should_stop = True
                        continue
                    if self.end_timestamp and created_time > self.end_timestamp:
                        # Content is newer than end date, skip it
                        continue
                    contents.append(content)
                    self.save_content(content)

            paging = res.get("paging", {})
            if paging.get("is_end", True) or should_stop:
                break

            offset += 20
            await asyncio.sleep(CRAWL_INTERVAL)

        print(f"[INFO] Crawled {len([c for c in contents if c['content_type'] == 'article'])} articles")

        # Update last_crawled_at
        self.update_creator_crawled_time(creator["user_id"])

        return {"creator": creator, "contents": contents}

    def save_creator(self, creator: Dict):
        """Save creator to database."""
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            if is_postgres():
                cursor.execute("""
                    INSERT INTO zhihu_creators
                    (user_id, url_token, user_nickname, user_avatar, user_link, gender,
                     fans, follows, answer_count, article_count, voteup_count, is_active, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1, CURRENT_TIMESTAMP)
                    ON CONFLICT(user_id) DO UPDATE SET
                        url_token = EXCLUDED.url_token,
                        user_nickname = EXCLUDED.user_nickname,
                        user_avatar = EXCLUDED.user_avatar,
                        user_link = EXCLUDED.user_link,
                        gender = EXCLUDED.gender,
                        fans = EXCLUDED.fans,
                        follows = EXCLUDED.follows,
                        answer_count = EXCLUDED.answer_count,
                        article_count = EXCLUDED.article_count,
                        voteup_count = EXCLUDED.voteup_count
                """, (
                    creator["user_id"],
                    creator["url_token"],
                    creator["user_nickname"],
                    creator["user_avatar"],
                    creator["user_link"],
                    creator["gender"],
                    creator["fans"],
                    creator["follows"],
                    creator["answer_count"],
                    creator["article_count"],
                    creator["voteup_count"],
                ))
            else:
                cursor.execute("""
                    INSERT OR REPLACE INTO zhihu_creators
                    (user_id, url_token, user_nickname, user_avatar, user_link, gender,
                     fans, follows, answer_count, article_count, voteup_count, is_active, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
                """, (
                    creator["user_id"],
                    creator["url_token"],
                    creator["user_nickname"],
                    creator["user_avatar"],
                    creator["user_link"],
                    creator["gender"],
                    creator["fans"],
                    creator["follows"],
                    creator["answer_count"],
                    creator["article_count"],
                    creator["voteup_count"],
                ))
            conn.commit()
        except Exception as e:
            print(f"[ERROR] Save creator failed: {e}")
        finally:
            conn.close()

    def save_content(self, content: Dict):
        """Save content to database."""
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            if is_postgres():
                cursor.execute("""
                    INSERT INTO zhihu_content
                    (content_id, content_type, title, content_text, content_url,
                     created_time, updated_time, voteup_count, comment_count,
                     author_id, author_name, author_avatar, is_tagged, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0, CURRENT_TIMESTAMP)
                    ON CONFLICT(content_id) DO UPDATE SET
                        content_type = EXCLUDED.content_type,
                        title = EXCLUDED.title,
                        content_text = EXCLUDED.content_text,
                        content_url = EXCLUDED.content_url,
                        created_time = EXCLUDED.created_time,
                        updated_time = EXCLUDED.updated_time,
                        voteup_count = EXCLUDED.voteup_count,
                        comment_count = EXCLUDED.comment_count,
                        author_id = EXCLUDED.author_id,
                        author_name = EXCLUDED.author_name,
                        author_avatar = EXCLUDED.author_avatar
                """, (
                    content["content_id"],
                    content["content_type"],
                    content["title"],
                    content["content_text"],
                    content["content_url"],
                    content["created_time"],
                    content["updated_time"],
                    content["voteup_count"],
                    content["comment_count"],
                    content["author_id"],
                    content["author_name"],
                    content["author_avatar"],
                ))
            else:
                cursor.execute("""
                    INSERT OR REPLACE INTO zhihu_content
                    (content_id, content_type, title, content_text, content_url,
                     created_time, updated_time, voteup_count, comment_count,
                     author_id, author_name, author_avatar, is_tagged, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
                """, (
                    content["content_id"],
                    content["content_type"],
                    content["title"],
                    content["content_text"],
                    content["content_url"],
                    content["created_time"],
                    content["updated_time"],
                    content["voteup_count"],
                    content["comment_count"],
                    content["author_id"],
                    content["author_name"],
                    content["author_avatar"],
                ))
            conn.commit()
        except Exception as e:
            print(f"[ERROR] Save content failed: {e}")
        finally:
            conn.close()

    def update_creator_crawled_time(self, user_id: str):
        """Update creator's last_crawled_at timestamp."""
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            if is_postgres():
                cursor.execute("""
                    UPDATE zhihu_creators SET last_crawled_at = CURRENT_TIMESTAMP WHERE user_id = %s
                """, (user_id,))
            else:
                cursor.execute("""
                    UPDATE zhihu_creators SET last_crawled_at = CURRENT_TIMESTAMP WHERE user_id = ?
                """, (user_id,))
            conn.commit()
        except Exception as e:
            print(f"[ERROR] Update crawled time failed: {e}")
        finally:
            conn.close()


def get_monitored_creators() -> List[str]:
    """Get list of monitored creator URLs from database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT user_link FROM zhihu_creators WHERE is_active = 1")
        rows = cursor.fetchall()
        return [row[0] for row in rows]
    except Exception as e:
        print(f"[ERROR] Get creators failed: {e}")
        return []
    finally:
        conn.close()


def get_creators_by_ids(user_ids: List[str]) -> List[str]:
    """Get creator URLs by user_ids."""
    if not user_ids:
        return []
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if is_postgres():
            placeholders = ",".join(["%s" for _ in user_ids])
        else:
            placeholders = ",".join(["?" for _ in user_ids])
        cursor.execute(f"SELECT user_link FROM zhihu_creators WHERE user_id IN ({placeholders})", user_ids)
        rows = cursor.fetchall()
        return [row[0] for row in rows if row[0]]
    except Exception as e:
        print(f"[ERROR] Get creators by ids failed: {e}")
        return []
    finally:
        conn.close()


def get_cookies_from_db() -> str:
    """Get saved cookies from database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if is_postgres():
            cursor.execute("SELECT value FROM crawler_config WHERE key = %s", ('zhihu_cookies',))
        else:
            cursor.execute("SELECT value FROM crawler_config WHERE key = ?", ('zhihu_cookies',))
        row = cursor.fetchone()
        return row[0] if row else ""
    except Exception as e:
        print(f"[ERROR] Get cookies failed: {e}")
        return ""
    finally:
        conn.close()


async def main():
    parser = argparse.ArgumentParser(description="Zhihu Crawler for DangInvest")
    parser.add_argument("--creators", type=str, help="Comma-separated creator URLs")
    parser.add_argument("--headless", action="store_true", help="Run in headless mode")
    parser.add_argument("--cookies", type=str, help="Zhihu cookies string")
    parser.add_argument("--start-date", type=str, help="Start date filter (YYYY-MM-DD)")
    parser.add_argument("--end-date", type=str, help="End date filter (YYYY-MM-DD)")
    parser.add_argument("--creator-ids", type=str, help="Comma-separated creator user_ids to crawl")
    args = parser.parse_args()

    # Parse date filters
    start_timestamp = None
    end_timestamp = None
    if args.start_date:
        try:
            start_timestamp = int(datetime.strptime(args.start_date, "%Y-%m-%d").timestamp())
            print(f"[INFO] Filter: start_date = {args.start_date}")
        except ValueError:
            print(f"[WARN] Invalid start-date format: {args.start_date}")
    if args.end_date:
        try:
            # Add 1 day to include the end date
            end_timestamp = int(datetime.strptime(args.end_date, "%Y-%m-%d").timestamp()) + 86400
            print(f"[INFO] Filter: end_date = {args.end_date}")
        except ValueError:
            print(f"[WARN] Invalid end-date format: {args.end_date}")

    # Get cookies
    cookies = args.cookies or get_cookies_from_db()

    # Get creator URLs
    if args.creators:
        creator_urls = [url.strip() for url in args.creators.split(",")]
    elif args.creator_ids:
        # Get specific creators by user_id
        creator_ids = [id.strip() for id in args.creator_ids.split(",")]
        creator_urls = get_creators_by_ids(creator_ids)
        print(f"[INFO] Crawling selected creators: {len(creator_urls)} of {len(creator_ids)} requested")
    else:
        creator_urls = get_monitored_creators()

    if not creator_urls:
        print("[WARN] No creators to crawl. Add creators via the Settings page.")
        return

    print(f"[INFO] Starting crawler for {len(creator_urls)} creators")
    print(f"[INFO] Database: {DATABASE_URL if is_postgres() else DB_PATH}")

    crawler = ZhihuCrawler(cookies=cookies, headless=args.headless)
    crawler.start_timestamp = start_timestamp
    crawler.end_timestamp = end_timestamp

    total_contents = 0
    for url in creator_urls:
        result = await crawler.crawl_creator(url)
        total_contents += len(result.get("contents", []))
        await asyncio.sleep(CRAWL_INTERVAL)

    print(f"\n[INFO] Crawling complete! Total contents: {total_contents}")
    print("[INFO] Run 'python scripts/tag_articles.py' to tag articles with stock keywords")


if __name__ == "__main__":
    asyncio.run(main())
