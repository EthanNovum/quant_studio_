"""Trades endpoints - Alternative API for frontend compatibility.

This router provides /api/trades/* endpoints that map to the transaction/position functionality.
Frontend uses 'code' field while backend uses 'symbol', so this router handles the mapping.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.quote import DailyQuote
from app.models.stock import StockBasic
from app.models.transaction import Transaction
from app.services.position_calculator import calculate_positions

router = APIRouter()


# Schemas for trades API (uses 'code' instead of 'symbol')
class TradeCreate(BaseModel):
    """Trade creation schema."""
    code: str
    action: str  # BUY, SELL, DIVIDEND
    price: float
    quantity: float
    date: str
    reason: str | None = None
    commission: float = 0


class TradeResponse(BaseModel):
    """Trade response schema."""
    id: int
    code: str
    name: str | None = None
    action: str
    price: float
    quantity: float
    date: str
    reason: str | None = None
    commission: float = 0
    created_at: str | None = None

    class Config:
        from_attributes = True


class PositionResponse(BaseModel):
    """Position response schema."""
    code: str
    name: str | None = None
    quantity: float
    avg_cost: float
    current_price: float | None = None
    unrealized_pnl: float | None = None
    unrealized_pnl_pct: float | None = None
    realized_pnl: float = 0


class StockPriceResponse(BaseModel):
    """Stock price response."""
    price: float | None = None


@router.get("")
def list_trades(db: Session = Depends(get_db)):
    """List all trades."""
    transactions = db.query(Transaction).order_by(Transaction.date.desc(), Transaction.created_at.desc()).all()

    result = []
    for tx in transactions:
        stock = db.query(StockBasic).filter(StockBasic.symbol == tx.symbol).first()
        result.append(TradeResponse(
            id=tx.id,
            code=tx.symbol,
            name=stock.name if stock else None,
            action=tx.action,
            price=tx.price,
            quantity=tx.quantity,
            date=tx.date,
            reason=tx.reason,
            commission=tx.commission,
            created_at=tx.created_at.isoformat() if tx.created_at else None,
        ))

    return result


@router.post("")
def create_trade(trade: TradeCreate, db: Session = Depends(get_db)):
    """Create a new trade."""
    # Validate action
    if trade.action.upper() not in ["BUY", "SELL", "DIVIDEND"]:
        raise HTTPException(status_code=400, detail="Invalid action. Must be BUY, SELL, or DIVIDEND")

    transaction = Transaction(
        symbol=trade.code,
        action=trade.action.upper(),
        price=trade.price,
        quantity=trade.quantity,
        date=trade.date,
        reason=trade.reason,
        commission=trade.commission,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    stock = db.query(StockBasic).filter(StockBasic.symbol == trade.code).first()

    return TradeResponse(
        id=transaction.id,
        code=transaction.symbol,
        name=stock.name if stock else None,
        action=transaction.action,
        price=transaction.price,
        quantity=transaction.quantity,
        date=transaction.date,
        reason=transaction.reason,
        commission=transaction.commission,
        created_at=transaction.created_at.isoformat() if transaction.created_at else None,
    )


@router.delete("/{id}")
def delete_trade(id: int, db: Session = Depends(get_db)):
    """Delete a trade."""
    transaction = db.query(Transaction).filter(Transaction.id == id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Trade not found")

    db.delete(transaction)
    db.commit()

    return {"success": True}


@router.get("/positions")
def get_positions(db: Session = Depends(get_db)):
    """Get current positions with P&L calculation."""
    transactions = db.query(Transaction).all()
    positions_dict = calculate_positions(transactions)

    result = []
    for symbol, pos in positions_dict.items():
        # Get stock name
        stock = db.query(StockBasic).filter(StockBasic.symbol == symbol).first()

        # Get current price from latest quote
        latest_quote = (
            db.query(DailyQuote)
            .filter(DailyQuote.symbol == symbol)
            .order_by(DailyQuote.date.desc())
            .first()
        )

        current_price = latest_quote.close if latest_quote else None
        unrealized_pnl = None
        unrealized_pnl_pct = None

        if current_price and pos.avg_cost > 0:
            unrealized_pnl = (current_price - pos.avg_cost) * pos.quantity
            unrealized_pnl_pct = ((current_price - pos.avg_cost) / pos.avg_cost) * 100

        result.append(PositionResponse(
            code=symbol,
            name=stock.name if stock else None,
            quantity=pos.quantity,
            avg_cost=pos.avg_cost,
            current_price=current_price,
            unrealized_pnl=unrealized_pnl,
            unrealized_pnl_pct=unrealized_pnl_pct,
            realized_pnl=pos.realized_pnl,
        ))

    return result


@router.get("/stock-price/{code}")
def get_stock_price(code: str, db: Session = Depends(get_db)):
    """Get the latest stock price for a given code."""
    latest_quote = (
        db.query(DailyQuote)
        .filter(DailyQuote.symbol == code)
        .order_by(DailyQuote.date.desc())
        .first()
    )

    if latest_quote:
        return StockPriceResponse(price=latest_quote.close)

    return StockPriceResponse(price=None)
