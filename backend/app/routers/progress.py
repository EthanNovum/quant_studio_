"""Progress endpoint."""

import json
from datetime import datetime

from fastapi import APIRouter

from app.config import settings
from app.schemas.progress import ProgressResponse

router = APIRouter()


@router.get("/progress", response_model=ProgressResponse)
def get_progress():
    """Get data update progress."""
    if not settings.progress_path.exists():
        return ProgressResponse(is_running=False)

    try:
        with open(settings.progress_path) as f:
            data = json.load(f)

        started_at = None
        updated_at = None
        if data.get("started_at"):
            started_at = datetime.fromisoformat(data["started_at"])
        if data.get("updated_at"):
            updated_at = datetime.fromisoformat(data["updated_at"])

        return ProgressResponse(
            is_running=data.get("is_running", False),
            mode=data.get("mode", ""),
            current=data.get("current", 0),
            total=data.get("total", 0),
            current_symbol=data.get("current_symbol", ""),
            started_at=started_at,
            updated_at=updated_at,
        )
    except (json.JSONDecodeError, KeyError):
        return ProgressResponse(is_running=False)
