"""Zhihu content and article-stock reference models."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ZhihuContent(Base):
    """Zhihu content table (articles, answers, videos)."""

    __tablename__ = "zhihu_content"

    content_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    content_type: Mapped[str] = mapped_column(String(20), nullable=False)  # article, answer, zvideo
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content_text: Mapped[str | None] = mapped_column(Text)
    content_url: Mapped[str | None] = mapped_column(String(500))
    created_time: Mapped[int] = mapped_column(Integer, default=0)  # Unix timestamp
    updated_time: Mapped[int] = mapped_column(Integer, default=0)
    voteup_count: Mapped[int] = mapped_column(Integer, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)

    # Author info
    author_id: Mapped[str | None] = mapped_column(String(50))
    author_name: Mapped[str | None] = mapped_column(String(100))
    author_avatar: Mapped[str | None] = mapped_column(String(500))

    # Tagging status
    is_tagged: Mapped[int] = mapped_column(Integer, default=0)  # 0=not tagged, 1=tagged

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ZhihuCreator(Base):
    """Zhihu creator/author table."""

    __tablename__ = "zhihu_creators"

    user_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    url_token: Mapped[str] = mapped_column(String(100), nullable=False)
    user_nickname: Mapped[str] = mapped_column(String(100), nullable=False)
    user_avatar: Mapped[str | None] = mapped_column(String(500))
    user_link: Mapped[str | None] = mapped_column(String(500))
    gender: Mapped[str | None] = mapped_column(String(10))
    fans: Mapped[int] = mapped_column(Integer, default=0)
    follows: Mapped[int] = mapped_column(Integer, default=0)
    answer_count: Mapped[int] = mapped_column(Integer, default=0)
    article_count: Mapped[int] = mapped_column(Integer, default=0)
    voteup_count: Mapped[int] = mapped_column(Integer, default=0)

    # Crawl config
    is_active: Mapped[int] = mapped_column(Integer, default=1)  # 1=active, 0=disabled
    last_crawled_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ArticleStockRef(Base):
    """Article-Stock reference table (created by tag_articles.py)."""

    __tablename__ = "article_stock_ref"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    article_id: Mapped[str] = mapped_column(String(50), ForeignKey("zhihu_content.content_id"), nullable=False)
    stock_symbol: Mapped[str] = mapped_column(String(10), ForeignKey("stock_basic.symbol"), nullable=False)
    display_date: Mapped[str] = mapped_column(String(10), nullable=False)  # Trading day (YYYY-MM-DD)
    original_date: Mapped[str] = mapped_column(String(10), nullable=False)  # Original publish date
    match_keyword: Mapped[str | None] = mapped_column(String(100))  # Matched keyword (e.g., "宁王")
    match_score: Mapped[int] = mapped_column(Integer, default=0)  # Match weight score

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_ref_article", "article_id"),
        Index("idx_ref_stock", "stock_symbol"),
        Index("idx_ref_display_date", "display_date"),
        Index("idx_ref_unique", "article_id", "stock_symbol", unique=True),  # Prevent duplicates
    )


class CrawlerConfig(Base):
    """Crawler configuration table."""

    __tablename__ = "crawler_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    value: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
