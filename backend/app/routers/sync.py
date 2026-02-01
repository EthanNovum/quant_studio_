"""API routes for data sync operations (crawler, tagging, market data)."""

import asyncio
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CrawlerConfig, ZhihuContent, ZhihuCreator
from app.schemas.zhihu import CrawlerConfigResponse, CrawlerConfigUpdate, SyncStatus, ArticleTimeRange, CrawlTimeRangeRequest
from app.config import settings

router = APIRouter(prefix="/sync")

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent

# Use file-based state to share across Gunicorn workers
# Default to local path when DATABASE_PATH is not set (local development)
_default_db_path = PROJECT_ROOT / "backend" / "data" / "alphanote.db"
SYNC_STATE_FILE = Path(os.environ.get("DATABASE_PATH", str(_default_db_path))).parent / "sync_state.json"


def _read_sync_state() -> dict:
    """Read sync state from file."""
    default_state = {
        "is_running": False,
        "current_task": None,
        "progress": None,
        "last_sync_at": None,
        "log_output": "",
    }
    try:
        if SYNC_STATE_FILE.exists():
            with open(SYNC_STATE_FILE, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return default_state


def _write_sync_state(state: dict):
    """Write sync state to file."""
    try:
        with open(SYNC_STATE_FILE, "w") as f:
            json.dump(state, f)
    except Exception as e:
        print(f"[ERROR] Failed to write sync state: {e}")


def _update_sync_state(**kwargs):
    """Update specific fields in sync state."""
    state = _read_sync_state()
    state.update(kwargs)
    _write_sync_state(state)


def run_script(script_name: str, args: list = None):
    """Run a Python script and capture output."""
    script_path = PROJECT_ROOT / "scripts" / script_name
    cmd = [sys.executable, str(script_path)]
    if args:
        cmd.extend(args)

    try:
        _update_sync_state(log_output="")
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=str(PROJECT_ROOT),
        )

        # Stream output
        log_buffer = ""
        for line in process.stdout:
            log_buffer += line
            print(line, end="")
            # Update file periodically (every 10 lines or so)
            if log_buffer.count('\n') >= 5:
                _update_sync_state(log_output=log_buffer)

        # Final update
        _update_sync_state(log_output=log_buffer)

        process.wait()
        return process.returncode == 0

    except Exception as e:
        state = _read_sync_state()
        _update_sync_state(log_output=state.get("log_output", "") + f"\n[ERROR] {str(e)}")
        return False


async def run_sync_task(task_type: str, extra_args: list = None):
    """Background task for running sync operations."""
    _update_sync_state(is_running=True, current_task=task_type, progress=0)

    try:
        if task_type == "crawl_zhihu":
            _update_sync_state(log_output="[INFO] Starting Zhihu crawler...\n")
            success = run_script("crawler_zhihu.py", extra_args)

        elif task_type == "tag_articles":
            _update_sync_state(log_output="[INFO] Starting article tagging...\n")
            success = run_script("tag_articles.py")

        elif task_type == "tag_articles_all":
            _update_sync_state(log_output="[INFO] Re-tagging all articles...\n")
            success = run_script("tag_articles.py", ["--all"])

        elif task_type == "update_market":
            _update_sync_state(log_output="[INFO] Starting market data update...\n")
            success = run_script("update_market_data.py") if (PROJECT_ROOT / "scripts" / "update_market_data.py").exists() else False

        else:
            _update_sync_state(log_output=f"[ERROR] Unknown task type: {task_type}\n")
            success = False

        state = _read_sync_state()
        log_output = state.get("log_output", "")

        if success:
            log_output += "\n[INFO] Task completed successfully!"
        else:
            log_output += "\n[WARN] Task completed with errors."

        _update_sync_state(
            progress=100,
            last_sync_at=datetime.now().isoformat(),
            log_output=log_output
        )

    except Exception as e:
        state = _read_sync_state()
        _update_sync_state(log_output=state.get("log_output", "") + f"\n[ERROR] Task failed: {str(e)}")

    finally:
        _update_sync_state(is_running=False, current_task=None)


@router.get("/status", response_model=SyncStatus)
def get_sync_status():
    """Get current sync status."""
    state = _read_sync_state()
    last_sync_at = None
    if state.get("last_sync_at"):
        try:
            last_sync_at = datetime.fromisoformat(state["last_sync_at"])
        except Exception:
            pass
    return SyncStatus(
        is_running=state.get("is_running", False),
        current_task=state.get("current_task"),
        progress=state.get("progress"),
        last_sync_at=last_sync_at,
        log_output=state.get("log_output", ""),
    )


@router.get("/article-time-range", response_model=ArticleTimeRange)
def get_article_time_range(db: Session = Depends(get_db)):
    """Get the time range of articles in the database."""
    from sqlalchemy import func

    result = db.query(
        func.min(ZhihuContent.created_time),
        func.max(ZhihuContent.created_time),
        func.count(ZhihuContent.content_id)
    ).filter(ZhihuContent.created_time > 0).first()

    oldest_time = result[0]
    newest_time = result[1]
    total_count = result[2] or 0

    oldest_date = None
    newest_date = None

    if oldest_time:
        oldest_date = datetime.fromtimestamp(oldest_time).strftime("%Y-%m-%d")
    if newest_time:
        newest_date = datetime.fromtimestamp(newest_time).strftime("%Y-%m-%d")

    return ArticleTimeRange(
        oldest_time=oldest_time,
        newest_time=newest_time,
        oldest_date=oldest_date,
        newest_date=newest_date,
        total_count=total_count,
    )


@router.post("/crawl")
async def start_crawl(
    background_tasks: BackgroundTasks,
    time_range: Optional[CrawlTimeRangeRequest] = None,
):
    """Start Zhihu crawler in background with optional time range filter."""
    state = _read_sync_state()
    if state.get("is_running"):
        raise HTTPException(status_code=400, detail="A sync task is already running")

    # Build arguments for crawler script
    args = []
    if time_range:
        if time_range.start_date:
            args.extend(["--start-date", time_range.start_date])
        if time_range.end_date:
            args.extend(["--end-date", time_range.end_date])
        if time_range.creator_ids and len(time_range.creator_ids) > 0:
            args.extend(["--creator-ids", ",".join(time_range.creator_ids)])

    background_tasks.add_task(run_sync_task, "crawl_zhihu", args)
    return {"message": "Crawler started", "task": "crawl_zhihu"}


@router.post("/tag")
async def start_tagging(
    background_tasks: BackgroundTasks,
    retag_all: bool = False,
):
    """Start article tagging in background."""
    state = _read_sync_state()
    if state.get("is_running"):
        raise HTTPException(status_code=400, detail="A sync task is already running")

    task_type = "tag_articles_all" if retag_all else "tag_articles"
    background_tasks.add_task(run_sync_task, task_type)
    return {"message": "Tagging started", "task": task_type}


@router.post("/market")
async def start_market_update(background_tasks: BackgroundTasks):
    """Start market data update in background."""
    state = _read_sync_state()
    if state.get("is_running"):
        raise HTTPException(status_code=400, detail="A sync task is already running")

    background_tasks.add_task(run_sync_task, "update_market")
    return {"message": "Market update started", "task": "update_market"}


@router.post("/stop")
def stop_sync():
    """Stop current sync task (best effort)."""
    state = _read_sync_state()
    log_output = state.get("log_output", "") + "\n[WARN] Stop requested by user"
    _update_sync_state(is_running=False, current_task=None, log_output=log_output)
    return {"message": "Stop requested"}


# ========== Crawler Config Endpoints ==========

@router.get("/config", response_model=list[CrawlerConfigResponse])
def get_all_config(db: Session = Depends(get_db)):
    """Get all crawler config entries."""
    configs = db.query(CrawlerConfig).all()
    return configs


@router.get("/config/{key}")
def get_config(key: str, db: Session = Depends(get_db)):
    """Get a specific config value."""
    config = db.query(CrawlerConfig).filter(CrawlerConfig.key == key).first()
    if not config:
        return {"key": key, "value": None}
    return {"key": config.key, "value": config.value}


@router.put("/config")
def set_config(config_data: CrawlerConfigUpdate, db: Session = Depends(get_db)):
    """Set a config value."""
    config = db.query(CrawlerConfig).filter(CrawlerConfig.key == config_data.key).first()

    if config:
        config.value = config_data.value
    else:
        config = CrawlerConfig(key=config_data.key, value=config_data.value)
        db.add(config)

    db.commit()
    return {"key": config_data.key, "value": config_data.value}


@router.delete("/config/{key}")
def delete_config(key: str, db: Session = Depends(get_db)):
    """Delete a config entry."""
    config = db.query(CrawlerConfig).filter(CrawlerConfig.key == key).first()
    if config:
        db.delete(config)
        db.commit()
    return {"message": "Config deleted"}


@router.post("/test-cookies")
def test_cookies(db: Session = Depends(get_db)):
    """Test if stored Zhihu cookies are valid."""
    import httpx

    config = db.query(CrawlerConfig).filter(CrawlerConfig.key == "zhihu_cookies").first()
    if not config or not config.value:
        return {"valid": False, "message": "未配置 Cookie"}

    try:
        # Test by fetching Zhihu user info API
        headers = {
            "Cookie": config.value,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
        response = httpx.get(
            "https://www.zhihu.com/api/v4/me",
            headers=headers,
            timeout=10.0,
        )

        if response.status_code == 200:
            data = response.json()
            name = data.get("name", "未知用户")
            return {"valid": True, "message": f"Cookie 有效，当前用户: {name}"}
        elif response.status_code == 401:
            return {"valid": False, "message": "Cookie 已过期或无效"}
        else:
            return {"valid": False, "message": f"验证失败，状态码: {response.status_code}"}

    except httpx.TimeoutException:
        return {"valid": False, "message": "请求超时，请检查网络连接"}
    except Exception as e:
        return {"valid": False, "message": f"验证出错: {str(e)}"}


# ========== Remote Data Upload API ==========

class ArticleUploadItem(BaseModel):
    """单篇文章上传数据."""
    content_id: str
    content_type: str
    title: str
    content_text: Optional[str] = None
    content_url: Optional[str] = None
    created_time: int = 0
    updated_time: int = 0
    voteup_count: int = 0
    comment_count: int = 0
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None


class CreatorUploadItem(BaseModel):
    """单个创作者上传数据."""
    user_id: str
    url_token: str
    user_nickname: str
    user_avatar: Optional[str] = None
    user_link: Optional[str] = None
    gender: Optional[str] = None
    fans: int = 0
    follows: int = 0
    answer_count: int = 0
    article_count: int = 0
    voteup_count: int = 0


class UploadBatchRequest(BaseModel):
    """批量上传请求."""
    articles: List[ArticleUploadItem] = []
    creators: List[CreatorUploadItem] = []
    batch_id: Optional[str] = None  # 用于断点续传


class UploadResponse(BaseModel):
    """上传响应."""
    success: bool
    articles_inserted: int = 0
    articles_updated: int = 0
    creators_inserted: int = 0
    creators_updated: int = 0
    batch_id: Optional[str] = None
    message: str = ""


def verify_upload_token(x_upload_token: Optional[str] = Header(None)):
    """验证上传令牌 (使用 AUTH_PASSWORD)."""
    if not x_upload_token:
        raise HTTPException(status_code=401, detail="Missing X-Upload-Token header")
    if x_upload_token != settings.auth_password:
        raise HTTPException(status_code=403, detail="Invalid upload token")
    return True


@router.post("/upload", response_model=UploadResponse)
def upload_data(
    data: UploadBatchRequest,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_upload_token),
):
    """
    批量上传文章和创作者数据.

    认证: 需要在 Header 中传入 X-Upload-Token (值为服务器的 AUTH_PASSWORD)

    去重: 使用 UPSERT，重复的 content_id/user_id 会更新而非报错
    """
    articles_inserted = 0
    articles_updated = 0
    creators_inserted = 0
    creators_updated = 0

    try:
        # 导入文章
        for item in data.articles:
            existing = db.query(ZhihuContent).filter(
                ZhihuContent.content_id == item.content_id
            ).first()

            if existing:
                # 更新
                existing.title = item.title
                existing.content_text = item.content_text
                existing.content_url = item.content_url
                existing.voteup_count = item.voteup_count
                existing.comment_count = item.comment_count
                existing.updated_time = item.updated_time
                articles_updated += 1
            else:
                # 插入
                new_article = ZhihuContent(
                    content_id=item.content_id,
                    content_type=item.content_type,
                    title=item.title,
                    content_text=item.content_text,
                    content_url=item.content_url,
                    created_time=item.created_time,
                    updated_time=item.updated_time,
                    voteup_count=item.voteup_count,
                    comment_count=item.comment_count,
                    author_id=item.author_id,
                    author_name=item.author_name,
                    author_avatar=item.author_avatar,
                    is_tagged=0,
                )
                db.add(new_article)
                articles_inserted += 1

        # 导入创作者 (使用 url_token 去重)
        for item in data.creators:
            # 优先用 url_token 查找，避免同一用户因 user_id 不同而重复
            existing = db.query(ZhihuCreator).filter(
                ZhihuCreator.url_token == item.url_token
            ).first()

            if existing:
                # 更新（同时更新 user_id，因为爬虫获取的是真实 ID）
                if item.user_id and item.user_id != item.url_token:
                    existing.user_id = item.user_id  # 更新为真实 user_id
                existing.user_nickname = item.user_nickname
                existing.user_avatar = item.user_avatar
                existing.user_link = item.user_link
                existing.fans = item.fans
                existing.follows = item.follows
                existing.answer_count = item.answer_count
                existing.article_count = item.article_count
                existing.voteup_count = item.voteup_count
                creators_updated += 1
            else:
                # 插入
                new_creator = ZhihuCreator(
                    user_id=item.user_id,
                    url_token=item.url_token,
                    user_nickname=item.user_nickname,
                    user_avatar=item.user_avatar,
                    user_link=item.user_link,
                    gender=item.gender,
                    fans=item.fans,
                    follows=item.follows,
                    answer_count=item.answer_count,
                    article_count=item.article_count,
                    voteup_count=item.voteup_count,
                    is_active=1,
                )
                db.add(new_creator)
                creators_inserted += 1

        db.commit()

        return UploadResponse(
            success=True,
            articles_inserted=articles_inserted,
            articles_updated=articles_updated,
            creators_inserted=creators_inserted,
            creators_updated=creators_updated,
            batch_id=data.batch_id,
            message=f"上传成功: 文章 +{articles_inserted}/~{articles_updated}, 创作者 +{creators_inserted}/~{creators_updated}",
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.get("/upload/status")
def get_upload_status(db: Session = Depends(get_db)):
    """获取服务器当前数据统计，用于断点续传."""
    from sqlalchemy import func

    article_count = db.query(func.count(ZhihuContent.content_id)).scalar() or 0
    creator_count = db.query(func.count(ZhihuCreator.user_id)).scalar() or 0

    # 获取已有的 content_id 列表 (用于客户端判断跳过)
    existing_ids = db.query(ZhihuContent.content_id).all()
    existing_content_ids = [row[0] for row in existing_ids]

    return {
        "article_count": article_count,
        "creator_count": creator_count,
        "existing_content_ids": existing_content_ids,
    }
