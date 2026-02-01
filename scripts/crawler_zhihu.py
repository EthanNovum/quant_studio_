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
import hashlib
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

# Try to import execjs for signing, fall back to built-in implementation
try:
    import execjs
    HAS_EXECJS = True
except ImportError:
    HAS_EXECJS = False
    print("[WARN] execjs not installed, using built-in signing (may not work)")


# ========== Zhihu Signing Implementation ==========
# Based on MediaCrawler/libs/zhihu.js

INIT_STR = "6fpLRqJO8M/c3jnYxFkUVC4ZIG12SiH=5v0mXDazWBTsuw7QetbKdoPyAl+hN9rgE"
ZK = [1170614578, 1024848638, 1413669199, -343334464, -766094290, -1373058082, -143119608, -297228157, 1933479194, -971186181, -406453910, 460404854, -547427574, -1891326262, -1679095901, 2119585428, -2029270069, 2035090028, -1521520070, -5587175, -77751101, -2094365853, -1243052806, 1579901135, 1321810770, 456816404, -1391643889, -229302305, 330002838, -788960546, 363569021, -1947871109]
ZB = [20, 223, 245, 7, 248, 2, 194, 209, 87, 6, 227, 253, 240, 128, 222, 91, 237, 9, 125, 157, 230, 93, 252, 205, 90, 79, 144, 199, 159, 197, 186, 167, 39, 37, 156, 198, 38, 42, 43, 168, 217, 153, 15, 103, 80, 189, 71, 191, 97, 84, 247, 95, 36, 69, 14, 35, 12, 171, 28, 114, 178, 148, 86, 182, 32, 83, 158, 109, 22, 255, 94, 238, 151, 85, 77, 124, 254, 18, 4, 26, 123, 176, 232, 193, 131, 172, 143, 142, 150, 30, 10, 146, 162, 62, 224, 218, 196, 229, 1, 192, 213, 27, 110, 56, 231, 180, 138, 107, 242, 187, 54, 120, 19, 44, 117, 228, 215, 203, 53, 239, 251, 127, 81, 11, 133, 96, 204, 132, 41, 115, 73, 55, 249, 147, 102, 48, 122, 145, 106, 118, 74, 190, 29, 16, 174, 5, 177, 129, 63, 113, 99, 31, 161, 76, 246, 34, 211, 13, 60, 68, 207, 160, 65, 111, 82, 165, 67, 169, 225, 57, 112, 244, 155, 51, 236, 200, 233, 58, 61, 47, 100, 137, 185, 64, 17, 70, 234, 163, 219, 108, 170, 166, 59, 149, 52, 105, 24, 212, 78, 173, 45, 0, 116, 226, 119, 136, 206, 135, 175, 195, 25, 92, 121, 208, 126, 139, 3, 75, 141, 21, 130, 98, 241, 40, 154, 66, 184, 49, 181, 46, 243, 88, 101, 183, 8, 23, 72, 188, 104, 179, 210, 134, 250, 201, 164, 89, 216, 202, 220, 50, 221, 152, 140, 33, 235, 214]

ZHIHU_SIGN_JS = None


def _load_sign_js():
    """Load zhihu.js signing script."""
    global ZHIHU_SIGN_JS
    if ZHIHU_SIGN_JS is None and HAS_EXECJS:
        js_path = PROJECT_ROOT / "MediaCrawler" / "libs" / "zhihu.js"
        if js_path.exists():
            with open(js_path, "r", encoding="utf-8-sig") as f:
                ZHIHU_SIGN_JS = execjs.compile(f.read())
    return ZHIHU_SIGN_JS


def extract_dc0_from_cookies(cookies: str) -> str:
    """Extract d_c0 value from cookies string."""
    match = re.search(r'd_c0=([^;]+)', cookies)
    return match.group(1) if match else ""


def zhihu_sign(url: str, cookies: str) -> Dict[str, str]:
    """
    Generate Zhihu API signing headers.

    Args:
        url: Request URL path with query string (e.g., /api/v4/members/xxx/answers?...)
        cookies: Cookie string containing d_c0

    Returns:
        Dict with x-zst-81 and x-zse-96 headers
    """
    js = _load_sign_js()
    if js:
        try:
            return js.call("get_sign", url, cookies)
        except Exception as e:
            print(f"[WARN] JS signing failed: {e}, using fallback")

    # Fallback: return empty headers (will likely fail with 403)
    return {"x-zst-81": "", "x-zse-96": ""}

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


class CrawlerStoppedError(Exception):
    """Exception raised when crawler is stopped due to too many errors."""
    pass


class ZhihuCrawler:
    """Simplified Zhihu crawler."""

    def __init__(self, cookies: str = "", headless: bool = True):
        self.cookies = cookies
        self.headless = headless
        self.start_timestamp = None  # Filter: only save content after this time
        self.end_timestamp = None    # Filter: only save content before this time
        self.consecutive_403_count = 0  # Track consecutive 403 errors
        self.max_403_errors = 3  # Stop after this many consecutive 403s
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

    def _check_403_limit(self, status_code: int):
        """Check if we've hit too many 403 errors."""
        if status_code == 403:
            self.consecutive_403_count += 1
            print(f"[WARN] 403 Forbidden (count: {self.consecutive_403_count}/{self.max_403_errors})")
            if self.consecutive_403_count >= self.max_403_errors:
                error_msg = (
                    f"\n[ERROR] ========================================\n"
                    f"[ERROR] 连续 {self.max_403_errors} 次请求返回 403 Forbidden!\n"
                    f"[ERROR] 可能的原因:\n"
                    f"[ERROR]   1. Cookie 已过期，请更新 Cookie\n"
                    f"[ERROR]   2. 请求频率过高，被知乎限制\n"
                    f"[ERROR]   3. IP 被临时封禁\n"
                    f"[ERROR] \n"
                    f"[ERROR] 建议操作:\n"
                    f"[ERROR]   1. 前往 设置页面 更新知乎 Cookie\n"
                    f"[ERROR]   2. 等待一段时间后重试\n"
                    f"[ERROR] ========================================\n"
                )
                print(error_msg)
                raise CrawlerStoppedError("Too many 403 errors, please update cookies")
        else:
            # Reset counter on successful request
            self.consecutive_403_count = 0

    async def request(self, url: str, params: Optional[Dict] = None, need_sign: bool = True) -> Dict:
        """Make HTTP request to Zhihu API with signing."""
        try:
            async with httpx.AsyncClient() as client:
                # Build full URL for signing
                full_url = url
                if params:
                    full_url = f"{url}?{urlencode(params)}"

                # Get signing headers
                headers = self.headers.copy()
                if need_sign and self.cookies:
                    # Extract path for signing (remove domain)
                    url_path = full_url.replace(ZHIHU_URL, "")
                    sign_headers = zhihu_sign(url_path, self.cookies)
                    headers.update(sign_headers)

                response = await client.get(full_url, headers=headers, timeout=30)

                # Check for 403 errors
                self._check_403_limit(response.status_code)

                if response.status_code == 200:
                    return response.json()
                else:
                    print(f"[ERROR] Request failed: {response.status_code} - {full_url}")
                    return {}
        except CrawlerStoppedError:
            raise  # Re-raise to stop the crawler
        except Exception as e:
            print(f"[ERROR] Request error: {e}")
            return {}

    async def request_html(self, url: str, need_sign: bool = True) -> str:
        """Make HTTP request and return HTML with signing."""
        try:
            async with httpx.AsyncClient() as client:
                headers = self.headers.copy()
                if need_sign and self.cookies:
                    # Extract path for signing (remove domain)
                    url_path = url.replace(ZHIHU_URL, "")
                    sign_headers = zhihu_sign(url_path, self.cookies)
                    headers.update(sign_headers)

                response = await client.get(url, headers=headers, timeout=30)

                # Check for 403 errors
                self._check_403_limit(response.status_code)

                if response.status_code == 200:
                    return response.text
                else:
                    print(f"[ERROR] Request failed: {response.status_code}")
                    return ""
        except CrawlerStoppedError:
            raise  # Re-raise to stop the crawler
        except Exception as e:
            print(f"[ERROR] Request error: {e}")
            return ""

    async def get_creator_info(self, url_token: str) -> Optional[Dict]:
        """Get creator info via API."""
        url = f"{ZHIHU_URL}/api/v4/members/{url_token}"
        params = {
            "include": "follower_count,following_count,answer_count,articles_count,voteup_count"
        }
        data = await self.request(url, params)
        if not data or "id" not in data:
            return None

        return {
            "user_id": data.get("id", ""),
            "url_token": data.get("url_token", url_token),
            "user_nickname": data.get("name", ""),
            "user_avatar": data.get("avatar_url", ""),
            "user_link": f"{ZHIHU_URL}/people/{url_token}",
            "gender": "男" if data.get("gender") == 1 else ("女" if data.get("gender") == 0 else "未知"),
            "fans": data.get("follower_count", 0),
            "follows": data.get("following_count", 0),
            "answer_count": data.get("answer_count", 0),
            "article_count": data.get("articles_count", 0),
            "voteup_count": data.get("voteup_count", 0),
        }

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

    async def crawl_creator(self, creator_url: str, incremental: bool = True) -> Dict:
        """Crawl a single creator's content.

        Args:
            creator_url: Creator's Zhihu profile URL
            incremental: If True, only crawl content newer than what's in database
        """
        # Extract url_token from URL
        url_token = creator_url.rstrip("/").split("/")[-1]
        print(f"\n[INFO] Crawling creator: {url_token}")

        # Get creator info via API (more reliable than HTML scraping)
        creator = await self.get_creator_info(url_token)
        if not creator:
            # Fallback to HTML method
            html = await self.request_html(f"{ZHIHU_URL}/people/{url_token}")
            creator = self.extract_creator_from_html(url_token, html)
        if not creator:
            print(f"[ERROR] Failed to get creator info for {url_token}")
            return {"creator": None, "contents": []}

        print(f"[INFO] Creator: {creator['user_nickname']} (answers: {creator['answer_count']}, articles: {creator['article_count']})")

        # Save creator to DB
        self.save_creator(creator)

        # 增量更新：获取数据库中该创作者最新文章的时间
        latest_time_in_db = None
        db_content_count = 0
        if incremental and not self.start_timestamp:
            latest_time_in_db = get_latest_content_time_for_creator(creator["user_id"])
            db_content_count = get_content_count_for_creator(creator["user_id"])
            if latest_time_in_db:
                latest_date = datetime.fromtimestamp(latest_time_in_db).strftime("%Y-%m-%d %H:%M")
                print(f"[INFO] 增量模式: 数据库已有 {db_content_count} 篇, 最新时间 {latest_date}")
            else:
                print(f"[INFO] 全量模式: 数据库暂无该创作者的文章")

        contents = []
        new_count = 0
        skipped_count = 0

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
                    created_time = content.get("created_time", 0)

                    # 增量检查：如果文章时间早于数据库最新时间，停止爬取
                    if incremental and latest_time_in_db and created_time <= latest_time_in_db:
                        skipped_count += 1
                        should_stop = True
                        continue

                    # Apply time filter (命令行参数)
                    if self.start_timestamp and created_time < self.start_timestamp:
                        should_stop = True
                        continue
                    if self.end_timestamp and created_time > self.end_timestamp:
                        continue

                    contents.append(content)
                    self.save_content(content)
                    new_count += 1

            paging = res.get("paging", {})
            if paging.get("is_end", True) or should_stop:
                break

            offset += 20
            await asyncio.sleep(CRAWL_INTERVAL)

        print(f"[INFO] Crawled {len([c for c in contents if c['content_type'] == 'answer'])} new answers")

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
                    created_time = content.get("created_time", 0)

                    # 增量检查：如果文章时间早于数据库最新时间，停止爬取
                    if incremental and latest_time_in_db and created_time <= latest_time_in_db:
                        skipped_count += 1
                        should_stop = True
                        continue

                    # Apply time filter
                    if self.start_timestamp and created_time < self.start_timestamp:
                        should_stop = True
                        continue
                    if self.end_timestamp and created_time > self.end_timestamp:
                        continue

                    contents.append(content)
                    self.save_content(content)
                    new_count += 1

            paging = res.get("paging", {})
            if paging.get("is_end", True) or should_stop:
                break

            offset += 20
            await asyncio.sleep(CRAWL_INTERVAL)

        print(f"[INFO] Crawled {len([c for c in contents if c['content_type'] == 'article'])} new articles")

        if incremental and latest_time_in_db:
            print(f"[INFO] 增量同步完成: 新增 {new_count} 篇, 跳过已有 {skipped_count} 篇")

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


def get_latest_content_time_for_creator(author_id: str) -> Optional[int]:
    """获取某个创作者在数据库中最新文章的时间戳."""
    if not author_id:
        return None
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if is_postgres():
            cursor.execute("""
                SELECT MAX(created_time) FROM zhihu_content WHERE author_id = %s
            """, (author_id,))
        else:
            cursor.execute("""
                SELECT MAX(created_time) FROM zhihu_content WHERE author_id = ?
            """, (author_id,))
        row = cursor.fetchone()
        return row[0] if row and row[0] else None
    except Exception as e:
        print(f"[ERROR] Get latest content time failed: {e}")
        return None
    finally:
        conn.close()


def get_content_count_for_creator(author_id: str) -> int:
    """获取某个创作者在数据库中的文章数量."""
    if not author_id:
        return 0
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if is_postgres():
            cursor.execute("""
                SELECT COUNT(*) FROM zhihu_content WHERE author_id = %s
            """, (author_id,))
        else:
            cursor.execute("""
                SELECT COUNT(*) FROM zhihu_content WHERE author_id = ?
            """, (author_id,))
        row = cursor.fetchone()
        return row[0] if row else 0
    except Exception as e:
        print(f"[ERROR] Get content count failed: {e}")
        return 0
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
    parser.add_argument("--full", action="store_true", help="Full sync mode (ignore incremental, crawl all)")
    args = parser.parse_args()

    # 增量模式：默认开启，除非指定 --full 或 --start-date
    incremental = not args.full

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
    print(f"[INFO] Mode: {'全量同步' if not incremental else '增量同步 (只爬取新文章)'}")

    crawler = ZhihuCrawler(cookies=cookies, headless=args.headless)
    crawler.start_timestamp = start_timestamp
    crawler.end_timestamp = end_timestamp

    total_contents = 0
    for url in creator_urls:
        result = await crawler.crawl_creator(url, incremental=incremental)
        total_contents += len(result.get("contents", []))
        await asyncio.sleep(CRAWL_INTERVAL)

    print(f"\n[INFO] Crawling complete! Total new contents: {total_contents}")
    print("[INFO] Run 'python scripts/tag_articles.py' to tag articles with stock keywords")


if __name__ == "__main__":
    asyncio.run(main())
