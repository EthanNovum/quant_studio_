#!/usr/bin/env python3
"""
去重脚本：清理 zhihu_content 表中重复的 content_id 记录。
保留每组重复记录中 id 最小的那条（即最早入库的）。

使用方法:
    # 只查看重复情况（不删除）
    python scripts/dedupe_articles.py --dry-run

    # 执行删除
    python scripts/dedupe_articles.py
"""

import argparse
import os
import sys

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text


def get_database_url():
    """获取数据库连接 URL."""
    # 尝试从环境变量获取
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return db_url

    # 尝试从 .env 文件读取
    env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", ".env")
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                if line.startswith("DATABASE_URL="):
                    return line.strip().split("=", 1)[1].strip('"').strip("'")

    # 默认 SQLite
    return "sqlite:///./data.db"


def find_duplicates(engine):
    """查找重复的 content_id."""
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT content_id, COUNT(*) as cnt
            FROM zhihu_content
            GROUP BY content_id
            HAVING COUNT(*) > 1
            ORDER BY cnt DESC
        """))
        return list(result.fetchall())


def get_duplicate_details(engine, content_id):
    """获取某个 content_id 的所有重复记录详情."""
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id, content_id, title, author_name, created_time
            FROM zhihu_content
            WHERE content_id = :content_id
            ORDER BY id
        """), {"content_id": content_id})
        return list(result.fetchall())


def delete_duplicates(engine, dry_run=True):
    """删除重复记录，保留每组中 id 最小的."""
    duplicates = find_duplicates(engine)

    if not duplicates:
        print("✅ 没有发现重复记录！")
        return 0

    print(f"\n🔍 发现 {len(duplicates)} 个 content_id 存在重复")
    print("-" * 60)

    total_to_delete = 0
    for content_id, count in duplicates[:10]:  # 只显示前10个
        print(f"  content_id: {content_id} - 重复 {count} 次")
        total_to_delete += count - 1  # 保留1条

    if len(duplicates) > 10:
        # 计算剩余的
        remaining = sum(cnt - 1 for _, cnt in duplicates[10:])
        total_to_delete += remaining
        print(f"  ... 还有 {len(duplicates) - 10} 个重复的 content_id")

    print("-" * 60)
    print(f"📊 总共需要删除 {total_to_delete} 条重复记录")

    if dry_run:
        print("\n⚠️  DRY RUN 模式 - 不会执行删除操作")
        print("   使用 --execute 参数来实际执行删除")
        return total_to_delete

    # 执行删除
    print("\n🗑️  开始删除重复记录...")

    with engine.begin() as conn:
        # 使用子查询删除，保留每组中 id 最小的记录
        # PostgreSQL 语法
        db_url = str(engine.url)
        if "postgresql" in db_url:
            result = conn.execute(text("""
                DELETE FROM zhihu_content
                WHERE id NOT IN (
                    SELECT MIN(id)
                    FROM zhihu_content
                    GROUP BY content_id
                )
            """))
        else:
            # SQLite 语法
            result = conn.execute(text("""
                DELETE FROM zhihu_content
                WHERE id NOT IN (
                    SELECT MIN(id)
                    FROM zhihu_content
                    GROUP BY content_id
                )
            """))

        deleted = result.rowcount
        print(f"✅ 成功删除 {deleted} 条重复记录")
        return deleted


def main():
    parser = argparse.ArgumentParser(description="清理 zhihu_content 表中的重复记录")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="只显示重复情况，不执行删除（默认）"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="实际执行删除操作"
    )
    parser.add_argument(
        "--show-details",
        type=str,
        help="显示指定 content_id 的重复记录详情"
    )

    args = parser.parse_args()

    db_url = get_database_url()
    print(f"📦 数据库: {db_url[:50]}...")

    engine = create_engine(db_url)

    if args.show_details:
        details = get_duplicate_details(engine, args.show_details)
        if details:
            print(f"\n content_id={args.show_details} 的记录:")
            for row in details:
                print(f"  id={row[0]}, title={row[2][:30] if row[2] else 'N/A'}..., author={row[3]}")
        else:
            print(f"未找到 content_id={args.show_details}")
        return

    dry_run = not args.execute
    delete_duplicates(engine, dry_run=dry_run)


if __name__ == "__main__":
    main()
