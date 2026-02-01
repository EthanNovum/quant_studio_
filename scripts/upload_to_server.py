#!/usr/bin/env python3
"""
本地数据上传脚本 - 将 SQLite 数据上传到远程 PostgreSQL 服务器

功能:
  - 从本地 SQLite 读取文章和创作者数据
  - 通过 API 批量上传到服务器
  - 支持断点续传（跳过已存在的数据）
  - 支持分批上传，避免请求过大

用法:
    # 上传到服务器
    python scripts/upload_to_server.py --server https://your-server.com --token YOUR_PASSWORD

    # 只上传新数据（断点续传）
    python scripts/upload_to_server.py --server https://your-server.com --token YOUR_PASSWORD --resume

    # 指定批次大小
    python scripts/upload_to_server.py --server https://your-server.com --token YOUR_PASSWORD --batch-size 50

    # 查看本地数据统计
    python scripts/upload_to_server.py --stats
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import List, Set

import requests

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 默认配置
DEFAULT_BATCH_SIZE = 100
DEFAULT_SQLITE_PATH = Path(__file__).parent.parent / "MediaCrawler" / "database" / "sqlite_tables.db"
PROGRESS_FILE = Path(__file__).parent.parent / "data" / "upload_progress.json"


def get_sqlite_connection():
    """获取 SQLite 连接."""
    from sqlalchemy import create_engine

    sqlite_path = os.environ.get("SQLITE_PATH", str(DEFAULT_SQLITE_PATH))
    if not Path(sqlite_path).exists():
        print(f"❌ SQLite 数据库不存在: {sqlite_path}")
        sys.exit(1)

    return create_engine(f"sqlite:///{sqlite_path}")


def load_progress() -> dict:
    """加载上传进度."""
    if PROGRESS_FILE.exists():
        try:
            with open(PROGRESS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {"uploaded_content_ids": [], "uploaded_creator_ids": []}


def save_progress(progress: dict):
    """保存上传进度."""
    PROGRESS_FILE.parent.mkdir(exist_ok=True)
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f)


def fetch_articles_from_sqlite(engine, skip_ids: Set[str] = None) -> List[dict]:
    """从 SQLite 读取文章数据."""
    from sqlalchemy import text

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT
                content_id, content_type, title, content_text, content_url,
                created_time, updated_time, voteup_count, comment_count,
                user_id, user_nickname, user_avatar
            FROM zhihu_content
        """))

        articles = []
        for row in result:
            content_id = row[0]
            if skip_ids and content_id in skip_ids:
                continue

            articles.append({
                "content_id": content_id,
                "content_type": row[1] or "article",
                "title": row[2] or "",
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

        return articles


def fetch_creators_from_sqlite(engine, skip_ids: Set[str] = None) -> List[dict]:
    """从 SQLite 读取创作者数据."""
    from sqlalchemy import text

    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT
                user_id, url_token, user_nickname, user_avatar, user_link,
                gender, fans, follows, anwser_count, article_count, get_voteup_count
            FROM zhihu_creator
        """))

        creators = []
        for row in result:
            user_id = row[0]
            if skip_ids and user_id in skip_ids:
                continue

            creators.append({
                "user_id": user_id,
                "url_token": row[1] or "",
                "user_nickname": row[2] or "",
                "user_avatar": row[3],
                "user_link": row[4],
                "gender": row[5],
                "fans": row[6] or 0,
                "follows": row[7] or 0,
                "answer_count": row[8] or 0,
                "article_count": row[9] or 0,
                "voteup_count": row[10] or 0,
            })

        return creators


def get_server_status(server_url: str) -> dict:
    """获取服务器当前数据状态."""
    try:
        response = requests.get(
            f"{server_url}/api/sync/upload/status",
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"⚠️  无法获取服务器状态: {e}")
        return {"existing_content_ids": [], "article_count": 0, "creator_count": 0}


def upload_batch(
    server_url: str,
    token: str,
    articles: List[dict],
    creators: List[dict],
    batch_id: str = None,
) -> dict:
    """上传一批数据到服务器."""
    headers = {
        "Content-Type": "application/json",
        "X-Upload-Token": token,
    }

    payload = {
        "articles": articles,
        "creators": creators,
        "batch_id": batch_id,
    }

    response = requests.post(
        f"{server_url}/api/sync/upload",
        headers=headers,
        json=payload,
        timeout=120,
    )

    if response.status_code == 401:
        raise Exception("认证失败: 请检查 --token 参数")
    elif response.status_code == 403:
        raise Exception("权限不足: Token 无效")

    response.raise_for_status()
    return response.json()


def show_stats():
    """显示本地数据统计."""
    from sqlalchemy import text

    engine = get_sqlite_connection()

    with engine.connect() as conn:
        article_count = conn.execute(text("SELECT COUNT(*) FROM zhihu_content")).scalar()
        creator_count = conn.execute(text("SELECT COUNT(*) FROM zhihu_creator")).scalar()

    print("\n📊 本地 SQLite 数据统计")
    print("-" * 30)
    print(f"  文章数量: {article_count}")
    print(f"  创作者数量: {creator_count}")
    print(f"  数据库路径: {DEFAULT_SQLITE_PATH}")

    # 显示上传进度
    progress = load_progress()
    uploaded_articles = len(progress.get("uploaded_content_ids", []))
    uploaded_creators = len(progress.get("uploaded_creator_ids", []))

    if uploaded_articles > 0 or uploaded_creators > 0:
        print("\n📤 上传进度")
        print("-" * 30)
        print(f"  已上传文章: {uploaded_articles}")
        print(f"  已上传创作者: {uploaded_creators}")


def main():
    parser = argparse.ArgumentParser(description="本地数据上传到远程服务器")
    parser.add_argument("--server", "-s", type=str, help="服务器地址 (如 https://your-server.com)")
    parser.add_argument("--token", "-t", type=str, help="上传认证令牌 (AUTH_PASSWORD)")
    parser.add_argument("--batch-size", "-b", type=int, default=DEFAULT_BATCH_SIZE, help="每批上传数量")
    parser.add_argument("--resume", "-r", action="store_true", help="断点续传（跳过已上传的数据）")
    parser.add_argument("--stats", action="store_true", help="显示本地数据统计")
    parser.add_argument("--clear-progress", action="store_true", help="清除上传进度记录")

    args = parser.parse_args()

    if args.stats:
        show_stats()
        return

    if args.clear_progress:
        if PROGRESS_FILE.exists():
            PROGRESS_FILE.unlink()
            print("✅ 已清除上传进度记录")
        else:
            print("ℹ️  没有进度记录需要清除")
        return

    if not args.server or not args.token:
        parser.print_help()
        print("\n❌ 请提供 --server 和 --token 参数")
        sys.exit(1)

    server_url = args.server.rstrip("/")

    print(f"🔗 服务器: {server_url}")
    print(f"📦 批次大小: {args.batch_size}")
    print(f"🔄 断点续传: {'是' if args.resume else '否'}")
    print()

    # 获取服务器状态
    print("📡 正在获取服务器状态...")
    server_status = get_server_status(server_url)
    existing_ids = set(server_status.get("existing_content_ids", []))
    print(f"   服务器已有文章: {server_status.get('article_count', 0)}")
    print(f"   服务器已有创作者: {server_status.get('creator_count', 0)}")

    # 加载本地进度
    progress = load_progress() if args.resume else {"uploaded_content_ids": [], "uploaded_creator_ids": []}
    local_uploaded_ids = set(progress.get("uploaded_content_ids", []))
    local_uploaded_creator_ids = set(progress.get("uploaded_creator_ids", []))

    # 合并跳过的 ID
    skip_article_ids = existing_ids | local_uploaded_ids
    skip_creator_ids = set(local_uploaded_creator_ids)

    if args.resume:
        print(f"   本地已上传文章: {len(local_uploaded_ids)}")
        print(f"   本地已上传创作者: {len(local_uploaded_creator_ids)}")

    print()

    # 读取本地数据
    print("📖 正在读取本地 SQLite 数据...")
    engine = get_sqlite_connection()

    articles = fetch_articles_from_sqlite(engine, skip_article_ids if args.resume else None)
    creators = fetch_creators_from_sqlite(engine, skip_creator_ids if args.resume else None)

    print(f"   待上传文章: {len(articles)}")
    print(f"   待上传创作者: {len(creators)}")
    print()

    if not articles and not creators:
        print("✅ 没有新数据需要上传!")
        return

    # 分批上传
    total_articles = len(articles)
    total_creators = len(creators)
    batch_size = args.batch_size

    total_inserted = 0
    total_updated = 0

    # 上传文章
    if articles:
        print("📤 开始上传文章...")
        for i in range(0, total_articles, batch_size):
            batch = articles[i:i + batch_size]
            batch_num = i // batch_size + 1
            total_batches = (total_articles + batch_size - 1) // batch_size

            try:
                result = upload_batch(
                    server_url,
                    args.token,
                    articles=batch,
                    creators=[],
                    batch_id=f"articles-{batch_num}",
                )

                total_inserted += result.get("articles_inserted", 0)
                total_updated += result.get("articles_updated", 0)

                # 保存进度
                for item in batch:
                    progress["uploaded_content_ids"].append(item["content_id"])
                save_progress(progress)

                print(f"   批次 {batch_num}/{total_batches}: +{result.get('articles_inserted', 0)} ~{result.get('articles_updated', 0)}")

            except Exception as e:
                print(f"   ❌ 批次 {batch_num} 失败: {e}")
                print(f"   💾 进度已保存，可使用 --resume 继续")
                sys.exit(1)

            # 短暂休眠避免请求过快
            time.sleep(0.1)

    # 上传创作者
    if creators:
        print("\n📤 开始上传创作者...")
        for i in range(0, total_creators, batch_size):
            batch = creators[i:i + batch_size]
            batch_num = i // batch_size + 1
            total_batches = (total_creators + batch_size - 1) // batch_size

            try:
                result = upload_batch(
                    server_url,
                    args.token,
                    articles=[],
                    creators=batch,
                    batch_id=f"creators-{batch_num}",
                )

                # 保存进度
                for item in batch:
                    progress["uploaded_creator_ids"].append(item["user_id"])
                save_progress(progress)

                print(f"   批次 {batch_num}/{total_batches}: +{result.get('creators_inserted', 0)} ~{result.get('creators_updated', 0)}")

            except Exception as e:
                print(f"   ❌ 批次 {batch_num} 失败: {e}")
                print(f"   💾 进度已保存，可使用 --resume 继续")
                sys.exit(1)

            time.sleep(0.1)

    print("\n" + "=" * 40)
    print("✅ 上传完成!")
    print(f"   文章: 新增 {total_inserted}, 更新 {total_updated}")
    print(f"   创作者: {len(creators)} 条已处理")


if __name__ == "__main__":
    main()
