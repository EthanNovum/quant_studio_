import api from './api'

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

interface QuotesResponse {
  quotes: Quote[]
}

export async function getQuotes(symbol: string): Promise<Quote[]> {
  const { data } = await api.get<QuotesResponse>(`/stocks/${symbol}/quotes`)
  return data.quotes
}
