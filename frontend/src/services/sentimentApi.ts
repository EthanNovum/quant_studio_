import api from './api'
import type {
  ZhihuContent,
  ZhihuContentListResponse,
  ZhihuCreator,
  ZhihuCreatorDetail,
  SentimentMarkersResponse,
  StockWithAliases,
  SyncStatus,
  ArticleTimeRange,
  CrawlTimeRangeRequest,
} from '@/types'

// ========== Sentiment/Articles API ==========

export async function getArticles(params: {
  page?: number
  page_size?: number
  stock_symbol?: string
  author_id?: string
  sort_by?: 'time' | 'votes'
  sort_order?: 'asc' | 'desc'
}): Promise<ZhihuContentListResponse> {
  const { data } = await api.get<ZhihuContentListResponse>('/sentiment/articles', { params })
  return data
}

export async function getArticle(contentId: string): Promise<ZhihuContent> {
  const { data } = await api.get<ZhihuContent>(`/sentiment/articles/${contentId}`)
  return data
}

export async function updateArticleStocks(contentId: string, symbols: string[]): Promise<void> {
  await api.put(`/sentiment/articles/${contentId}/stocks`, symbols)
}

export async function getSentimentMarkers(symbol: string): Promise<SentimentMarkersResponse> {
  const { data } = await api.get<SentimentMarkersResponse>(`/sentiment/markers/${symbol}`)
  return data
}

// ========== Statistics API ==========

export async function getStatsByStock(): Promise<{ symbol: string; name: string; count: number }[]> {
  const { data } = await api.get<{ symbol: string; name: string; count: number }[]>('/sentiment/stats/by-stock')
  return data
}

export async function getStatsByAuthor(): Promise<{ author_id: string; author_name: string; count: number }[]> {
  const { data } = await api.get<{ author_id: string; author_name: string; count: number }[]>('/sentiment/stats/by-author')
  return data
}

// ========== Creators API ==========

export async function getCreators(): Promise<ZhihuCreator[]> {
  const { data } = await api.get<ZhihuCreator[]>('/sentiment/creators')
  return data
}

export async function addCreator(userLink: string): Promise<ZhihuCreator> {
  const { data } = await api.post<ZhihuCreator>('/sentiment/creators', { user_link: userLink })
  return data
}

export async function deleteCreator(userId: string): Promise<void> {
  await api.delete(`/sentiment/creators/${userId}`)
}

export async function toggleCreator(userId: string): Promise<{ is_active: number }> {
  const { data } = await api.patch<{ is_active: number }>(`/sentiment/creators/${userId}/toggle`)
  return data
}

export async function getCreatorDetail(userId: string): Promise<ZhihuCreatorDetail> {
  const { data } = await api.get<ZhihuCreatorDetail>(`/sentiment/creators/${userId}`)
  return data
}

export async function batchToggleCreators(action: 'follow_all' | 'unfollow_all'): Promise<{ message: string; is_active: number }> {
  const { data } = await api.patch<{ message: string; is_active: number }>('/sentiment/creators/batch-toggle', null, {
    params: { action },
  })
  return data
}

// ========== Aliases API ==========

export async function getAllAliases(): Promise<StockWithAliases[]> {
  const { data } = await api.get<StockWithAliases[]>('/aliases')
  return data
}

export async function getStockAliases(symbol: string): Promise<StockWithAliases> {
  const { data } = await api.get<StockWithAliases>(`/aliases/${symbol}`)
  return data
}

export async function createAlias(symbol: string, alias: string): Promise<void> {
  await api.post('/aliases', { symbol, alias })
}

export async function updateStockAliases(symbol: string, aliases: string[]): Promise<StockWithAliases> {
  const { data } = await api.put<StockWithAliases>(`/aliases/${symbol}`, aliases)
  return data
}

export async function deleteAlias(aliasId: number): Promise<void> {
  await api.delete(`/aliases/${aliasId}`)
}

// ========== Sync API ==========

export async function getSyncStatus(): Promise<SyncStatus> {
  const { data } = await api.get<SyncStatus>('/sync/status')
  return data
}

export async function getArticleTimeRange(): Promise<ArticleTimeRange> {
  const { data } = await api.get<ArticleTimeRange>('/sync/article-time-range')
  return data
}

export async function startCrawl(timeRange?: CrawlTimeRangeRequest): Promise<{ message: string; task: string }> {
  const { data } = await api.post<{ message: string; task: string }>('/sync/crawl', timeRange || null)
  return data
}

export async function startTagging(retagAll: boolean = false): Promise<{ message: string; task: string }> {
  const { data } = await api.post<{ message: string; task: string }>('/sync/tag', null, {
    params: { retag_all: retagAll },
  })
  return data
}

export async function startMarketUpdate(): Promise<{ message: string; task: string }> {
  const { data } = await api.post<{ message: string; task: string }>('/sync/market')
  return data
}

export async function stopSync(): Promise<void> {
  await api.post('/sync/stop')
}

// ========== Crawler Config API ==========

export async function getConfig(key: string): Promise<{ key: string; value: string | null }> {
  const { data } = await api.get<{ key: string; value: string | null }>(`/sync/config/${key}`)
  return data
}

export async function setConfig(key: string, value: string): Promise<void> {
  await api.put('/sync/config', { key, value })
}

export async function testCookies(): Promise<{ valid: boolean; message: string }> {
  const { data } = await api.post<{ valid: boolean; message: string }>('/sync/test-cookies')
  return data
}
