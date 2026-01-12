"""Screener filter execution service."""

import json
from typing import Any

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.models.quote import DailyQuote
from app.models.stock import StockBasic
from app.schemas.screener import FilterCriteria


def apply_filter(query, stock_alias, quote_alias, criteria: FilterCriteria):
    """Apply a single filter criteria to the query."""
    field = criteria.field
    operator = criteria.operator
    value = criteria.value

    # Determine which table the field belongs to
    if field in ["roe", "industry", "is_blacklisted", "consecutive_loss_years"]:
        column = getattr(stock_alias, field, None)
    elif field in ["pe_ttm", "pb", "market_cap", "close", "volume", "turnover_rate"]:
        column = getattr(quote_alias, field, None)
    else:
        return query

    if column is None:
        return query

    # Apply operator
    if operator == ">":
        query = query.filter(column > value)
    elif operator == "<":
        query = query.filter(column < value)
    elif operator == ">=":
        query = query.filter(column >= value)
    elif operator == "<=":
        query = query.filter(column <= value)
    elif operator == "=":
        query = query.filter(column == value)
    elif operator == "!=":
        query = query.filter(column != value)
    elif operator == "between" and isinstance(value, list) and len(value) == 2:
        query = query.filter(and_(column >= value[0], column <= value[1]))
    elif operator == "in" and isinstance(value, list):
        query = query.filter(column.in_(value))

    return query


def execute_filter(
    db: Session,
    filters: list[FilterCriteria],
    exclude_negative: bool = False,
    page: int = 1,
    limit: int = 50,
) -> tuple[list[StockBasic], int]:
    """
    Execute screener filters against stock_basic + latest quotes.

    Args:
        db: Database session
        filters: List of filter criteria
        exclude_negative: Whether to exclude negative stocks (ROE < 5%, blacklisted, etc.)
        page: Page number (1-indexed)
        limit: Items per page

    Returns:
        Tuple of (filtered stocks, total count)
    """
    # Get the latest date with quotes
    latest_date_subquery = db.query(DailyQuote.date).order_by(DailyQuote.date.desc()).limit(1).scalar_subquery()

    # Base query joining stocks with their latest quotes
    query = (
        db.query(StockBasic)
        .outerjoin(
            DailyQuote,
            and_(
                StockBasic.symbol == DailyQuote.symbol,
                DailyQuote.date == latest_date_subquery,
            ),
        )
    )

    # Apply user filters
    for f in filters:
        query = apply_filter(query, StockBasic, DailyQuote, f)

    # Apply negative list filtering
    if exclude_negative:
        query = query.filter(
            or_(
                StockBasic.roe >= 5,
                StockBasic.roe.is_(None),
            )
        ).filter(StockBasic.is_blacklisted == 0).filter(StockBasic.consecutive_loss_years < 3)

    # Get total count before pagination
    total = query.count()

    # Apply pagination
    offset = (page - 1) * limit
    stocks = query.offset(offset).limit(limit).all()

    return stocks, total
