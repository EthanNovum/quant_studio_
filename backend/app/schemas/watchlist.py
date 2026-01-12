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
