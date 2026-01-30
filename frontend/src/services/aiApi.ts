import api from './api'
import type {
  AIInsight,
  AIInsightWithArticle,
  UserDecision,
  UserDecisionWithStock,
  UserDecisionCreate,
  AIUsageLog,
  AIUsageLogDetail,
  AIUsageStats,
  AIConfig,
  AnalysisResult,
  BatchAnalysisResponse,
  DailyReviewResponse,
  EnhancedSentimentMarkersResponse,
  AIStatus,
  StockInsightSummary,
} from '@/types'

// ========== AI Analysis API ==========

export async function analyzeArticle(articleId: string): Promise<AnalysisResult> {
  const { data } = await api.post<AnalysisResult>('/ai/analyze', { article_id: articleId })
  return data
}

export async function analyzeBatch(params: {
  article_ids?: string[]
  limit?: number
}): Promise<BatchAnalysisResponse> {
  const { data } = await api.post<BatchAnalysisResponse>('/ai/analyze/batch', params)
  return data
}

// ========== AI Insights API ==========

export async function getAIInsights(params: {
  stock_symbol?: string
  sentiment_label?: string
  page?: number
  page_size?: number
}): Promise<AIInsightWithArticle[]> {
  const { data } = await api.get<AIInsightWithArticle[]>('/ai/insights', { params })
  return data
}

export async function getStockInsightSummary(
  symbol: string,
  days: number = 7
): Promise<StockInsightSummary> {
  const { data } = await api.get<StockInsightSummary>(`/ai/insights/${symbol}/summary`, {
    params: { days },
  })
  return data
}

// ========== User Decisions API ==========

export async function createDecision(decision: UserDecisionCreate): Promise<UserDecision> {
  const { data } = await api.post<UserDecision>('/ai/decisions', decision)
  return data
}

export async function getDecisions(params: {
  stock_symbol?: string
  review_date?: string
  page?: number
  page_size?: number
}): Promise<UserDecisionWithStock[]> {
  const { data } = await api.get<UserDecisionWithStock[]>('/ai/decisions', { params })
  return data
}

export async function deleteDecision(decisionId: number): Promise<void> {
  await api.delete(`/ai/decisions/${decisionId}`)
}

// ========== Daily Review API ==========

export async function getDailyReview(reviewDate?: string): Promise<DailyReviewResponse> {
  const { data } = await api.get<DailyReviewResponse>('/ai/daily-review', {
    params: reviewDate ? { review_date: reviewDate } : {},
  })
  return data
}

// ========== Enhanced Sentiment Markers API ==========

export async function getEnhancedSentimentMarkers(
  symbol: string
): Promise<EnhancedSentimentMarkersResponse> {
  const { data } = await api.get<EnhancedSentimentMarkersResponse>(`/ai/markers/${symbol}`)
  return data
}

// ========== AI Usage API ==========

export async function getAIUsageStats(days: number = 30): Promise<AIUsageStats> {
  const { data } = await api.get<AIUsageStats>('/ai/usage/stats', { params: { days } })
  return data
}

export async function getAIUsageLogs(params: {
  page?: number
  page_size?: number
  request_type?: string
  success_only?: boolean
}): Promise<AIUsageLog[]> {
  const { data } = await api.get<AIUsageLog[]>('/ai/usage/logs', { params })
  return data
}

export async function getAIUsageLogDetail(logId: number): Promise<AIUsageLogDetail> {
  const { data } = await api.get<AIUsageLogDetail>(`/ai/usage/logs/${logId}`)
  return data
}

// ========== AI Config API ==========

export async function getAIConfigs(): Promise<AIConfig[]> {
  const { data } = await api.get<AIConfig[]>('/ai/config')
  return data
}

export async function setAIConfig(
  key: string,
  value: string,
  description?: string
): Promise<AIConfig> {
  const { data } = await api.put<AIConfig>('/ai/config', { key, value, description })
  return data
}

export async function deleteAIConfig(key: string): Promise<void> {
  await api.delete(`/ai/config/${key}`)
}

// ========== AI Status API ==========

export async function getAIStatus(): Promise<AIStatus> {
  const { data } = await api.get<AIStatus>('/ai/status')
  return data
}
