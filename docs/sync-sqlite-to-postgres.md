# SQLite 到 PostgreSQL 数据同步指南

本文档说明如何将本地 SQLite 数据库中的知乎文章数据同步到服务器的 PostgreSQL 数据库。

## 前提条件

- 本地已运行爬虫，数据存储在 `MediaCrawler/database/sqlite_tables.db`
- 服务器已配置 PostgreSQL 数据库
- 已安装 Python 3.10+

## 方案概述

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  本地运行爬虫    │ --> │  导出为 JSON    │ --> │  上传到服务器    │
│  (SQLite)       │     │                 │     │  导入 PostgreSQL │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 步骤 1: 本地导出数据

在本地项目根目录运行：

```bash
python scripts/sync_to_server.py export
```

这会生成 `data/zhihu_export.json` 文件，包含：
- `zhihu_content`: 文章数据
- `zhihu_creator`: 创作者数据

## 步骤 2: 上传到服务器

```bash
scp data/zhihu_export.json user@your-server:/path/to/project/data/
```

## 步骤 3: 服务器导入数据

SSH 登录服务器后运行：

```bash
cd /path/to/project
python scripts/sync_to_server.py import
```

## 一键同步脚本

为方便使用，可以运行一键同步：

```bash
# 本地执行（导出 + 上传 + 远程导入）
./scripts/sync_to_server.sh
```

---

## 字段映射说明

### zhihu_content 表

| SQLite (MediaCrawler) | PostgreSQL (Backend) | 说明 |
|----------------------|---------------------|------|
| content_id | content_id (PK) | 文章唯一ID |
| content_type | content_type | article/answer/zvideo |
| title | title | 标题 |
| content_text | content_text | 正文内容 |
| content_url | content_url | 原文链接 |
| created_time | created_time | 发布时间戳 |
| updated_time | updated_time | 更新时间戳 |
| voteup_count | voteup_count | 点赞数 |
| comment_count | comment_count | 评论数 |
| user_id | author_id | 作者ID |
| user_nickname | author_name | 作者昵称 |
| user_avatar | author_avatar | 作者头像 |

### zhihu_creator 表

| SQLite (MediaCrawler) | PostgreSQL (Backend) | 说明 |
|----------------------|---------------------|------|
| user_id | user_id (PK) | 用户唯一ID |
| url_token | url_token | URL标识 |
| user_nickname | user_nickname | 昵称 |
| user_avatar | user_avatar | 头像 |
| user_link | user_link | 主页链接 |
| gender | gender | 性别 |
| fans | fans | 粉丝数 |
| follows | follows | 关注数 |
| anwser_count | answer_count | 回答数 |
| article_count | article_count | 文章数 |
| get_voteup_count | voteup_count | 获赞数 |

---

## 注意事项

1. **去重机制**: 导入时使用 `ON CONFLICT` 策略，重复的 `content_id` 会更新而非插入
2. **增量同步**: 只同步新数据，已存在的数据会被更新
3. **备份建议**: 首次同步前建议备份 PostgreSQL 数据库
4. **时区问题**: `created_time` 为 Unix 时间戳，无时区问题

## 故障排除

### 导入失败
```bash
# 检查 PostgreSQL 连接
psql $DATABASE_URL -c "SELECT 1"

# 查看导入日志
cat data/sync.log
```

### 数据不一致
```bash
# 对比本地和服务器文章数量
python scripts/sync_to_server.py stats
```
