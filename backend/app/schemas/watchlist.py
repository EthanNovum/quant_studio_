"""Watchlist schemas."""

from datetime import datetime

from pydantic import BaseModel


class WatchlistItemResponse(BaseModel):
    """Watchlist item response."""

    id: int
    symbol: str
    sort_order: int
    added_at: datetime
    stock_name: str | None = None
    asset_type: str | None = None  # stock, etf, lof

    # Financial indicators
    latest_price: float | None = None
    price_change_pct: float | None = None  # Daily change percentage
    dividend_yield: float | None = None
    pe_ttm: float | None = None
    pb: float | None = None
    market_cap: float | None = None

    # Sentiment stats
    mention_count: int = 0
    last_mention_date: str | None = None

    class Config:
        from_attributes = True


class WatchlistGroupCreate(BaseModel):
    """Watchlist group creation schema."""

    name: str


class WatchlistGroupUpdate(BaseModel):
    """Watchlist group update schema."""

    name: str | None = None
    sort_order: int | None = None


class WatchlistGroupResponse(BaseModel):
    """Watchlist group response."""

    id: int
    name: str
    sort_order: int
    items: list[WatchlistItemResponse] = []

    class Config:
        from_attributes = True


class WatchlistGroupsResponse(BaseModel):
    """Watchlist groups list response."""

    groups: list[WatchlistGroupResponse]


class WatchlistItemCreate(BaseModel):
    """Watchlist item creation schema."""

    group_id: int
    symbol: str


class ReorderItem(BaseModel):
    """Single item reorder info."""

    id: int
    group_id: int
    sort_order: int


class WatchlistReorderRequest(BaseModel):
    """Watchlist reorder request."""

    items: list[ReorderItem]
