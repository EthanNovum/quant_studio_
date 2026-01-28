"""API routes for Zhihu sentiment data."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ZhihuContent, ZhihuCreator, ArticleStockRef
from app.schemas.zhihu import (
    ZhihuContentResponse,
    ZhihuContentListResponse,
    ZhihuCreatorCreate,
    ZhihuCreatorResponse,
    SentimentMarker,
    SentimentMarkersResponse,
)

router = APIRouter(prefix="/sentiment", tags=["sentiment"])


# ========== Content Endpoints ==========

@router.get("/articles", response_model=ZhihuContentListResponse)
def get_articles(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    stock_symbol: Optional[str] = None,
    author_id: Optional[str] = None,
    sort_by: str = Query("time", pattern="^(time|votes)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    """Get paginated list of Zhihu articles."""
    query = db.query(ZhihuContent)

    # Filter by stock if specified
    if stock_symbol:
        article_ids = db.query(ArticleStockRef.article_id).filter(
            ArticleStockRef.stock_symbol == stock_symbol
        ).subquery()
        query = query.filter(ZhihuContent.content_id.in_(article_ids))

    # Filter by author if specified
    if author_id:
        query = query.filter(ZhihuContent.author_id == author_id)

    # Get total count
    total = query.count()

    # Apply sorting
    if sort_by == "time":
        order_column = ZhihuContent.created_time
    else:  # votes
        order_column = ZhihuContent.voteup_count

    if sort_order == "desc":
        order_column = order_column.desc()
    else:
        order_column = order_column.asc()

    # Get paginated results
    articles = query.order_by(order_column).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    # Get related stocks for each article
    items = []
    for article in articles:
        refs = db.query(ArticleStockRef).filter(
            ArticleStockRef.article_id == article.content_id
        ).all()
        related_stocks = [ref.stock_symbol for ref in refs]

        items.append(ZhihuContentResponse(
            content_id=article.content_id,
            content_type=article.content_type,
            title=article.title,
            content_text=article.content_text[:500] if article.content_text else None,
            content_url=article.content_url,
            created_time=article.created_time,
            voteup_count=article.voteup_count,
            comment_count=article.comment_count,
            author_id=article.author_id,
            author_name=article.author_name,
            author_avatar=article.author_avatar,
            is_tagged=article.is_tagged,
            related_stocks=related_stocks,
        ))

    return ZhihuContentListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/articles/{content_id}", response_model=ZhihuContentResponse)
def get_article(content_id: str, db: Session = Depends(get_db)):
    """Get a single article by ID."""
    article = db.query(ZhihuContent).filter(
        ZhihuContent.content_id == content_id
    ).first()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    refs = db.query(ArticleStockRef).filter(
        ArticleStockRef.article_id == content_id
    ).all()
    related_stocks = [ref.stock_symbol for ref in refs]

    return ZhihuContentResponse(
        content_id=article.content_id,
        content_type=article.content_type,
        title=article.title,
        content_text=article.content_text,
        content_url=article.content_url,
        created_time=article.created_time,
        voteup_count=article.voteup_count,
        comment_count=article.comment_count,
        author_id=article.author_id,
        author_name=article.author_name,
        author_avatar=article.author_avatar,
        is_tagged=article.is_tagged,
        related_stocks=related_stocks,
    )


# ========== Sentiment Markers for K-Line ==========

@router.get("/markers/{symbol}", response_model=SentimentMarkersResponse)
def get_sentiment_markers(symbol: str, db: Session = Depends(get_db)):
    """
    Get sentiment markers for a stock's K-line chart.
    Returns aggregated article data grouped by display_date.
    """
    result = db.execute(text("""
        SELECT
            r.display_date,
            COUNT(*) as count,
            GROUP_CONCAT(c.title, '|||') as titles,
            GROUP_CONCAT(c.content_id, ',') as article_ids,
            MAX(CASE WHEN r.display_date != r.original_date THEN 1 ELSE 0 END) as is_weekend
        FROM article_stock_ref r
        JOIN zhihu_content c ON r.article_id = c.content_id
        WHERE r.stock_symbol = :symbol
        GROUP BY r.display_date
        ORDER BY r.display_date
    """), {"symbol": symbol})

    markers = []
    for row in result:
        titles = row[2].split("|||") if row[2] else []
        article_ids = row[3].split(",") if row[3] else []
        markers.append(SentimentMarker(
            date=row[0],
            count=row[1],
            titles=titles,
            article_ids=article_ids,
            is_weekend=bool(row[4]) if row[4] is not None else False,
        ))

    return SentimentMarkersResponse(symbol=symbol, markers=markers)


# ========== Creator Endpoints ==========

@router.get("/creators", response_model=List[ZhihuCreatorResponse])
def get_creators(db: Session = Depends(get_db)):
    """Get all monitored Zhihu creators."""
    creators = db.query(ZhihuCreator).order_by(ZhihuCreator.created_at.desc()).all()
    return creators


@router.post("/creators", response_model=ZhihuCreatorResponse)
def add_creator(creator_data: ZhihuCreatorCreate, db: Session = Depends(get_db)):
    """Add a new Zhihu creator to monitor."""
    # Extract url_token from link
    user_link = creator_data.user_link.rstrip("/")
    url_token = user_link.split("/")[-1]

    # Check if already exists
    existing = db.query(ZhihuCreator).filter(
        ZhihuCreator.url_token == url_token
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Creator already exists")

    # Create placeholder entry (will be filled by crawler)
    creator = ZhihuCreator(
        user_id=url_token,  # Temporary, will be updated by crawler
        url_token=url_token,
        user_nickname=url_token,  # Temporary
        user_link=user_link,
        is_active=1,
    )
    db.add(creator)
    db.commit()
    db.refresh(creator)

    return creator


@router.delete("/creators/{user_id}")
def delete_creator(user_id: str, db: Session = Depends(get_db)):
    """Remove a creator from monitoring."""
    creator = db.query(ZhihuCreator).filter(ZhihuCreator.user_id == user_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")

    db.delete(creator)
    db.commit()

    return {"message": "Creator removed"}


@router.patch("/creators/{user_id}/toggle")
def toggle_creator(user_id: str, db: Session = Depends(get_db)):
    """Toggle creator active status."""
    creator = db.query(ZhihuCreator).filter(ZhihuCreator.user_id == user_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")

    creator.is_active = 0 if creator.is_active else 1
    db.commit()

    return {"is_active": creator.is_active}


# ========== Statistics Endpoints ==========

@router.get("/stats/by-stock")
def get_stats_by_stock(db: Session = Depends(get_db)):
    """Get article count grouped by stock symbol with latest quote data."""
    result = db.execute(text("""
        SELECT
            r.stock_symbol,
            s.name,
            COUNT(DISTINCT r.article_id) as count,
            q.close as latest_price,
            q.date as latest_date
        FROM article_stock_ref r
        LEFT JOIN stock_basic s ON r.stock_symbol = s.symbol
        LEFT JOIN (
            SELECT symbol, close, date
            FROM daily_quotes q1
            WHERE date = (SELECT MAX(date) FROM daily_quotes q2 WHERE q2.symbol = q1.symbol)
        ) q ON r.stock_symbol = q.symbol
        GROUP BY r.stock_symbol, s.name, q.close, q.date
        ORDER BY count DESC
    """))

    stocks = []
    for row in result:
        symbol = row[0]
        latest_price = row[3]

        # Get previous day price for change calculation
        prev_result = db.execute(text("""
            SELECT close FROM daily_quotes
            WHERE symbol = :symbol AND date < :date
            ORDER BY date DESC LIMIT 1
        """), {"symbol": symbol, "date": row[4] or "9999-12-31"})
        prev_row = prev_result.fetchone()
        prev_price = prev_row[0] if prev_row else None

        price_change_pct = None
        if latest_price and prev_price and prev_price > 0:
            price_change_pct = round((latest_price - prev_price) / prev_price * 100, 2)

        stocks.append({
            "symbol": symbol,
            "name": row[1] or "",
            "count": row[2],
            "latest_price": latest_price,
            "price_change_pct": price_change_pct,
        })

    return stocks


@router.get("/stats/by-author")
def get_stats_by_author(db: Session = Depends(get_db)):
    """Get article count grouped by author with creator details."""
    result = db.execute(text("""
        SELECT
            c.author_id,
            c.author_name,
            COUNT(*) as count,
            cr.user_avatar,
            cr.fans,
            cr.answer_count,
            cr.article_count,
            cr.voteup_count
        FROM zhihu_content c
        LEFT JOIN zhihu_creators cr ON c.author_id = cr.user_id
        WHERE c.author_id IS NOT NULL
        GROUP BY c.author_id, c.author_name, cr.user_avatar, cr.fans, cr.answer_count, cr.article_count, cr.voteup_count
        ORDER BY count DESC
    """))

    return [{
        "author_id": row[0],
        "author_name": row[1] or "未知作者",
        "count": row[2],
        "avatar": row[3],
        "fans": row[4] or 0,
        "answer_count": row[5] or 0,
        "article_count": row[6] or 0,
        "voteup_count": row[7] or 0,
    } for row in result]


# ========== Manual Stock Association ==========

@router.put("/articles/{content_id}/stocks")
def update_article_stocks(content_id: str, stock_symbols: List[str], db: Session = Depends(get_db)):
    """Manually update stock associations for an article."""
    # Check if article exists
    article = db.query(ZhihuContent).filter(ZhihuContent.content_id == content_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Delete existing associations
    db.query(ArticleStockRef).filter(ArticleStockRef.article_id == content_id).delete()

    # Create new associations
    from datetime import datetime
    article_date = datetime.fromtimestamp(article.created_time).strftime("%Y-%m-%d") if article.created_time else None

    for symbol in stock_symbols:
        if symbol.strip():
            ref = ArticleStockRef(
                article_id=content_id,
                stock_symbol=symbol.strip(),
                display_date=article_date or "",
                original_date=article_date or "",
                match_keyword="manual",
                match_score=100,
            )
            db.add(ref)

    db.commit()

    return {"message": "Stock associations updated", "stocks": stock_symbols}
