export interface Stock {
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

export interface StockDetail extends Stock {
  latest_quote: LatestQuote | null
  danger_reasons: string[]
}

export interface StockListResponse {
  stocks: Stock[]
  total: number
  page: number
  limit: number
}
