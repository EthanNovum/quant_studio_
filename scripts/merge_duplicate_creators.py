#!/usr/bin/env python3
"""
合并重复创作者脚本

问题：同一个知乎用户可能有两条记录：
  - 手动添加时用 url_token 作为临时 user_id
  - 爬虫抓取后获取到真实 user_id，被当作新记录插入

解决：用 url_token 作为唯一标识，合并重复记录

用法:
    # 查看重复情况（不执行）
    python scripts/merge_duplicate_creators.py --dry-run

    # 执行合并
    python scripts/merge_duplicate_creators.py --execute
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def get_database_url():
    """获取数据库连接."""
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        return db_url

    # 尝试从 backend 配置读取
    try:
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend"))
        from app.config import settings
        return settings.get_database_url()
    except Exception:
        pass

    return "sqlite:///./data.db"


def find_duplicates(engine):
    """查找 url_token 重复的创作者."""
    from sqlalchemy import text

    # 检查表名（backend 用 zhihu_creators，MediaCrawler 用 zhihu_creator）
    with engine.connect() as conn:
        # 尝试 zhihu_creators 表
        try:
            result = conn.execute(text("""
                SELECT url_token, COUNT(*) as cnt
                FROM zhihu_creators
                GROUP BY url_token
                HAVING COUNT(*) > 1
            """))
            duplicates = list(result.fetchall())
            return duplicates, "zhihu_creators"
        except Exception:
            pass

        # 尝试 zhihu_creator 表
        try:
            result = conn.execute(text("""
                SELECT url_token, COUNT(*) as cnt
                FROM zhihu_creator
                GROUP BY url_token
                HAVING COUNT(*) > 1
            """))
            duplicates = list(result.fetchall())
            return duplicates, "zhihu_creator"
        except Exception:
            pass

    return [], None


def get_duplicate_details(engine, url_token, table_name):
    """获取某个 url_token 的所有记录详情."""
    from sqlalchemy import text

    with engine.connect() as conn:
        result = conn.execute(text(f"""
            SELECT user_id, url_token, user_nickname, fans, article_count, answer_count
            FROM {table_name}
            WHERE url_token = :url_token
            ORDER BY fans DESC, article_count DESC
        """), {"url_token": url_token})
        return list(result.fetchall())


def merge_duplicates(engine, table_name, dry_run=True):
    """合并重复的创作者记录."""
    from sqlalchemy import text

    duplicates, _ = find_duplicates(engine)

    if not duplicates:
        print("✅ 没有发现重复的创作者!")
        return 0

    print(f"\n🔍 发现 {len(duplicates)} 个 url_token 存在重复")
    print("-" * 60)

    total_to_delete = 0

    for url_token, count in duplicates:
        details = get_duplicate_details(engine, url_token, table_name)
        print(f"\n  url_token: {url_token} ({count} 条记录)")

        for i, row in enumerate(details):
            user_id, _, nickname, fans, articles, answers = row
            marker = "✓ 保留" if i == 0 else "✗ 删除"
            print(f"    [{marker}] user_id={user_id[:20]}... nickname={nickname} fans={fans} articles={articles}")

        total_to_delete += count - 1

    print("\n" + "-" * 60)
    print(f"📊 总共需要删除 {total_to_delete} 条重复记录")

    if dry_run:
        print("\n⚠️  DRY RUN 模式 - 不会执行删除操作")
        print("   使用 --execute 参数来实际执行合并")
        return total_to_delete

    # 执行合并
    print("\n🔄 开始合并重复记录...")

    with engine.begin() as conn:
        for url_token, count in duplicates:
            details = get_duplicate_details(engine, url_token, table_name)
            if len(details) < 2:
                continue

            # 保留第一条（粉丝数/文章数最多的），删除其他
            keep_user_id = details[0][0]
            delete_user_ids = [row[0] for row in details[1:]]

            # 更新文章的 author_id 指向保留的记录
            for old_id in delete_user_ids:
                conn.execute(text("""
                    UPDATE zhihu_content
                    SET author_id = :new_id
                    WHERE author_id = :old_id
                """), {"new_id": keep_user_id, "old_id": old_id})

            # 删除重复记录
            for old_id in delete_user_ids:
                conn.execute(text(f"""
                    DELETE FROM {table_name}
                    WHERE user_id = :user_id
                """), {"user_id": old_id})

            print(f"  ✓ 合并 {url_token}: 保留 {keep_user_id[:20]}..., 删除 {len(delete_user_ids)} 条")

    print(f"\n✅ 成功合并 {total_to_delete} 条重复记录")
    return total_to_delete


def main():
    from sqlalchemy import create_engine

    parser = argparse.ArgumentParser(description="合并重复的创作者记录")
    parser.add_argument("--dry-run", action="store_true", default=True, help="只显示重复情况（默认）")
    parser.add_argument("--execute", action="store_true", help="实际执行合并")

    args = parser.parse_args()

    db_url = get_database_url()
    print(f"📦 数据库: {db_url[:50]}...")

    engine = create_engine(db_url)

    dry_run = not args.execute
    duplicates, table_name = find_duplicates(engine)

    if table_name:
        print(f"📋 使用表: {table_name}")
        merge_duplicates(engine, table_name, dry_run=dry_run)
    else:
        print("❌ 未找到创作者表")


if __name__ == "__main__":
    main()
