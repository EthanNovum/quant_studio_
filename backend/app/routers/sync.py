"""API routes for data sync operations (crawler, tagging, market data)."""

import asyncio
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CrawlerConfig, ZhihuContent
from app.schemas.zhihu import CrawlerConfigResponse, CrawlerConfigUpdate, SyncStatus, ArticleTimeRange, CrawlTimeRangeRequest

router = APIRouter(prefix="/sync")

PROJECT_ROOT = Path(__file__).parent.parent.parent.parent

# Use file-based state to share across Gunicorn workers
SYNC_STATE_FILE = Path(os.environ.get("DATABASE_PATH", "/app/data/alphanote.db")).parent / "sync_state.json"


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
