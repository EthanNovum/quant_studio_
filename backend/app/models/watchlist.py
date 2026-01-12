"""Watchlist models."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WatchlistGroup(Base):
    """Watchlist groups (folders) table."""

    __tablename__ = "watchlist_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items: Mapped[list["WatchlistItem"]] = relationship("WatchlistItem", back_populates="group", cascade="all, delete-orphan")


class WatchlistItem(Base):
    """Stocks in watchlist table."""

    __tablename__ = "watchlist_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(Integer, ForeignKey("watchlist_groups.id", ondelete="CASCADE"), nullable=False)
    symbol: Mapped[str] = mapped_column(String(10), ForeignKey("stock_basic.symbol"), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    group: Mapped["WatchlistGroup"] = relationship("WatchlistGroup", back_populates="items")

    __table_args__ = (
        UniqueConstraint("group_id", "symbol", name="uq_group_symbol"),
        Index("idx_watchlist_group", "group_id"),
    )
