"""AI insight and user decision models for sentiment analysis."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, Float
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import ARRAY

from app.database import Base


class AIInsight(Base):
    """AI-generated insights from article analysis."""

    __tablename__ = "ai_insights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    article_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("zhihu_content.content_id"), nullable=False
    )
    stock_symbol: Mapped[str] = mapped_column(
        String(10), ForeignKey("stock_basic.symbol"), nullable=False
    )

    # Sentiment analysis results
    sentiment_score: Mapped[int] = mapped_column(Integer, default=5)  # 1-10 scale
    sentiment_label: Mapped[str] = mapped_column(
        String(20), default="Neutral"
    )  # Bullish, Bearish, Neutral
    summary_text: Mapped[str | None] = mapped_column(Text)  # AI-generated summary
    key_tags: Mapped[str | None] = mapped_column(Text)  # JSON array of tags like ["产能扩张", "涨价"]
    core_logic: Mapped[str | None] = mapped_column(Text)  # Core investment logic

    # AI processing metadata
    model_name: Mapped[str | None] = mapped_column(String(50))  # e.g., "gpt-4", "deepseek-chat"
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    processing_time_ms: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_ai_insight_article", "article_id"),
        Index("idx_ai_insight_stock", "stock_symbol"),
        Index("idx_ai_insight_sentiment", "sentiment_label"),
        Index("idx_ai_insight_unique", "article_id", "stock_symbol", unique=True),
    )


class UserDecision(Base):
    """User trading decisions from daily review."""

    __tablename__ = "user_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    stock_symbol: Mapped[str] = mapped_column(
        String(10), ForeignKey("stock_basic.symbol"), nullable=False
    )
    review_date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD

    # Decision details
    action_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # BUY, SELL, HOLD
    rationale: Mapped[str | None] = mapped_column(Text)  # User's review notes (Markdown)
    confidence_level: Mapped[int] = mapped_column(Integer, default=5)  # 1-10 scale

    # Linked AI insights that influenced this decision
    linked_insight_ids: Mapped[str | None] = mapped_column(Text)  # JSON array of insight IDs

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        Index("idx_decision_stock", "stock_symbol"),
        Index("idx_decision_date", "review_date"),
        Index("idx_decision_unique", "stock_symbol", "review_date", unique=True),
    )


class AIUsageLog(Base):
    """Track AI API usage for cost monitoring and visibility."""

    __tablename__ = "ai_usage_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Request details
    request_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # sentiment_analysis, summarization, etc.
    model_name: Mapped[str] = mapped_column(String(50), nullable=False)

    # Token usage
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)

    # Cost estimation (in USD)
    estimated_cost: Mapped[float] = mapped_column(Float, default=0.0)

    # The actual prompt sent (for debugging/optimization)
    prompt_text: Mapped[str | None] = mapped_column(Text)
    response_text: Mapped[str | None] = mapped_column(Text)

    # Processing info
    processing_time_ms: Mapped[int] = mapped_column(Integer, default=0)
    success: Mapped[int] = mapped_column(Integer, default=1)  # 1=success, 0=failed
    error_message: Mapped[str | None] = mapped_column(Text)

    # Related entities
    article_id: Mapped[str | None] = mapped_column(String(50))
    batch_id: Mapped[str | None] = mapped_column(String(50))  # For batch processing

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_usage_type", "request_type"),
        Index("idx_usage_model", "model_name"),
        Index("idx_usage_date", "created_at"),
        Index("idx_usage_batch", "batch_id"),
    )


class AIConfig(Base):
    """AI configuration settings (prompts, model selection, etc.)."""

    __tablename__ = "ai_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    value: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
