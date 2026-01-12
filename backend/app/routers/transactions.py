"""Transaction endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.quote import DailyQuote
from app.models.stock import StockBasic
from app.models.transaction import Transaction
from app.schemas.transaction import (
    PositionResponse,
    PositionsResponse,
    TransactionCreate,
    TransactionResponse,
    TransactionsResponse,
    TransactionUpdate,
)
from app.services.position_calculator import calculate_positions

router = APIRouter()


@router.get("/transactions", response_model=TransactionsResponse)
def list_transactions(
    symbol: str | None = Query(None, description="Filter by symbol"),
    start_date: str | None = Query(None, description="Start date"),
    end_date: str | None = Query(None, description="End date"),
    action: str | None = Query(None, description="Filter by action (BUY/SELL/DIVIDEND)"),
    db: Session = Depends(get_db),
):
    """List transactions with optional filters."""
    query = db.query(Transaction)

    if symbol:
        query = query.filter(Transaction.symbol == symbol)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if action:
        query = query.filter(Transaction.action == action.upper())

    transactions = query.order_by(Transaction.date.desc(), Transaction.created_at.desc()).all()

    # Enrich with stock names
    result = []
    for tx in transactions:
        stock = db.query(StockBasic).filter(StockBasic.symbol == tx.symbol).first()
        result.append(
            TransactionResponse(
                id=tx.id,
                symbol=tx.symbol,
                action=tx.action,
                price=tx.price,
                quantity=tx.quantity,
                date=tx.date,
                reason=tx.reason,
                commission=tx.commission,
                created_at=tx.created_at,
                stock_name=stock.name if stock else None,
            )
        )

    return TransactionsResponse(transactions=result)


@router.post("/transactions", response_model=TransactionResponse)
def create_transaction(tx: TransactionCreate, db: Session = Depends(get_db)):
    """Create a new transaction."""
    # Validate action
    if tx.action.upper() not in ["BUY", "SELL", "DIVIDEND"]:
        raise HTTPException(status_code=400, detail="Invalid action. Must be BUY, SELL, or DIVIDEND")

    transaction = Transaction(
        symbol=tx.symbol,
        action=tx.action.upper(),
        price=tx.price,
        quantity=tx.quantity,
        date=tx.date,
        reason=tx.reason,
        commission=tx.commission,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    stock = db.query(StockBasic).filter(StockBasic.symbol == tx.symbol).first()

    return TransactionResponse(
        id=transaction.id,
        symbol=transaction.symbol,
        action=transaction.action,
        price=transaction.price,
        quantity=transaction.quantity,
        date=transaction.date,
        reason=transaction.reason,
        commission=transaction.commission,
        created_at=transaction.created_at,
        stock_name=stock.name if stock else None,
    )


@router.put("/transactions/{id}", response_model=TransactionResponse)
def update_transaction(id: int, tx: TransactionUpdate, db: Session = Depends(get_db)):
    """Update a transaction."""
    transaction = db.query(Transaction).filter(Transaction.id == id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if tx.price is not None:
        transaction.price = tx.price
    if tx.quantity is not None:
        transaction.quantity = tx.quantity
    if tx.date is not None:
        transaction.date = tx.date
    if tx.reason is not None:
        transaction.reason = tx.reason
    if tx.commission is not None:
        transaction.commission = tx.commission

    db.commit()
    db.refresh(transaction)

    stock = db.query(StockBasic).filter(StockBasic.symbol == transaction.symbol).first()

    return TransactionResponse(
        id=transaction.id,
        symbol=transaction.symbol,
        action=transaction.action,
        price=transaction.price,
        quantity=transaction.quantity,
        date=transaction.date,
        reason=transaction.reason,
        commission=transaction.commission,
        created_at=transaction.created_at,
        stock_name=stock.name if stock else None,
    )


@router.delete("/transactions/{id}")
def delete_transaction(id: int, db: Session = Depends(get_db)):
    """Delete a transaction."""
    transaction = db.query(Transaction).filter(Transaction.id == id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    db.delete(transaction)
    db.commit()

    return {"success": True}


@router.get("/positions", response_model=PositionsResponse)
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

        result.append(
            PositionResponse(
                symbol=symbol,
                name=stock.name if stock else None,
                quantity=pos.quantity,
                avg_cost=pos.avg_cost,
                current_price=current_price,
                unrealized_pnl=unrealized_pnl,
                unrealized_pnl_pct=unrealized_pnl_pct,
                realized_pnl=pos.realized_pnl,
            )
        )

    return PositionsResponse(positions=result)
