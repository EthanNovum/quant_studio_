"""Stock schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_validator


class StockBase(BaseModel):
    """Base stock schema."""

    symbol: str
    name: str
    asset_type: str = "stock"
    industry: str | None = None
    roe: float | str | None = None


class StockCreate(StockBase):
    """Stock creation schema."""

    controller: str | None = None
    description: str | None = None
    listing_date: str | None = None


class StockResponse(StockBase):
    """Stock response schema."""

    controller: str | None = None
    description: str | None = None
    listing_date: str | None = None
    is_blacklisted: int = 0
    consecutive_loss_years: int = 0

    @field_validator("listing_date", mode="before")
    @classmethod
    def convert_listing_date(cls, v: Any) -> str | None:
        if v is None:
            return None
        return str(v)

    class Config:
        from_attributes = True


class LatestQuote(BaseModel):
    """Latest quote info."""

    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float | None = None
    turnover: float | None = None
    turnover_rate: float | None = None
    pe_ttm: float | None = None
    pb: float | None = None
    market_cap: float | None = None


class StockDetail(StockResponse):
    """Stock detail with latest quote and danger reasons."""

    latest_quote: LatestQuote | None = None
    danger_reasons: list[str] = []


class StockListResponse(BaseModel):
    """Paginated stock list response."""

    stocks: list[StockResponse]
    total: int
    page: int
    limit: int
