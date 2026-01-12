"""Screener schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.stock import StockResponse


class FilterCriteria(BaseModel):
    """Single filter criteria."""

    field: str  # roe, pe_ttm, market_cap, industry, etc.
    operator: str  # >, <, =, >=, <=, between, in
    value: Any  # number, string, list, or [min, max] for between


class ScreenerCreate(BaseModel):
    """Screener creation schema."""

    name: str
    criteria_json: str  # JSON string of FilterCriteria list


class ScreenerUpdate(BaseModel):
    """Screener update schema."""

    name: str | None = None
    criteria_json: str | None = None


class ScreenerResponse(BaseModel):
    """Screener response schema."""

    id: int
    name: str
    criteria_json: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScreenersResponse(BaseModel):
    """Screeners list response."""

    screeners: list[ScreenerResponse]


class ScreenerExecuteRequest(BaseModel):
    """Screener execution request."""

    filters: list[FilterCriteria]
    exclude_negative: bool = False
    page: int = 1
    limit: int = 50


class ScreenerExecuteResponse(BaseModel):
    """Screener execution response."""

    results: list[StockResponse]
    total: int
