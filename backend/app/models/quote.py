"""Daily quotes model."""

from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DailyQuote(Base):
    """Daily price quotes table."""

    __tablename__ = "daily_quotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(10), ForeignKey("stock_basic.symbol"), nullable=False)
    date: Mapped[str] = mapped_column(String(20), nullable=False)
    open: Mapped[float] = mapped_column(nullable=False)
    high: Mapped[float] = mapped_column(nullable=False)
    low: Mapped[float] = mapped_column(nullable=False)
    close: Mapped[float] = mapped_column(nullable=False)
    volume: Mapped[float | None] = mapped_column()
    turnover: Mapped[float | None] = mapped_column()
    turnover_rate: Mapped[float | None] = mapped_column()
    pe_ttm: Mapped[float | None] = mapped_column()
    pb: Mapped[float | None] = mapped_column()
    market_cap: Mapped[float | None] = mapped_column()

    __table_args__ = (
        UniqueConstraint("symbol", "date", name="uq_symbol_date"),
        Index("idx_quotes_symbol", "symbol"),
        Index("idx_quotes_date", "date"),
    )
