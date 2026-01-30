// AI Sentiment Analysis types

export interface AIInsight {
  id: number
  article_id: string
  stock_symbol: string
  sentiment_score: number
  sentiment_label: 'Bullish' | 'Bearish' | 'Neutral'
  summary_text: string | null
  key_tags: string | null
  core_logic: string | null
  model_name: string | null
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  processing_time_ms: number
  created_at: string
}

export interface AIInsightWithArticle extends AIInsight {
  article_title: string | null
  article_url: string | null
  author_name: string | null
}

export interface UserDecision {
  id: number
  stock_symbol: string
  review_date: string
  action_type: 'BUY' | 'SELL' | 'HOLD'
  rationale: string | null
  confidence_level: number
  linked_insight_ids: string | null
  created_at: string
  updated_at: string
}

export interface UserDecisionWithStock extends UserDecision {
  stock_name: string | null
}

export interface UserDecisionCreate {
  stock_symbol: string
  review_date: string
  action_type: 'BUY' | 'SELL' | 'HOLD'
  rationale?: string
  confidence_level?: number
  linked_insight_ids?: number[]
}

export interface AIUsageLog {
  id: number
  request_type: string
  model_name: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost: number
  processing_time_ms: number
  success: number
  error_message: string | null
  article_id: string | null
  batch_id: string | null
  created_at: string
}

export interface AIUsageLogDetail extends AIUsageLog {
  prompt_text: string | null
  response_text: string | null
}

export interface AIUsageStats {
  period_days: number
  total_requests: number
  successful_requests: number
  total_prompt_tokens: number
  total_completion_tokens: number
  total_tokens: number
  total_cost_usd: number
  avg_processing_time_ms: number
  by_model: {
    model: string
    requests: number
    tokens: number
    cost_usd: number
  }[]
}

export interface AIConfig {
  id: number
  key: string
  value: string | null
  description: string | null
  updated_at: string
}

export interface AnalysisResult {
  article_id: string
  success: boolean
  insights: AIInsight[]
  usage: {
    model?: string
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    estimated_cost?: number
    processing_time_ms?: number
  }
  error?: string
}

export interface BatchAnalysisResponse {
  batch_id: string
  total_articles: number
  processed: number
  successful: number
  failed: number
  results: AnalysisResult[]
  total_usage: {
    total_prompt_tokens: number
    total_completion_tokens: number
    total_tokens: number
    total_cost: number
    total_processing_time_ms: number
  }
}

export interface DailyReviewStock {
  symbol: string
  name: string
  latest_price: number | null
  price_change_pct: number | null
  insight_count: number
  avg_sentiment_score: number | null
  sentiment_label: 'Bullish' | 'Bearish' | 'Neutral' | null
  ai_summary: string | null
  key_tags: string[]
  existing_decision: UserDecision | null
  article_ids: string[]
}

export interface DailyReviewResponse {
  review_date: string
  stocks: DailyReviewStock[]
  total_stocks: number
}

export interface EnhancedSentimentMarker {
  date: string
  count: number
  titles: string[]
  article_ids: string[]
  is_weekend: boolean
  avg_sentiment_score: number | null
  sentiment_label: 'Bullish' | 'Bearish' | 'Neutral' | null
  ai_summaries: string[]
  key_tags: string[]
}

export interface EnhancedSentimentMarkersResponse {
  symbol: string
  markers: EnhancedSentimentMarker[]
}

export interface AIStatus {
  api_configured: boolean
  base_url: string
  current_model: string
  has_custom_prompt: boolean
  stats: {
    total_insights: number
    total_articles: number
    processed_articles: number
    unprocessed_articles: number
  }
}

export interface StockInsightSummary {
  symbol: string
  period_days: number
  insight_count: number
  avg_sentiment_score: number | null
  sentiment_distribution: Record<string, number>
  top_tags: { tag: string; count: number }[]
  summaries: { summary: string; score: number; label: string }[]
}
