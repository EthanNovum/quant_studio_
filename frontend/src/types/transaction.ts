export interface Transaction {
  id: number
  symbol: string
  action: 'BUY' | 'SELL' | 'DIVIDEND'
  price: number
  quantity: number
  date: string
  reason: string | null
  commission: number
  created_at: string
  stock_name: string | null
}

export interface TransactionCreate {
  symbol: string
  action: 'BUY' | 'SELL' | 'DIVIDEND'
  price: number
  quantity: number
  date: string
  reason?: string
  commission?: number
}

export interface TransactionUpdate {
  price?: number
  quantity?: number
  date?: string
  reason?: string
  commission?: number
}

export interface Position {
  symbol: string
  name: string | null
  quantity: number
  avg_cost: number
  current_price: number | null
  unrealized_pnl: number | null
  unrealized_pnl_pct: number | null
  realized_pnl: number
}

export interface TransactionsResponse {
  transactions: Transaction[]
}

export interface PositionsResponse {
  positions: Position[]
}
