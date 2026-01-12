export interface Quote {
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

export interface QuotesResponse {
  quotes: Quote[]
}
