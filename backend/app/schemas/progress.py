"""Progress schemas."""

from datetime import datetime

from pydantic import BaseModel


class ProgressResponse(BaseModel):
    """Progress response schema."""

    is_running: bool
    mode: str = ""
    current: int = 0
    total: int = 0
    current_symbol: str = ""
    started_at: datetime | None = None
    updated_at: datetime | None = None
