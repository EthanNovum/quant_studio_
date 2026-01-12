"""Quote schemas."""

from pydantic import BaseModel


class QuoteBase(BaseModel):
    """Base quote schema."""

    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float | None = None
    turnover: float | None = None
    turnover_rate: float | None = None
    pe_ttm: float | None = None
    pb: float | None = None
    market_cap: float | None = None


class QuoteResponse(QuoteBase):
    """Quote response schema."""

    symbol: str

    class Config:
        from_attributes = True


class QuotesResponse(BaseModel):
    """Quotes list response."""

    quotes: list[QuoteBase]
