import api from './api'

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

export async function searchStocks(q: string): Promise<StockSearchResult[]> {
  const { data } = await api.get<StockListResponse>('/stocks', { params: { search: q } })
  return data.stocks
}

export async function getStockDetail(symbol: string): Promise<StockDetail> {
  const { data } = await api.get<StockDetail>(`/stocks/${symbol}`)
  return data
}
