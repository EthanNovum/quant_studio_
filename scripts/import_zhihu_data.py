#!/usr/bin/env python3
"""
Import Zhihu data from MediaCrawler SQLite database to DangInvest database.
"""

import os
import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
SOURCE_DB = PROJECT_ROOT / "MediaCrawler" / "database" / "sqlite_tables.db"

# Database configuration
DATABASE_URL = os.environ.get("DATABASE_URL", None)
TARGET_DB = PROJECT_ROOT / "backend" / "data" / "alphanote.db"


def get_target_connection():
    """Get target database connection (PostgreSQL or SQLite)."""
    if DATABASE_URL and DATABASE_URL.startswith("postgresql"):
        import psycopg2
        return psycopg2.connect(DATABASE_URL)
    else:
        return sqlite3.connect(TARGET_DB)


def is_postgres():
    """Check if using PostgreSQL."""
    return DATABASE_URL and DATABASE_URL.startswith("postgresql")


def import_data():
    print(f"[INFO] Source DB: {SOURCE_DB}")
    print(f"[INFO] Target DB: {DATABASE_URL if is_postgres() else TARGET_DB}")

    if not SOURCE_DB.exists():
        print(f"[ERROR] Source database not found: {SOURCE_DB}")
        return

    source_conn = sqlite3.connect(SOURCE_DB)
    target_conn = get_target_connection()

    source_cur = source_conn.cursor()
    target_cur = target_conn.cursor()

    # Import zhihu_creator
    print("\n[INFO] Importing zhihu_creators...")
    source_cur.execute("SELECT * FROM zhihu_creator")
    creators = source_cur.fetchall()

    imported_creators = 0
    for row in creators:
        try:
            # MediaCrawler schema: id, user_id, user_link, user_nickname, user_avatar, url_token,
            # gender, ip_location, follows, fans, anwser_count, video_count, question_count,
            # article_count, column_count, get_voteup_count, add_ts, last_modify_ts
            if is_postgres():
                target_cur.execute("""
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
                    row[1],  # user_id
                    row[5],  # url_token
                    row[3],  # user_nickname
                    row[4],  # user_avatar
                    row[2],  # user_link
                    row[6],  # gender
                    row[9],  # fans
                    row[8],  # follows
                    row[10], # anwser_count -> answer_count
                    row[13], # article_count
                    row[15], # get_voteup_count -> voteup_count
                ))
            else:
                target_cur.execute("""
                    INSERT OR REPLACE INTO zhihu_creators
                    (user_id, url_token, user_nickname, user_avatar, user_link, gender,
                     fans, follows, answer_count, article_count, voteup_count, is_active, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
                """, (
                    row[1],  # user_id
                    row[5],  # url_token
                    row[3],  # user_nickname
                    row[4],  # user_avatar
                    row[2],  # user_link
                    row[6],  # gender
                    row[9],  # fans
                    row[8],  # follows
                    row[10], # anwser_count -> answer_count
                    row[13], # article_count
                    row[15], # get_voteup_count -> voteup_count
                ))
            imported_creators += 1
        except Exception as e:
            print(f"  [WARN] Failed to import creator {row[1]}: {e}")

    print(f"  [OK] Imported {imported_creators} creators")

    # Import zhihu_content
    print("\n[INFO] Importing zhihu_content...")
    source_cur.execute("SELECT * FROM zhihu_content")
    contents = source_cur.fetchall()

    imported_contents = 0
    for row in contents:
        try:
            # MediaCrawler schema: id, content_id, content_type, content_text, content_url,
            # question_id, title, desc, created_time, updated_time, voteup_count, comment_count,
            # source_keyword, user_id, user_link, user_nickname, user_avatar, user_url_token,
            # add_ts, last_modify_ts

            # Convert created_time from string to int if needed
            created_time = row[8]
            if isinstance(created_time, str):
                try:
                    created_time = int(created_time)
                except:
                    created_time = 0

            if is_postgres():
                target_cur.execute("""
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
                    row[1],   # content_id
                    row[2],   # content_type
                    row[6] or row[7] or "",  # title (use desc as fallback)
                    row[3],   # content_text
                    row[4],   # content_url
                    created_time,  # created_time
                    row[9] if row[9] else 0,   # updated_time
                    row[10] or 0,  # voteup_count
                    row[11] or 0,  # comment_count
                    row[13],  # user_id -> author_id
                    row[15],  # user_nickname -> author_name
                    row[16],  # user_avatar -> author_avatar
                ))
            else:
                target_cur.execute("""
                    INSERT OR REPLACE INTO zhihu_content
                    (content_id, content_type, title, content_text, content_url,
                     created_time, updated_time, voteup_count, comment_count,
                     author_id, author_name, author_avatar, is_tagged, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
                """, (
                    row[1],   # content_id
                    row[2],   # content_type
                    row[6] or row[7] or "",  # title (use desc as fallback)
                    row[3],   # content_text
                    row[4],   # content_url
                    created_time,  # created_time
                    row[9] if row[9] else 0,   # updated_time
                    row[10] or 0,  # voteup_count
                    row[11] or 0,  # comment_count
                    row[13],  # user_id -> author_id
                    row[15],  # user_nickname -> author_name
                    row[16],  # user_avatar -> author_avatar
                ))
            imported_contents += 1
        except Exception as e:
            print(f"  [WARN] Failed to import content {row[1]}: {e}")

    print(f"  [OK] Imported {imported_contents} contents")

    target_conn.commit()
    source_conn.close()
    target_conn.close()

    print("\n[INFO] Import complete!")
    print("[INFO] Now run 'python scripts/tag_articles.py' to tag articles with stock keywords")


if __name__ == "__main__":
    import_data()
