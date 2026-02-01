#!/usr/bin/env python3
"""
SQLite to PostgreSQL 数据同步脚本

用法:
    # 本地导出
    python scripts/sync_to_server.py export

    # 服务器导入
    python scripts/sync_to_server.py import

    # 查看统计
    python scripts/sync_to_server.py stats
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def get_sqlite_engine():
    """获取本地 SQLite 连接."""
    from sqlalchemy import create_engine
    sqlite_path = Path(__file__).parent.parent / "MediaCrawler" / "database" / "sqlite_tables.db"
    if not sqlite_path.exists():
        print(f"❌ SQLite 数据库不存在: {sqlite_path}")
        sys.exit(1)
    return create_engine(f"sqlite:///{sqlite_path}")


def get_postgres_engine():
    """获取服务器 PostgreSQL 连接."""
    from sqlalchemy import create_engine
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        # 尝试从 backend 配置读取
        try:
            sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
            from app.config import settings
            db_url = settings.get_database_url()
        except Exception:
            pass

    if not db_url or "sqlite" in db_url:
        print("❌ 未配置 PostgreSQL DATABASE_URL")
        print("   请设置环境变量: export DATABASE_URL=postgresql://user:pass@host:5432/dbname")
        sys.exit(1)

    return create_engine(db_url)


def export_data():
    """从 SQLite 导出数据到 JSON."""
    from sqlalchemy import text

    engine = get_sqlite_engine()
    export_path = Path(__file__).parent.parent / "data" / "zhihu_export.json"
    export_path.parent.mkdir(exist_ok=True)

    print("📦 正在从 SQLite 导出数据...")

    data = {
        "exported_at": datetime.now().isoformat(),
        "zhihu_content": [],
        "zhihu_creator": [],
    }

    with engine.connect() as conn:
        # 导出文章
        result = conn.execute(text("""
            SELECT
                content_id, content_type, title, content_text, content_url,
                created_time, updated_time, voteup_count, comment_count,
                user_id, user_nickname, user_avatar
            FROM zhihu_content
        """))

        for row in result:
            data["zhihu_content"].append({
                "content_id": row[0],
                "content_type": row[1],
                "title": row[2],
                "content_text": row[3],
                "content_url": row[4],
                "created_time": int(row[5]) if row[5] else 0,
                "updated_time": int(row[6]) if row[6] else 0,
                "voteup_count": row[7] or 0,
                "comment_count": row[8] or 0,
                "author_id": row[9],
                "author_name": row[10],
                "author_avatar": row[11],
            })

        # 导出创作者
        result = conn.execute(text("""
            SELECT
                user_id, url_token, user_nickname, user_avatar, user_link,
                gender, fans, follows, anwser_count, article_count, get_voteup_count
            FROM zhihu_creator
        """))

        for row in result:
            data["zhihu_creator"].append({
                "user_id": row[0],
                "url_token": row[1],
                "user_nickname": row[2],
                "user_avatar": row[3],
                "user_link": row[4],
                "gender": row[5],
                "fans": row[6] or 0,
                "follows": row[7] or 0,
                "answer_count": row[8] or 0,
                "article_count": row[9] or 0,
                "voteup_count": row[10] or 0,
            })

    with open(export_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ 导出完成!")
    print(f"   文章: {len(data['zhihu_content'])} 条")
    print(f"   创作者: {len(data['zhihu_creator'])} 条")
    print(f"   文件: {export_path}")


def import_data():
    """从 JSON 导入数据到 PostgreSQL."""
    from sqlalchemy import text

    engine = get_postgres_engine()
    import_path = Path(__file__).parent.parent / "data" / "zhihu_export.json"

    if not import_path.exists():
        print(f"❌ 导入文件不存在: {import_path}")
        sys.exit(1)

    print("📥 正在导入数据到 PostgreSQL...")

    with open(import_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"   导出时间: {data.get('exported_at', 'unknown')}")

    inserted_content = 0
    updated_content = 0
    inserted_creator = 0
    updated_creator = 0

    with engine.begin() as conn:
        # 导入文章 (使用 UPSERT)
        for item in data["zhihu_content"]:
            result = conn.execute(text("""
                INSERT INTO zhihu_content
                    (content_id, content_type, title, content_text, content_url,
                     created_time, updated_time, voteup_count, comment_count,
                     author_id, author_name, author_avatar, is_tagged)
                VALUES
                    (:content_id, :content_type, :title, :content_text, :content_url,
                     :created_time, :updated_time, :voteup_count, :comment_count,
                     :author_id, :author_name, :author_avatar, 0)
                ON CONFLICT (content_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    content_text = EXCLUDED.content_text,
                    voteup_count = EXCLUDED.voteup_count,
                    comment_count = EXCLUDED.comment_count,
                    updated_time = EXCLUDED.updated_time
                RETURNING (xmax = 0) AS inserted
            """), item)
            row = result.fetchone()
            if row and row[0]:
                inserted_content += 1
            else:
                updated_content += 1

        # 导入创作者 (使用 UPSERT)
        for item in data["zhihu_creator"]:
            result = conn.execute(text("""
                INSERT INTO zhihu_creators
                    (user_id, url_token, user_nickname, user_avatar, user_link,
                     gender, fans, follows, answer_count, article_count, voteup_count,
                     is_active)
                VALUES
                    (:user_id, :url_token, :user_nickname, :user_avatar, :user_link,
                     :gender, :fans, :follows, :answer_count, :article_count, :voteup_count,
                     1)
                ON CONFLICT (user_id) DO UPDATE SET
                    user_nickname = EXCLUDED.user_nickname,
                    user_avatar = EXCLUDED.user_avatar,
                    fans = EXCLUDED.fans,
                    follows = EXCLUDED.follows,
                    answer_count = EXCLUDED.answer_count,
                    article_count = EXCLUDED.article_count,
                    voteup_count = EXCLUDED.voteup_count
                RETURNING (xmax = 0) AS inserted
            """), item)
            row = result.fetchone()
            if row and row[0]:
                inserted_creator += 1
            else:
                updated_creator += 1

    print(f"✅ 导入完成!")
    print(f"   文章: 新增 {inserted_content}, 更新 {updated_content}")
    print(f"   创作者: 新增 {inserted_creator}, 更新 {updated_creator}")


def show_stats():
    """显示数据库统计信息."""
    from sqlalchemy import text

    print("📊 数据库统计\n")

    # SQLite
    try:
        engine = get_sqlite_engine()
        with engine.connect() as conn:
            content_count = conn.execute(text("SELECT COUNT(*) FROM zhihu_content")).scalar()
            creator_count = conn.execute(text("SELECT COUNT(*) FROM zhihu_creator")).scalar()
        print(f"本地 SQLite:")
        print(f"  文章: {content_count}")
        print(f"  创作者: {creator_count}")
    except Exception as e:
        print(f"本地 SQLite: 无法连接 ({e})")

    print()

    # PostgreSQL
    try:
        engine = get_postgres_engine()
        with engine.connect() as conn:
            content_count = conn.execute(text("SELECT COUNT(*) FROM zhihu_content")).scalar()
            creator_count = conn.execute(text("SELECT COUNT(*) FROM zhihu_creators")).scalar()
        print(f"服务器 PostgreSQL:")
        print(f"  文章: {content_count}")
        print(f"  创作者: {creator_count}")
    except Exception as e:
        print(f"服务器 PostgreSQL: 无法连接 ({e})")


def main():
    parser = argparse.ArgumentParser(description="SQLite to PostgreSQL 数据同步")
    parser.add_argument(
        "action",
        choices=["export", "import", "stats"],
        help="操作类型: export(导出), import(导入), stats(统计)"
    )

    args = parser.parse_args()

    if args.action == "export":
        export_data()
    elif args.action == "import":
        import_data()
    elif args.action == "stats":
        show_stats()


if __name__ == "__main__":
    main()
