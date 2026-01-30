"""Pydantic schemas for AI sentiment analysis."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


# ========== AI Insight Schemas ==========

class AIInsightBase(BaseModel):
    article_id: str
    stock_symbol: str
    sentiment_score: int
    sentiment_label: str
    summary_text: Optional[str] = None
    key_tags: Optional[str] = None
    core_logic: Optional[str] = None


class AIInsightResponse(AIInsightBase):
    id: int
    model_name: Optional[str] = None
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    processing_time_ms: int
    created_at: datetime

    class Config:
        from_attributes = True


class AIInsightWithArticle(AIInsightResponse):
    """AI insight with article details."""
    article_title: Optional[str] = None
    article_url: Optional[str] = None
    author_name: Optional[str] = None


# ========== User Decision Schemas ==========

class UserDecisionCreate(BaseModel):
    stock_symbol: str
    review_date: str  # YYYY-MM-DD
    action_type: str  # BUY, SELL, HOLD
    rationale: Optional[str] = None
    confidence_level: int = 5
    linked_insight_ids: Optional[List[int]] = None


class UserDecisionResponse(BaseModel):
    id: int
    stock_symbol: str
    review_date: str
    action_type: str
    rationale: Optional[str] = None
    confidence_level: int
    linked_insight_ids: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserDecisionWithStock(UserDecisionResponse):
    """User decision with stock details."""
    stock_name: Optional[str] = None


# ========== AI Usage Schemas ==========

class AIUsageLogResponse(BaseModel):
    id: int
    request_type: str
    model_name: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost: float
    processing_time_ms: int
    success: int
    error_message: Optional[str] = None
    article_id: Optional[str] = None
    batch_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AIUsageStats(BaseModel):
    """Aggregated AI usage statistics."""
    period_days: int
    total_requests: int
    successful_requests: int
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    total_cost_usd: float
    avg_processing_time_ms: float
    by_model: List[dict]


# ========== AI Config Schemas ==========

class AIConfigResponse(BaseModel):
    id: int
    key: str
    value: Optional[str] = None
    description: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class AIConfigUpdate(BaseModel):
    key: str
    value: str
    description: Optional[str] = None


# ========== AI Analysis Request/Response ==========

class AnalyzeArticleRequest(BaseModel):
    """Request to analyze a single article."""
    article_id: str


class AnalyzeBatchRequest(BaseModel):
    """Request to analyze multiple articles."""
    article_ids: Optional[List[str]] = None  # If None, analyze all unprocessed
    limit: int = 10  # Max articles to process


class AnalysisResult(BaseModel):
    """Result of a single article analysis."""
    article_id: str
    success: bool
    insights: List[AIInsightResponse] = []
    usage: dict = {}
    error: Optional[str] = None


class BatchAnalysisResponse(BaseModel):
    """Response for batch analysis."""
    batch_id: str
    total_articles: int
    processed: int
    successful: int
    failed: int
    results: List[AnalysisResult]
    total_usage: dict


# ========== Daily Review Schemas ==========

class DailyReviewStock(BaseModel):
    """Stock item for daily review."""
    symbol: str
    name: str
    latest_price: Optional[float] = None
    price_change_pct: Optional[float] = None
    # AI insights summary
    insight_count: int = 0
    avg_sentiment_score: Optional[float] = None
    sentiment_label: Optional[str] = None
    ai_summary: Optional[str] = None
    key_tags: List[str] = []
    # User's existing decision for today (if any)
    existing_decision: Optional[UserDecisionResponse] = None
    # Related article IDs
    article_ids: List[str] = []


class DailyReviewResponse(BaseModel):
    """Response for daily review page."""
    review_date: str
    stocks: List[DailyReviewStock]
    total_stocks: int


# ========== Enhanced Sentiment Marker ==========

class EnhancedSentimentMarker(BaseModel):
    """Sentiment marker with AI analysis data."""
    date: str
    count: int
    titles: List[str]
    article_ids: List[str]
    is_weekend: bool = False
    # AI-enhanced fields
    avg_sentiment_score: Optional[float] = None
    sentiment_label: Optional[str] = None  # Aggregated: Bullish/Bearish/Neutral
    ai_summaries: List[str] = []
    key_tags: List[str] = []


class EnhancedSentimentMarkersResponse(BaseModel):
    """Enhanced sentiment markers response."""
    symbol: str
    markers: List[EnhancedSentimentMarker]
