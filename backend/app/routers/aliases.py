"""API routes for stock aliases management."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import StockAlias, StockBasic
from app.schemas.zhihu import (
    StockAliasCreate,
    StockAliasResponse,
    StockWithAliases,
)

router = APIRouter(prefix="/aliases")


@router.get("", response_model=List[StockWithAliases])
def get_all_aliases(db: Session = Depends(get_db)):
    """Get all stocks with their aliases."""
    # Get all stocks that have aliases
    result = db.execute(text("""
        SELECT s.symbol, s.name, STRING_AGG(a.alias, ',') as aliases
        FROM stock_basic s
        LEFT JOIN stock_aliases a ON s.symbol = a.symbol
        GROUP BY s.symbol, s.name
        HAVING STRING_AGG(a.alias, ',') IS NOT NULL
        ORDER BY s.symbol
    """))

    items = []
    for row in result:
        aliases = row[2].split(",") if row[2] else []
        items.append(StockWithAliases(
            symbol=row[0],
            name=row[1] or "",
            aliases=aliases,
        ))

    return items


@router.get("/{symbol}", response_model=StockWithAliases)
def get_stock_aliases(symbol: str, db: Session = Depends(get_db)):
    """Get aliases for a specific stock."""
    stock = db.query(StockBasic).filter(StockBasic.symbol == symbol).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    aliases = db.query(StockAlias).filter(StockAlias.symbol == symbol).all()

    return StockWithAliases(
        symbol=stock.symbol,
        name=stock.name,
        aliases=[a.alias for a in aliases],
    )


@router.post("", response_model=StockAliasResponse)
def create_alias(alias_data: StockAliasCreate, db: Session = Depends(get_db)):
    """Create a new stock alias."""
    # Check if stock exists
    stock = db.query(StockBasic).filter(StockBasic.symbol == alias_data.symbol).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    # Check if alias already exists
    existing = db.query(StockAlias).filter(
        StockAlias.symbol == alias_data.symbol,
        StockAlias.alias == alias_data.alias,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Alias already exists")

    # Create alias
    alias = StockAlias(symbol=alias_data.symbol, alias=alias_data.alias)
    db.add(alias)
    db.commit()
    db.refresh(alias)

    return alias


@router.delete("/{alias_id}")
def delete_alias(alias_id: int, db: Session = Depends(get_db)):
    """Delete a stock alias."""
    alias = db.query(StockAlias).filter(StockAlias.id == alias_id).first()
    if not alias:
        raise HTTPException(status_code=404, detail="Alias not found")

    db.delete(alias)
    db.commit()

    return {"message": "Alias deleted"}


@router.delete("/stock/{symbol}")
def delete_stock_aliases(symbol: str, db: Session = Depends(get_db)):
    """Delete all aliases for a stock."""
    db.query(StockAlias).filter(StockAlias.symbol == symbol).delete()
    db.commit()

    return {"message": "All aliases deleted"}


@router.put("/{symbol}", response_model=StockWithAliases)
def update_stock_aliases(symbol: str, aliases: List[str], db: Session = Depends(get_db)):
    """Replace all aliases for a stock."""
    stock = db.query(StockBasic).filter(StockBasic.symbol == symbol).first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    # Delete existing aliases
    db.query(StockAlias).filter(StockAlias.symbol == symbol).delete()

    # Create new aliases
    for alias_text in aliases:
        if alias_text.strip():
            alias = StockAlias(symbol=symbol, alias=alias_text.strip())
            db.add(alias)

    db.commit()

    # Return updated stock with aliases
    return StockWithAliases(
        symbol=stock.symbol,
        name=stock.name,
        aliases=aliases,
    )
