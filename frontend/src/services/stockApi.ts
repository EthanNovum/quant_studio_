import api from './api'
import { matchesPinyin } from '@/lib/utils'

export interface StockSearchResult {
  symbol: string
  name: string
  asset_type: string
  industry: string | null
  roe: number | null
}

export interface LatestQuote {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number | null
  turnover: number | null
  turnover_rate: number | null
  pe_ttm: number | null
  pb: number | null
  market_cap: number | null
}

export interface StockDetail {
  symbol: string
  name: string
  asset_type: string
  industry: string | null
  roe: number | null
  controller: string | null
  description: string | null
  listing_date: string | null
  is_blacklisted: number
  consecutive_loss_years: number
  latest_quote: LatestQuote | null
  danger_reasons: string[]
}

interface StockListResponse {
  stocks: StockSearchResult[]
  total: number
  page: number
  limit: number
}

// Check if query looks like pinyin (only lowercase letters)
function isPinyinQuery(q: string): boolean {
  return /^[a-z]+$/.test(q.toLowerCase())
}

export async function searchStocks(q: string): Promise<StockSearchResult[]> {
  // First try normal backend search
  const { data } = await api.get<StockListResponse>('/stocks', { params: { search: q } })

  // If results found or not a pinyin-like query, return as-is
  if (data.stocks.length > 0 || !isPinyinQuery(q)) {
    return data.stocks
  }

  // For pinyin-like queries with no results, fetch all stocks and filter by pinyin
  const { data: allData } = await api.get<StockListResponse>('/stocks', { params: { limit: 10000 } })
  return allData.stocks.filter(stock => matchesPinyin(stock.name, q))
}

export async function getStockDetail(symbol: string): Promise<StockDetail> {
  const { data } = await api.get<StockDetail>(`/stocks/${symbol}`)
  return data
}
