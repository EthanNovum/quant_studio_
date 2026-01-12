"""Quote endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.quote import DailyQuote
from app.schemas.quote import QuoteBase, QuotesResponse

router = APIRouter()


@router.get("/{symbol}/quotes", response_model=QuotesResponse)
def get_quotes(
    symbol: str,
    start_date: str | None = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """Get historical quotes for a stock."""
    query = db.query(DailyQuote).filter(DailyQuote.symbol == symbol)

    if start_date:
        query = query.filter(DailyQuote.date >= start_date)
    if end_date:
        query = query.filter(DailyQuote.date <= end_date)

    quotes = query.order_by(DailyQuote.date.asc()).all()

    return QuotesResponse(
        quotes=[
            QuoteBase(
                date=q.date,
                open=q.open,
                high=q.high,
                low=q.low,
                close=q.close,
                volume=q.volume,
                turnover=q.turnover,
                turnover_rate=q.turnover_rate,
                pe_ttm=q.pe_ttm,
                pb=q.pb,
                market_cap=q.market_cap,
            )
            for q in quotes
        ]
    )
