"""Transaction model."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Transaction(Base):
    """User transaction records table."""

    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(10), ForeignKey("stock_basic.symbol"), nullable=False)
    action: Mapped[str] = mapped_column(String(10), nullable=False)  # BUY, SELL, DIVIDEND, BONUS
    price: Mapped[float] = mapped_column(nullable=False)
    quantity: Mapped[float] = mapped_column(nullable=False)
    date: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    commission: Mapped[float] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_transactions_symbol", "symbol"),
        Index("idx_transactions_date", "date"),
    )
