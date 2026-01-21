"""Watchlist endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.stock import StockBasic
from app.models.watchlist import WatchlistGroup, WatchlistItem
from app.schemas.watchlist import (
    WatchlistGroupCreate,
    WatchlistGroupResponse,
    WatchlistGroupsResponse,
    WatchlistGroupUpdate,
    WatchlistItemCreate,
    WatchlistItemResponse,
    WatchlistReorderRequest,
)

router = APIRouter()


@router.get("/groups", response_model=WatchlistGroupsResponse)
def list_groups(db: Session = Depends(get_db)):
    """List all watchlist groups with items."""
    groups = db.query(WatchlistGroup).order_by(WatchlistGroup.sort_order).all()

    result = []
    for group in groups:
        items = []
        for item in sorted(group.items, key=lambda x: x.sort_order):
            stock = db.query(StockBasic).filter(StockBasic.symbol == item.symbol).first()
            items.append(
                WatchlistItemResponse(
                    id=item.id,
                    symbol=item.symbol,
                    sort_order=item.sort_order,
                    added_at=item.added_at,
                    stock_name=stock.name if stock else None,
                    asset_type=stock.asset_type if stock else None,
                )
            )
        result.append(
            WatchlistGroupResponse(
                id=group.id,
                name=group.name,
                sort_order=group.sort_order,
                items=items,
            )
        )

    return WatchlistGroupsResponse(groups=result)


@router.post("/groups", response_model=WatchlistGroupResponse)
def create_group(group: WatchlistGroupCreate, db: Session = Depends(get_db)):
    """Create a new watchlist group."""
    # Get max sort_order
    max_order = db.query(WatchlistGroup.sort_order).order_by(WatchlistGroup.sort_order.desc()).first()
    new_order = (max_order[0] + 1) if max_order else 0

    new_group = WatchlistGroup(name=group.name, sort_order=new_order)
    db.add(new_group)
    db.commit()
    db.refresh(new_group)

    return WatchlistGroupResponse(
        id=new_group.id,
        name=new_group.name,
        sort_order=new_group.sort_order,
        items=[],
    )


@router.put("/groups/{id}", response_model=WatchlistGroupResponse)
def update_group(id: int, group: WatchlistGroupUpdate, db: Session = Depends(get_db)):
    """Update a watchlist group."""
    db_group = db.query(WatchlistGroup).filter(WatchlistGroup.id == id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found")

    if group.name is not None:
        db_group.name = group.name
    if group.sort_order is not None:
        db_group.sort_order = group.sort_order

    db.commit()
    db.refresh(db_group)

    items = []
    for item in sorted(db_group.items, key=lambda x: x.sort_order):
        stock = db.query(StockBasic).filter(StockBasic.symbol == item.symbol).first()
        items.append(
            WatchlistItemResponse(
                id=item.id,
                symbol=item.symbol,
                sort_order=item.sort_order,
                added_at=item.added_at,
                stock_name=stock.name if stock else None,
                asset_type=stock.asset_type if stock else None,
            )
        )

    return WatchlistGroupResponse(
        id=db_group.id,
        name=db_group.name,
        sort_order=db_group.sort_order,
        items=items,
    )


@router.delete("/groups/{id}")
def delete_group(id: int, db: Session = Depends(get_db)):
    """Delete a watchlist group."""
    db_group = db.query(WatchlistGroup).filter(WatchlistGroup.id == id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found")

    db.delete(db_group)
    db.commit()

    return {"success": True}


@router.post("/items", response_model=WatchlistItemResponse)
def add_item(item: WatchlistItemCreate, db: Session = Depends(get_db)):
    """Add a stock to watchlist."""
    # Check if group exists
    group = db.query(WatchlistGroup).filter(WatchlistGroup.id == item.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Check if already exists
    existing = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.group_id == item.group_id, WatchlistItem.symbol == item.symbol)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Stock already in this group")

    # Get max sort_order in group
    max_order = (
        db.query(WatchlistItem.sort_order)
        .filter(WatchlistItem.group_id == item.group_id)
        .order_by(WatchlistItem.sort_order.desc())
        .first()
    )
    new_order = (max_order[0] + 1) if max_order else 0

    new_item = WatchlistItem(
        group_id=item.group_id,
        symbol=item.symbol,
        sort_order=new_order,
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    stock = db.query(StockBasic).filter(StockBasic.symbol == item.symbol).first()

    return WatchlistItemResponse(
        id=new_item.id,
        symbol=new_item.symbol,
        sort_order=new_item.sort_order,
        added_at=new_item.added_at,
        stock_name=stock.name if stock else None,
        asset_type=stock.asset_type if stock else None,
    )


@router.delete("/items/{id}")
def remove_item(id: int, db: Session = Depends(get_db)):
    """Remove a stock from watchlist."""
    item = db.query(WatchlistItem).filter(WatchlistItem.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.commit()

    return {"success": True}


@router.put("/items/reorder")
def reorder_items(request: WatchlistReorderRequest, db: Session = Depends(get_db)):
    """Reorder watchlist items."""
    for item_data in request.items:
        item = db.query(WatchlistItem).filter(WatchlistItem.id == item_data.id).first()
        if item:
            item.group_id = item_data.group_id
            item.sort_order = item_data.sort_order

    db.commit()

    return {"success": True}
