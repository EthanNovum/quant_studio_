"""Stock alias model for keyword matching."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StockAlias(Base):
    """Stock alias table for NLP matching."""

    __tablename__ = "stock_aliases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(10), ForeignKey("stock_basic.symbol"), nullable=False)
    alias: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "宁王", "酱香科技"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
