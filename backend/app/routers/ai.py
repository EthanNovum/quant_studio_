"""API routes for AI sentiment analysis."""

import json
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ZhihuContent, ArticleStockRef, StockBasic
from app.models.ai_insight import AIInsight, UserDecision, AIUsageLog, AIConfig
from app.schemas.ai import (
    AIInsightResponse,
    AIInsightWithArticle,
    UserDecisionCreate,
    UserDecisionResponse,
    UserDecisionWithStock,
    AIUsageLogResponse,
    AIUsageStats,
    AIConfigResponse,
    AIConfigUpdate,
    AnalyzeArticleRequest,
    AnalyzeBatchRequest,
    AnalysisResult,
    BatchAnalysisResponse,
    DailyReviewStock,
    DailyReviewResponse,
    EnhancedSentimentMarker,
    EnhancedSentimentMarkersResponse,
)
from app.services.ai_service import AIService

router = APIRouter(prefix="/ai")


# ========== AI Analysis Endpoints ==========

@router.post("/analyze", response_model=AnalysisResult)
def analyze_article(
    request: AnalyzeArticleRequest,
    db: Session = Depends(get_db),
):
    """Analyze a single article using AI."""
    # Get article
    article = db.query(ZhihuContent).filter(
        ZhihuContent.content_id == request.article_id
    ).first()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Run analysis
    ai_service = AIService(db)
    result = ai_service.analyze_article(
        article_id=article.content_id,
        title=article.title,
        content=article.content_text or "",
    )

    # Convert insights to response format
    insights = []
    if result.get("success") and result.get("insights"):
        for insight in result["insights"]:
            insights.append(AIInsightResponse(
                id=insight.id,
                article_id=insight.article_id,
                stock_symbol=insight.stock_symbol,
                sentiment_score=insight.sentiment_score,
                sentiment_label=insight.sentiment_label,
                summary_text=insight.summary_text,
                key_tags=insight.key_tags,
                core_logic=insight.core_logic,
                model_name=insight.model_name,
                prompt_tokens=insight.prompt_tokens,
                completion_tokens=insight.completion_tokens,
                total_tokens=insight.total_tokens,
                processing_time_ms=insight.processing_time_ms,
                created_at=insight.created_at,
            ))

    return AnalysisResult(
        article_id=request.article_id,
        success=result.get("success", False),
        insights=insights,
        usage=result.get("usage", {}),
        error=result.get("error"),
    )


@router.post("/analyze/batch", response_model=BatchAnalysisResponse)
def analyze_batch(
    request: AnalyzeBatchRequest,
    db: Session = Depends(get_db),
):
    """Analyze multiple articles using AI."""
    batch_id = str(uuid.uuid4())[:8]

    # Get articles to process
    if request.article_ids:
        articles = db.query(ZhihuContent).filter(
            ZhihuContent.content_id.in_(request.article_ids)
        ).all()
    else:
        # Get unprocessed articles (not in ai_insights)
        processed_ids = db.query(AIInsight.article_id).distinct().subquery()
        articles = db.query(ZhihuContent).filter(
            ~ZhihuContent.content_id.in_(processed_ids)
        ).order_by(ZhihuContent.created_time.desc()).limit(request.limit).all()

    ai_service = AIService(db)
    results = []
    total_usage = {
        "total_prompt_tokens": 0,
        "total_completion_tokens": 0,
        "total_tokens": 0,
        "total_cost": 0.0,
        "total_processing_time_ms": 0,
    }
    successful = 0
    failed = 0

    for article in articles:
        result = ai_service.analyze_article(
            article_id=article.content_id,
            title=article.title,
            content=article.content_text or "",
            batch_id=batch_id,
        )

        # Convert insights
        insights = []
        if result.get("success") and result.get("insights"):
            for insight in result["insights"]:
                insights.append(AIInsightResponse(
                    id=insight.id,
                    article_id=insight.article_id,
                    stock_symbol=insight.stock_symbol,
                    sentiment_score=insight.sentiment_score,
                    sentiment_label=insight.sentiment_label,
                    summary_text=insight.summary_text,
                    key_tags=insight.key_tags,
                    core_logic=insight.core_logic,
                    model_name=insight.model_name,
                    prompt_tokens=insight.prompt_tokens,
                    completion_tokens=insight.completion_tokens,
                    total_tokens=insight.total_tokens,
                    processing_time_ms=insight.processing_time_ms,
                    created_at=insight.created_at,
                ))

        results.append(AnalysisResult(
            article_id=article.content_id,
            success=result.get("success", False),
            insights=insights,
            usage=result.get("usage", {}),
            error=result.get("error"),
        ))

        # Update totals
        usage = result.get("usage", {})
        if result.get("success"):
            successful += 1
            total_usage["total_prompt_tokens"] += usage.get("prompt_tokens", 0)
            total_usage["total_completion_tokens"] += usage.get("completion_tokens", 0)
            total_usage["total_tokens"] += usage.get("total_tokens", 0)
            total_usage["total_cost"] += usage.get("estimated_cost", 0)
        else:
            failed += 1
        total_usage["total_processing_time_ms"] += usage.get("processing_time_ms", 0)

    return BatchAnalysisResponse(
        batch_id=batch_id,
        total_articles=len(articles),
        processed=len(results),
        successful=successful,
        failed=failed,
        results=results,
        total_usage=total_usage,
    )


# ========== AI Insights Endpoints ==========

@router.get("/insights", response_model=List[AIInsightWithArticle])
def get_insights(
    stock_symbol: Optional[str] = None,
    sentiment_label: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get AI insights with optional filtering."""
    query = db.query(
        AIInsight,
        ZhihuContent.title.label("article_title"),
        ZhihuContent.content_url.label("article_url"),
        ZhihuContent.author_name,
    ).join(
        ZhihuContent, AIInsight.article_id == ZhihuContent.content_id
    )

    if stock_symbol:
        query = query.filter(AIInsight.stock_symbol == stock_symbol)
    if sentiment_label:
        query = query.filter(AIInsight.sentiment_label == sentiment_label)

    query = query.order_by(AIInsight.created_at.desc())
    results = query.offset((page - 1) * page_size).limit(page_size).all()

    return [
        AIInsightWithArticle(
            id=r.AIInsight.id,
            article_id=r.AIInsight.article_id,
            stock_symbol=r.AIInsight.stock_symbol,
            sentiment_score=r.AIInsight.sentiment_score,
            sentiment_label=r.AIInsight.sentiment_label,
            summary_text=r.AIInsight.summary_text,
            key_tags=r.AIInsight.key_tags,
            core_logic=r.AIInsight.core_logic,
            model_name=r.AIInsight.model_name,
            prompt_tokens=r.AIInsight.prompt_tokens,
            completion_tokens=r.AIInsight.completion_tokens,
            total_tokens=r.AIInsight.total_tokens,
            processing_time_ms=r.AIInsight.processing_time_ms,
            created_at=r.AIInsight.created_at,
            article_title=r.article_title,
            article_url=r.article_url,
            author_name=r.author_name,
        )
        for r in results
    ]


@router.get("/insights/{stock_symbol}/summary")
def get_stock_insight_summary(
    stock_symbol: str,
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
):
    """Get aggregated AI insight summary for a stock."""
    from datetime import timedelta

    cutoff = datetime.utcnow() - timedelta(days=days)

    insights = db.query(AIInsight).filter(
        AIInsight.stock_symbol == stock_symbol,
        AIInsight.created_at >= cutoff,
    ).all()

    if not insights:
        return {
            "symbol": stock_symbol,
            "period_days": days,
            "insight_count": 0,
            "avg_sentiment_score": None,
            "sentiment_distribution": {},
            "top_tags": [],
            "summaries": [],
        }

    # Calculate stats
    scores = [i.sentiment_score for i in insights]
    avg_score = sum(scores) / len(scores) if scores else None

    # Sentiment distribution
    distribution = {}
    for i in insights:
        label = i.sentiment_label or "Unknown"
        distribution[label] = distribution.get(label, 0) + 1

    # Aggregate tags
    all_tags = []
    for i in insights:
        if i.key_tags:
            try:
                tags = json.loads(i.key_tags)
                all_tags.extend(tags)
            except json.JSONDecodeError:
                pass

    # Count tag frequency
    tag_counts = {}
    for tag in all_tags:
        tag_counts[tag] = tag_counts.get(tag, 0) + 1
    top_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    # Get recent summaries
    summaries = [
        {"summary": i.summary_text, "score": i.sentiment_score, "label": i.sentiment_label}
        for i in sorted(insights, key=lambda x: x.created_at, reverse=True)[:5]
        if i.summary_text
    ]

    return {
        "symbol": stock_symbol,
        "period_days": days,
        "insight_count": len(insights),
        "avg_sentiment_score": round(avg_score, 2) if avg_score else None,
        "sentiment_distribution": distribution,
        "top_tags": [{"tag": t[0], "count": t[1]} for t in top_tags],
        "summaries": summaries,
    }


# ========== User Decision Endpoints ==========

@router.post("/decisions", response_model=UserDecisionResponse)
def create_decision(
    decision: UserDecisionCreate,
    db: Session = Depends(get_db),
):
    """Create or update a user decision for daily review."""
    # Check if decision already exists for this stock and date
    existing = db.query(UserDecision).filter(
        UserDecision.stock_symbol == decision.stock_symbol,
        UserDecision.review_date == decision.review_date,
    ).first()

    linked_ids_json = json.dumps(decision.linked_insight_ids) if decision.linked_insight_ids else None

    if existing:
        # Update existing
        existing.action_type = decision.action_type
        existing.rationale = decision.rationale
        existing.confidence_level = decision.confidence_level
        existing.linked_insight_ids = linked_ids_json
        db.commit()
        db.refresh(existing)
        return existing

    # Create new
    new_decision = UserDecision(
        stock_symbol=decision.stock_symbol,
        review_date=decision.review_date,
        action_type=decision.action_type,
        rationale=decision.rationale,
        confidence_level=decision.confidence_level,
        linked_insight_ids=linked_ids_json,
    )
    db.add(new_decision)
    db.commit()
    db.refresh(new_decision)

    return new_decision


@router.get("/decisions", response_model=List[UserDecisionWithStock])
def get_decisions(
    stock_symbol: Optional[str] = None,
    review_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get user decisions with optional filtering."""
    query = db.query(
        UserDecision,
        StockBasic.name.label("stock_name"),
    ).outerjoin(
        StockBasic, UserDecision.stock_symbol == StockBasic.symbol
    )

    if stock_symbol:
        query = query.filter(UserDecision.stock_symbol == stock_symbol)
    if review_date:
        query = query.filter(UserDecision.review_date == review_date)

    query = query.order_by(UserDecision.review_date.desc(), UserDecision.created_at.desc())
    results = query.offset((page - 1) * page_size).limit(page_size).all()

    return [
        UserDecisionWithStock(
            id=r.UserDecision.id,
            stock_symbol=r.UserDecision.stock_symbol,
            review_date=r.UserDecision.review_date,
            action_type=r.UserDecision.action_type,
            rationale=r.UserDecision.rationale,
            confidence_level=r.UserDecision.confidence_level,
            linked_insight_ids=r.UserDecision.linked_insight_ids,
            created_at=r.UserDecision.created_at,
            updated_at=r.UserDecision.updated_at,
            stock_name=r.stock_name,
        )
        for r in results
    ]


@router.delete("/decisions/{decision_id}")
def delete_decision(decision_id: int, db: Session = Depends(get_db)):
    """Delete a user decision."""
    decision = db.query(UserDecision).filter(UserDecision.id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    db.delete(decision)
    db.commit()
    return {"message": "Decision deleted"}


# ========== Daily Review Endpoints ==========

@router.get("/daily-review", response_model=DailyReviewResponse)
def get_daily_review(
    review_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get stocks for daily review with AI insights."""
    if not review_date:
        review_date = datetime.now().strftime("%Y-%m-%d")

    # Get stocks with recent AI insights or in watchlist
    # For now, get stocks that have AI insights from recent days
    from datetime import timedelta
    cutoff_date = (datetime.strptime(review_date, "%Y-%m-%d") - timedelta(days=7)).strftime("%Y-%m-%d")

    # Get stocks with recent insights
    stock_insights = db.query(
        AIInsight.stock_symbol,
        func.count(AIInsight.id).label("insight_count"),
        func.avg(AIInsight.sentiment_score).label("avg_score"),
    ).filter(
        AIInsight.created_at >= cutoff_date
    ).group_by(AIInsight.stock_symbol).all()

    stocks = []
    for si in stock_insights:
        # Get stock info
        stock = db.query(StockBasic).filter(StockBasic.symbol == si.stock_symbol).first()

        # Get latest price
        latest_quote = db.execute(text("""
            SELECT close, date FROM daily_quotes
            WHERE symbol = :symbol
            ORDER BY date DESC LIMIT 1
        """), {"symbol": si.stock_symbol}).fetchone()

        # Get previous price for change calculation
        prev_quote = None
        if latest_quote:
            prev_quote = db.execute(text("""
                SELECT close FROM daily_quotes
                WHERE symbol = :symbol AND date < :date
                ORDER BY date DESC LIMIT 1
            """), {"symbol": si.stock_symbol, "date": latest_quote[1]}).fetchone()

        price_change_pct = None
        if latest_quote and prev_quote and prev_quote[0] > 0:
            price_change_pct = round((latest_quote[0] - prev_quote[0]) / prev_quote[0] * 100, 2)

        # Get latest insights for summary
        latest_insights = db.query(AIInsight).filter(
            AIInsight.stock_symbol == si.stock_symbol
        ).order_by(AIInsight.created_at.desc()).limit(3).all()

        # Aggregate tags
        all_tags = []
        summaries = []
        for insight in latest_insights:
            if insight.key_tags:
                try:
                    tags = json.loads(insight.key_tags)
                    all_tags.extend(tags)
                except json.JSONDecodeError:
                    pass
            if insight.summary_text:
                summaries.append(insight.summary_text)

        # Determine overall sentiment
        avg_score = si.avg_score
        if avg_score:
            if avg_score >= 7:
                sentiment_label = "Bullish"
            elif avg_score <= 4:
                sentiment_label = "Bearish"
            else:
                sentiment_label = "Neutral"
        else:
            sentiment_label = None

        # Get existing decision for today
        existing_decision = db.query(UserDecision).filter(
            UserDecision.stock_symbol == si.stock_symbol,
            UserDecision.review_date == review_date,
        ).first()

        # Get related article IDs
        article_ids = [i.article_id for i in latest_insights]

        stocks.append(DailyReviewStock(
            symbol=si.stock_symbol,
            name=stock.name if stock else si.stock_symbol,
            latest_price=latest_quote[0] if latest_quote else None,
            price_change_pct=price_change_pct,
            insight_count=si.insight_count,
            avg_sentiment_score=round(avg_score, 2) if avg_score else None,
            sentiment_label=sentiment_label,
            ai_summary=summaries[0] if summaries else None,
            key_tags=list(set(all_tags))[:5],
            existing_decision=existing_decision,
            article_ids=article_ids,
        ))

    # Sort by insight count (most discussed first)
    stocks.sort(key=lambda x: x.insight_count, reverse=True)

    return DailyReviewResponse(
        review_date=review_date,
        stocks=stocks,
        total_stocks=len(stocks),
    )


# ========== Enhanced Sentiment Markers ==========

@router.get("/markers/{symbol}", response_model=EnhancedSentimentMarkersResponse)
def get_enhanced_sentiment_markers(symbol: str, db: Session = Depends(get_db)):
    """Get enhanced sentiment markers with AI analysis for K-line chart."""
    # Get basic markers
    result = db.execute(text("""
        SELECT
            r.display_date,
            COUNT(*) as count,
            STRING_AGG(c.title, '|||') as titles,
            STRING_AGG(c.content_id, ',') as article_ids,
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

        # Get AI insights for these articles
        insights = db.query(AIInsight).filter(
            AIInsight.article_id.in_(article_ids),
            AIInsight.stock_symbol == symbol,
        ).all()

        # Calculate aggregated sentiment
        avg_score = None
        sentiment_label = None
        ai_summaries = []
        all_tags = []

        if insights:
            scores = [i.sentiment_score for i in insights if i.sentiment_score]
            if scores:
                avg_score = round(sum(scores) / len(scores), 2)
                if avg_score >= 7:
                    sentiment_label = "Bullish"
                elif avg_score <= 4:
                    sentiment_label = "Bearish"
                else:
                    sentiment_label = "Neutral"

            for insight in insights:
                if insight.summary_text:
                    ai_summaries.append(insight.summary_text)
                if insight.key_tags:
                    try:
                        tags = json.loads(insight.key_tags)
                        all_tags.extend(tags)
                    except json.JSONDecodeError:
                        pass

        markers.append(EnhancedSentimentMarker(
            date=row[0],
            count=row[1],
            titles=titles,
            article_ids=article_ids,
            is_weekend=bool(row[4]) if row[4] is not None else False,
            avg_sentiment_score=avg_score,
            sentiment_label=sentiment_label,
            ai_summaries=ai_summaries[:3],  # Limit to 3 summaries
            key_tags=list(set(all_tags))[:5],  # Limit to 5 unique tags
        ))

    return EnhancedSentimentMarkersResponse(symbol=symbol, markers=markers)


# ========== AI Usage & Config Endpoints ==========

@router.get("/usage/stats", response_model=AIUsageStats)
def get_usage_stats(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """Get AI usage statistics."""
    ai_service = AIService(db)
    return ai_service.get_usage_stats(days)


@router.get("/usage/logs", response_model=List[AIUsageLogResponse])
def get_usage_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    request_type: Optional[str] = None,
    success_only: bool = False,
    db: Session = Depends(get_db),
):
    """Get AI usage logs with pagination."""
    query = db.query(AIUsageLog)

    if request_type:
        query = query.filter(AIUsageLog.request_type == request_type)
    if success_only:
        query = query.filter(AIUsageLog.success == 1)

    query = query.order_by(AIUsageLog.created_at.desc())
    logs = query.offset((page - 1) * page_size).limit(page_size).all()

    return logs


@router.get("/usage/logs/{log_id}")
def get_usage_log_detail(log_id: int, db: Session = Depends(get_db)):
    """Get detailed AI usage log including prompt and response."""
    log = db.query(AIUsageLog).filter(AIUsageLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    return {
        "id": log.id,
        "request_type": log.request_type,
        "model_name": log.model_name,
        "prompt_tokens": log.prompt_tokens,
        "completion_tokens": log.completion_tokens,
        "total_tokens": log.total_tokens,
        "estimated_cost": log.estimated_cost,
        "processing_time_ms": log.processing_time_ms,
        "success": log.success,
        "error_message": log.error_message,
        "prompt_text": log.prompt_text,
        "response_text": log.response_text,
        "article_id": log.article_id,
        "batch_id": log.batch_id,
        "created_at": log.created_at,
    }


@router.get("/config", response_model=List[AIConfigResponse])
def get_ai_configs(db: Session = Depends(get_db)):
    """Get all AI configuration settings."""
    configs = db.query(AIConfig).all()
    return configs


@router.put("/config", response_model=AIConfigResponse)
def set_ai_config(config: AIConfigUpdate, db: Session = Depends(get_db)):
    """Set an AI configuration value."""
    existing = db.query(AIConfig).filter(AIConfig.key == config.key).first()

    if existing:
        existing.value = config.value
        if config.description:
            existing.description = config.description
        db.commit()
        db.refresh(existing)
        return existing

    new_config = AIConfig(
        key=config.key,
        value=config.value,
        description=config.description,
    )
    db.add(new_config)
    db.commit()
    db.refresh(new_config)

    return new_config


@router.delete("/config/{key}")
def delete_ai_config(key: str, db: Session = Depends(get_db)):
    """Delete an AI configuration."""
    config = db.query(AIConfig).filter(AIConfig.key == key).first()
    if config:
        db.delete(config)
        db.commit()
    return {"message": "Config deleted"}


# ========== AI Status Endpoint ==========

@router.get("/status")
def get_ai_status(db: Session = Depends(get_db)):
    """Get AI service status and configuration."""
    from app.config import settings

    # Check if API key is configured
    api_configured = bool(settings.openai_api_key)

    # Get current model from config or default
    model_config = db.query(AIConfig).filter(AIConfig.key == "model_name").first()
    current_model = model_config.value if model_config else settings.ai_model

    # Get prompt config
    prompt_config = db.query(AIConfig).filter(AIConfig.key == "sentiment_prompt").first()
    has_custom_prompt = bool(prompt_config and prompt_config.value)

    # Get stats
    total_insights = db.query(func.count(AIInsight.id)).scalar()
    total_articles = db.query(func.count(ZhihuContent.content_id)).scalar()
    processed_articles = db.query(func.count(func.distinct(AIInsight.article_id))).scalar()

    return {
        "api_configured": api_configured,
        "base_url": settings.openai_base_url or "https://api.openai.com",
        "current_model": current_model,
        "has_custom_prompt": has_custom_prompt,
        "stats": {
            "total_insights": total_insights,
            "total_articles": total_articles,
            "processed_articles": processed_articles,
            "unprocessed_articles": total_articles - processed_articles,
        },
    }
