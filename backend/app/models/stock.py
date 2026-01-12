"""Stock basic information model."""

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StockBasic(Base):
    """Stock/Fund basic information table."""

    __tablename__ = "stock_basic"

    symbol: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(10), default="stock")  # stock, etf, lof
    industry: Mapped[str | None] = mapped_column(String(50))
    roe: Mapped[float | None] = mapped_column()
    controller: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    listing_date: Mapped[str | None] = mapped_column(String(20))
    is_blacklisted: Mapped[int] = mapped_column(Integer, default=0)
    consecutive_loss_years: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
