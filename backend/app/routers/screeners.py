"""Screener endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.screener import SavedScreener
from app.models.stock import StockBasic
from app.schemas.screener import (
    ScreenerCreate,
    ScreenerExecuteRequest,
    ScreenerExecuteResponse,
    ScreenerResponse,
    ScreenersResponse,
    ScreenerUpdate,
)
from app.schemas.stock import StockResponse
from app.services.screener_service import execute_filter

router = APIRouter()


@router.get("/screener/industries")
def get_industries(db: Session = Depends(get_db)):
    """Get all distinct industries."""
    industries = (
        db.query(StockBasic.industry)
        .filter(StockBasic.industry.isnot(None))
        .distinct()
        .order_by(StockBasic.industry)
        .all()
    )
    return [ind[0] for ind in industries]


@router.post("/screener/execute", response_model=ScreenerExecuteResponse)
def execute_screener(request: ScreenerExecuteRequest, db: Session = Depends(get_db)):
    """Execute screener filters."""
    stocks, total = execute_filter(
        db=db,
        filters=request.filters,
        exclude_negative=request.exclude_negative,
        page=request.page,
        limit=request.limit,
    )

    return ScreenerExecuteResponse(
        results=[StockResponse.model_validate(s) for s in stocks],
        total=total,
    )


@router.get("/screeners", response_model=ScreenersResponse)
def list_screeners(db: Session = Depends(get_db)):
    """List all saved screeners."""
    screeners = db.query(SavedScreener).order_by(SavedScreener.created_at.desc()).all()

    return ScreenersResponse(
        screeners=[ScreenerResponse.model_validate(s) for s in screeners]
    )


@router.post("/screeners", response_model=ScreenerResponse)
def create_screener(screener: ScreenerCreate, db: Session = Depends(get_db)):
    """Create a new saved screener."""
    new_screener = SavedScreener(
        name=screener.name,
        criteria_json=screener.criteria_json,
    )
    db.add(new_screener)
    db.commit()
    db.refresh(new_screener)

    return ScreenerResponse.model_validate(new_screener)


@router.put("/screeners/{id}", response_model=ScreenerResponse)
def update_screener(id: int, screener: ScreenerUpdate, db: Session = Depends(get_db)):
    """Update a saved screener."""
    db_screener = db.query(SavedScreener).filter(SavedScreener.id == id).first()
    if not db_screener:
        raise HTTPException(status_code=404, detail="Screener not found")

    if screener.name is not None:
        db_screener.name = screener.name
    if screener.criteria_json is not None:
        db_screener.criteria_json = screener.criteria_json

    db.commit()
    db.refresh(db_screener)

    return ScreenerResponse.model_validate(db_screener)


@router.delete("/screeners/{id}")
def delete_screener(id: int, db: Session = Depends(get_db)):
    """Delete a saved screener."""
    db_screener = db.query(SavedScreener).filter(SavedScreener.id == id).first()
    if not db_screener:
        raise HTTPException(status_code=404, detail="Screener not found")

    db.delete(db_screener)
    db.commit()

    return {"success": True}
