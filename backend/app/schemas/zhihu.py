"""Pydantic schemas for Zhihu/Sentiment related endpoints."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


# ========== Stock Alias Schemas ==========

class StockAliasBase(BaseModel):
    symbol: str
    alias: str


class StockAliasCreate(StockAliasBase):
    pass


class StockAliasResponse(StockAliasBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StockWithAliases(BaseModel):
    symbol: str
    name: str
    aliases: List[str]


# ========== Zhihu Content Schemas ==========

class ZhihuContentResponse(BaseModel):
    content_id: str
    content_type: str
    title: str
    content_text: Optional[str] = None
    content_url: Optional[str] = None
    created_time: int
    voteup_count: int
    comment_count: int
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    is_tagged: int
    # Joined fields
    related_stocks: Optional[List[str]] = None

    class Config:
        from_attributes = True


class ZhihuContentListResponse(BaseModel):
    items: List[ZhihuContentResponse]
    total: int
    page: int
    page_size: int


# ========== Zhihu Creator Schemas ==========

class ZhihuCreatorBase(BaseModel):
    url_token: str
    user_nickname: str
    user_link: Optional[str] = None


class ZhihuCreatorCreate(BaseModel):
    user_link: str  # e.g., https://www.zhihu.com/people/xxx


class ZhihuCreatorResponse(BaseModel):
    user_id: str
    url_token: str
    user_nickname: str
    user_avatar: Optional[str] = None
    user_link: Optional[str] = None
    fans: int
    follows: int
    answer_count: int
    article_count: int
    voteup_count: int
    is_active: int
    last_crawled_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ========== Article Stock Reference Schemas ==========

class ArticleStockRefResponse(BaseModel):
    id: int
    article_id: str
    stock_symbol: str
    display_date: str
    original_date: str
    match_keyword: Optional[str] = None
    match_score: int

    class Config:
        from_attributes = True


# ========== Sentiment Marker for K-Line Chart ==========

class SentimentMarker(BaseModel):
    """Sentiment marker for K-line chart overlay."""
    date: str  # display_date (trading day)
    count: int  # number of articles on this day
    titles: List[str]  # article titles
    article_ids: List[str]  # for linking to article detail
    is_weekend: bool = False  # True if any article was published on weekend


class SentimentMarkersResponse(BaseModel):
    symbol: str
    markers: List[SentimentMarker]


# ========== Crawler Config Schemas ==========

class CrawlerConfigResponse(BaseModel):
    key: str
    value: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class CrawlerConfigUpdate(BaseModel):
    key: str
    value: str


# ========== Sync Status ==========

class SyncStatus(BaseModel):
    is_running: bool
    current_task: Optional[str] = None
    progress: Optional[int] = None
    last_sync_at: Optional[datetime] = None
    log_output: Optional[str] = None


# ========== Article Time Range ==========

class ArticleTimeRange(BaseModel):
    """Time range of articles in the database."""
    oldest_time: Optional[int] = None  # Unix timestamp of oldest article
    newest_time: Optional[int] = None  # Unix timestamp of newest article
    oldest_date: Optional[str] = None  # Formatted date string
    newest_date: Optional[str] = None  # Formatted date string
    total_count: int = 0


class CrawlTimeRangeRequest(BaseModel):
    """Request body for crawl with time range."""
    start_date: Optional[str] = None  # YYYY-MM-DD format
    end_date: Optional[str] = None  # YYYY-MM-DD format
    creator_ids: Optional[List[str]] = None  # List of user_ids to crawl (None = all active)


# ========== Creator Detail Schemas ==========

class CreatorArticleTimelineItem(BaseModel):
    """Article count per date for timeline chart."""
    date: str  # YYYY-MM-DD
    count: int
    article_ids: List[str]
    titles: List[str]


class ZhihuCreatorDetailResponse(ZhihuCreatorResponse):
    """Extended creator response with timeline data."""
    timeline: List[CreatorArticleTimelineItem]
    total_articles_in_db: int


class BatchToggleRequest(BaseModel):
    """Request body for batch toggle creators."""
    action: str  # 'follow_all' or 'unfollow_all'
