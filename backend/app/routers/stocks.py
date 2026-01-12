"""Stock endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.quote import DailyQuote
from app.models.stock import StockBasic
from app.schemas.stock import LatestQuote, StockDetail, StockListResponse, StockResponse
from app.services.danger_label import get_danger_reasons

router = APIRouter()


@router.get("", response_model=StockListResponse)
def list_stocks(
    search: str | None = Query(None, description="Search by symbol or name"),
    industry: str | None = Query(None, description="Filter by industry"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List stocks with optional search and filter."""
    query = db.query(StockBasic)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (StockBasic.symbol.like(search_pattern)) | (StockBasic.name.like(search_pattern))
        )

    if industry:
        query = query.filter(StockBasic.industry == industry)

    total = query.count()
    offset = (page - 1) * limit
    stocks = query.offset(offset).limit(limit).all()

    return StockListResponse(
        stocks=[StockResponse.model_validate(s) for s in stocks],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/{symbol}", response_model=StockDetail)
def get_stock(symbol: str, db: Session = Depends(get_db)):
    """Get stock detail with latest quote and danger reasons."""
    stock = db.query(StockBasic).filter(StockBasic.symbol == symbol).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    # Get latest quote
    latest_quote_row = (
        db.query(DailyQuote)
        .filter(DailyQuote.symbol == symbol)
        .order_by(DailyQuote.date.desc())
        .first()
    )

    latest_quote = None
    if latest_quote_row:
        latest_quote = LatestQuote(
            date=latest_quote_row.date,
            open=latest_quote_row.open,
            high=latest_quote_row.high,
            low=latest_quote_row.low,
            close=latest_quote_row.close,
            volume=latest_quote_row.volume,
            turnover=latest_quote_row.turnover,
            turnover_rate=latest_quote_row.turnover_rate,
            pe_ttm=latest_quote_row.pe_ttm,
            pb=latest_quote_row.pb,
            market_cap=latest_quote_row.market_cap,
        )

    # Get danger reasons
    danger_reasons = get_danger_reasons(stock)

    return StockDetail(
        symbol=stock.symbol,
        name=stock.name,
        industry=stock.industry,
        roe=stock.roe,
        controller=stock.controller,
        description=stock.description,
        listing_date=stock.listing_date,
        is_blacklisted=stock.is_blacklisted,
        consecutive_loss_years=stock.consecutive_loss_years,
        latest_quote=latest_quote,
        danger_reasons=danger_reasons,
    )
