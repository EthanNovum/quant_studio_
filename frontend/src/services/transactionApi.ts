import api from './api'

export interface Trade {
  id: number
  code: string
  name?: string
  action: 'BUY' | 'SELL' | 'DIVIDEND'
  price: number
  quantity: number
  date: string
  reason?: string
  commission?: number
  created_at?: string
}

export interface TradeCreate {
  code: string
  action: 'BUY' | 'SELL' | 'DIVIDEND'
  price: number
  quantity: number
  date: string
  reason?: string
  commission?: number
}

export interface Position {
  code: string
  name?: string
  quantity: number
  avg_cost: number
  current_price?: number
  unrealized_pnl?: number
  unrealized_pnl_pct?: number
  realized_pnl?: number
}

export async function getTrades(): Promise<Trade[]> {
  const { data } = await api.get('/trades')
  return data
}

export async function createTrade(trade: TradeCreate): Promise<Trade> {
  const { data } = await api.post('/trades', trade)
  return data
}

export async function deleteTrade(id: number): Promise<void> {
  await api.delete(`/trades/${id}`)
}

export async function getPositions(): Promise<Position[]> {
  const { data } = await api.get('/trades/positions')
  return data
}

export async function getStockPrice(code: string): Promise<number | null> {
  try {
    const { data } = await api.get(`/trades/stock-price/${code}`)
    return data.price
  } catch {
    return null
  }
}
