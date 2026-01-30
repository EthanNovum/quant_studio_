"""Transaction and position schemas."""

from datetime import datetime

from pydantic import BaseModel


class TransactionBase(BaseModel):
    """Base transaction schema."""

    symbol: str
    action: str  # BUY, SELL, DIVIDEND, BONUS
    price: float
    quantity: float
    date: str


class TransactionCreate(TransactionBase):
    """Transaction creation schema."""

    reason: str | None = None
    commission: float = 0


class TransactionUpdate(BaseModel):
    """Transaction update schema."""

    price: float | None = None
    quantity: float | None = None
    date: str | None = None
    reason: str | None = None
    commission: float | None = None


class TransactionResponse(TransactionBase):
    """Transaction response schema."""

    id: int
    reason: str | None = None
    commission: float = 0
    created_at: datetime
    stock_name: str | None = None

    class Config:
        from_attributes = True


class TransactionsResponse(BaseModel):
    """Transactions list response."""

    transactions: list[TransactionResponse]


class PositionResponse(BaseModel):
    """Position response schema."""

    symbol: str
    name: str | None = None
    quantity: float
    avg_cost: float
    current_price: float | None = None
    unrealized_pnl: float | None = None
    unrealized_pnl_pct: float | None = None
    realized_pnl: float = 0


class PositionsResponse(BaseModel):
    """Positions list response."""

    positions: list[PositionResponse]
