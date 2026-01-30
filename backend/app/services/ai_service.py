"""AI service for sentiment analysis using LLM APIs."""

import json
import time
from datetime import datetime
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.ai_insight import AIInsight, AIUsageLog, AIConfig


# Default system prompt for sentiment analysis
DEFAULT_SENTIMENT_PROMPT = """你是一个专业的A股投资分析师。请阅读以下文章，完成以下任务：

1. 识别文章中提及的A股股票代码（如无明确提及则根据公司名称、别名推理，如"宁王"指宁德时代300750）
2. 分析作者对该股票的情绪倾向：
   - sentiment_label: "Bullish"(看多), "Bearish"(看空), 或 "Neutral"(中性)
   - sentiment_score: 1-10分（1=极度看空，5=中性，10=极度看多）
3. 用一句话总结核心投资逻辑
4. 提取关键标签（如：产能扩张、政策利好、业绩超预期等）

请以JSON格式返回，格式如下：
{
  "stocks": [
    {
      "symbol": "股票代码（6位数字）",
      "name": "股票名称",
      "sentiment_label": "Bullish/Bearish/Neutral",
      "sentiment_score": 1-10,
      "summary": "一句话核心逻辑",
      "tags": ["标签1", "标签2"]
    }
  ]
}

如果文章未提及任何具体股票，返回空数组：{"stocks": []}

注意：
- 只返回JSON，不要有其他文字
- 股票代码必须是6位数字
- 如果提及多只股票，全部列出"""


class AIService:
    """Service for AI-powered sentiment analysis."""

    def __init__(self, db: Session):
        self.db = db

    def _get_api_url(self) -> str:
        """Get the API endpoint URL."""
        base_url = settings.openai_base_url or "https://api.openai.com/v1"
        # Remove trailing slash if present
        base_url = base_url.rstrip("/")
        # Ensure /v1 suffix for OpenAI-compatible APIs
        if not base_url.endswith("/v1"):
            base_url = f"{base_url}/v1"
        return f"{base_url}/chat/completions"

    def get_system_prompt(self) -> str:
        """Get the system prompt from config or use default."""
        config = self.db.query(AIConfig).filter(AIConfig.key == "sentiment_prompt").first()
        if config and config.value:
            return config.value
        return DEFAULT_SENTIMENT_PROMPT

    def get_model_name(self) -> str:
        """Get the model name from config or use default."""
        config = self.db.query(AIConfig).filter(AIConfig.key == "model_name").first()
        if config and config.value:
            return config.value
        return settings.ai_model

    def analyze_article(
        self,
        article_id: str,
        title: str,
        content: str,
        batch_id: Optional[str] = None,
    ) -> dict:
        """
        Analyze a single article for sentiment.

        Returns:
            dict with keys: success, insights, usage, error
        """
        start_time = time.time()
        model_name = self.get_model_name()
        system_prompt = self.get_system_prompt()

        if not settings.openai_api_key:
            return {
                "success": False,
                "error": "OPENAI_API_KEY not configured",
                "usage": {"model": model_name},
            }

        # Prepare user message
        user_message = f"标题：{title}\n\n内容：{content[:8000]}"  # Truncate very long content

        # Log the request
        usage_log = AIUsageLog(
            request_type="sentiment_analysis",
            model_name=model_name,
            prompt_text=f"[System]\n{system_prompt}\n\n[User]\n{user_message}",
            article_id=article_id,
            batch_id=batch_id,
        )

        try:
            # Prepare request payload
            payload = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "max_tokens": settings.ai_max_tokens,
                "temperature": 0.3,  # Lower temperature for more consistent results
            }

            # Prepare headers
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.openai_api_key}",
            }

            # Make the API request
            api_url = self._get_api_url()
            with httpx.Client(timeout=60.0) as client:
                response = client.post(api_url, json=payload, headers=headers)
                response.raise_for_status()
                result = response.json()

            # Extract usage info
            usage_info = result.get("usage", {})
            prompt_tokens = usage_info.get("prompt_tokens", 0)
            completion_tokens = usage_info.get("completion_tokens", 0)
            total_tokens = usage_info.get("total_tokens", 0)

            # Calculate cost (approximate)
            estimated_cost = self._estimate_cost(model_name, prompt_tokens, completion_tokens)

            # Parse response
            choices = result.get("choices", [])
            if not choices:
                raise ValueError("No choices in API response")

            response_text = choices[0].get("message", {}).get("content", "").strip()

            # Try to extract JSON from response
            parsed_result = self._parse_json_response(response_text)

            # Calculate processing time
            processing_time_ms = int((time.time() - start_time) * 1000)

            # Update usage log
            usage_log.prompt_tokens = prompt_tokens
            usage_log.completion_tokens = completion_tokens
            usage_log.total_tokens = total_tokens
            usage_log.estimated_cost = estimated_cost
            usage_log.response_text = response_text
            usage_log.processing_time_ms = processing_time_ms
            usage_log.success = 1

            self.db.add(usage_log)
            self.db.commit()

            # Create AI insights for each detected stock
            insights = []
            if parsed_result and "stocks" in parsed_result:
                for stock_data in parsed_result["stocks"]:
                    insight = self._create_insight(
                        article_id=article_id,
                        stock_data=stock_data,
                        model_name=model_name,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        total_tokens=total_tokens,
                        processing_time_ms=processing_time_ms,
                    )
                    if insight:
                        insights.append(insight)

            return {
                "success": True,
                "insights": insights,
                "usage": {
                    "model": model_name,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": total_tokens,
                    "estimated_cost": estimated_cost,
                    "processing_time_ms": processing_time_ms,
                },
                "raw_response": response_text,
                "parsed_result": parsed_result,
            }

        except httpx.HTTPStatusError as e:
            processing_time_ms = int((time.time() - start_time) * 1000)
            error_detail = str(e)
            try:
                error_body = e.response.json()
                error_detail = error_body.get("error", {}).get("message", str(e))
            except Exception:
                pass

            usage_log.processing_time_ms = processing_time_ms
            usage_log.success = 0
            usage_log.error_message = error_detail

            self.db.add(usage_log)
            self.db.commit()

            return {
                "success": False,
                "error": error_detail,
                "usage": {
                    "model": model_name,
                    "processing_time_ms": processing_time_ms,
                },
            }

        except Exception as e:
            processing_time_ms = int((time.time() - start_time) * 1000)
            usage_log.processing_time_ms = processing_time_ms
            usage_log.success = 0
            usage_log.error_message = str(e)

            self.db.add(usage_log)
            self.db.commit()

            return {
                "success": False,
                "error": str(e),
                "usage": {
                    "model": model_name,
                    "processing_time_ms": processing_time_ms,
                },
            }

    def _parse_json_response(self, response_text: str) -> Optional[dict]:
        """Parse JSON from LLM response, handling markdown code blocks."""
        # Remove markdown code blocks if present
        text = response_text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON object in the text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass
            return None

    def _create_insight(
        self,
        article_id: str,
        stock_data: dict,
        model_name: str,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: int,
        processing_time_ms: int,
    ) -> Optional[AIInsight]:
        """Create an AIInsight record from parsed stock data."""
        symbol = stock_data.get("symbol", "").strip()
        if not symbol or len(symbol) != 6 or not symbol.isdigit():
            return None

        # Check if insight already exists
        existing = self.db.query(AIInsight).filter(
            AIInsight.article_id == article_id,
            AIInsight.stock_symbol == symbol,
        ).first()

        if existing:
            # Update existing insight
            existing.sentiment_score = stock_data.get("sentiment_score", 5)
            existing.sentiment_label = stock_data.get("sentiment_label", "Neutral")
            existing.summary_text = stock_data.get("summary", "")
            existing.key_tags = json.dumps(stock_data.get("tags", []), ensure_ascii=False)
            existing.core_logic = stock_data.get("summary", "")
            existing.model_name = model_name
            existing.prompt_tokens = prompt_tokens
            existing.completion_tokens = completion_tokens
            existing.total_tokens = total_tokens
            existing.processing_time_ms = processing_time_ms
            self.db.commit()
            return existing

        # Create new insight
        insight = AIInsight(
            article_id=article_id,
            stock_symbol=symbol,
            sentiment_score=stock_data.get("sentiment_score", 5),
            sentiment_label=stock_data.get("sentiment_label", "Neutral"),
            summary_text=stock_data.get("summary", ""),
            key_tags=json.dumps(stock_data.get("tags", []), ensure_ascii=False),
            core_logic=stock_data.get("summary", ""),
            model_name=model_name,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            processing_time_ms=processing_time_ms,
        )

        self.db.add(insight)
        self.db.commit()
        self.db.refresh(insight)

        return insight

    def _estimate_cost(self, model_name: str, prompt_tokens: int, completion_tokens: int) -> float:
        """Estimate cost based on model and token usage."""
        # Pricing per 1M tokens (as of 2024)
        pricing = {
            "gpt-4o": {"input": 2.50, "output": 10.00},
            "gpt-4o-mini": {"input": 0.15, "output": 0.60},
            "gpt-4-turbo": {"input": 10.00, "output": 30.00},
            "gpt-4": {"input": 30.00, "output": 60.00},
            "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
            "deepseek-chat": {"input": 0.14, "output": 0.28},
            "deepseek-coder": {"input": 0.14, "output": 0.28},
        }

        # Find matching pricing or use default
        model_pricing = None
        for key in pricing:
            if key in model_name.lower():
                model_pricing = pricing[key]
                break

        if not model_pricing:
            model_pricing = {"input": 1.00, "output": 2.00}  # Default estimate

        input_cost = (prompt_tokens / 1_000_000) * model_pricing["input"]
        output_cost = (completion_tokens / 1_000_000) * model_pricing["output"]

        return round(input_cost + output_cost, 6)

    def get_usage_stats(self, days: int = 30) -> dict:
        """Get AI usage statistics for the specified period."""
        from sqlalchemy import func, case
        from datetime import timedelta

        cutoff = datetime.utcnow() - timedelta(days=days)

        stats = self.db.query(
            func.count(AIUsageLog.id).label("total_requests"),
            func.sum(AIUsageLog.prompt_tokens).label("total_prompt_tokens"),
            func.sum(AIUsageLog.completion_tokens).label("total_completion_tokens"),
            func.sum(AIUsageLog.total_tokens).label("total_tokens"),
            func.sum(AIUsageLog.estimated_cost).label("total_cost"),
            func.avg(AIUsageLog.processing_time_ms).label("avg_processing_time"),
            func.sum(case((AIUsageLog.success == 1, 1), else_=0)).label("successful_requests"),
        ).filter(AIUsageLog.created_at >= cutoff).first()

        # Get breakdown by model
        model_stats = self.db.query(
            AIUsageLog.model_name,
            func.count(AIUsageLog.id).label("requests"),
            func.sum(AIUsageLog.total_tokens).label("tokens"),
            func.sum(AIUsageLog.estimated_cost).label("cost"),
        ).filter(
            AIUsageLog.created_at >= cutoff
        ).group_by(AIUsageLog.model_name).all()

        return {
            "period_days": days,
            "total_requests": stats.total_requests or 0,
            "successful_requests": stats.successful_requests or 0,
            "total_prompt_tokens": stats.total_prompt_tokens or 0,
            "total_completion_tokens": stats.total_completion_tokens or 0,
            "total_tokens": stats.total_tokens or 0,
            "total_cost_usd": round(stats.total_cost or 0, 4),
            "avg_processing_time_ms": round(stats.avg_processing_time or 0, 2),
            "by_model": [
                {
                    "model": m.model_name,
                    "requests": m.requests,
                    "tokens": m.tokens or 0,
                    "cost_usd": round(m.cost or 0, 4),
                }
                for m in model_stats
            ],
        }
