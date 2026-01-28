import api from './api'

export interface WatchlistItem {
  id: number
  symbol: string
  sort_order: number
  added_at: string
  stock_name: string | null
  asset_type: string | null  // stock, etf, lof

  // Financial indicators
  latest_price: number | null
  price_change_pct: number | null
  dividend_yield: number | null
  pe_ttm: number | null
  pb: number | null
  market_cap: number | null

  // Sentiment stats
  mention_count: number
  last_mention_date: string | null
}

export interface WatchlistGroup {
  id: number
  name: string
  sort_order: number
  items: WatchlistItem[]
}

export interface WatchlistGroupsResponse {
  groups: WatchlistGroup[]
}

export async function getWatchlistGroups(): Promise<WatchlistGroup[]> {
  const { data } = await api.get<WatchlistGroupsResponse>('/watchlist/groups')
  return data.groups
}

export async function createGroup(name: string): Promise<WatchlistGroup> {
  const { data } = await api.post('/watchlist/groups', { name })
  return data
}

export async function deleteGroup(id: number): Promise<void> {
  await api.delete(`/watchlist/groups/${id}`)
}

export async function addItem(groupId: number, symbol: string): Promise<WatchlistItem> {
  const { data } = await api.post('/watchlist/items', { group_id: groupId, symbol })
  return data
}

export async function removeItem(id: number): Promise<void> {
  await api.delete(`/watchlist/items/${id}`)
}

export interface ReorderItem {
  id: number
  group_id: number
  sort_order: number
}

export async function reorderItems(items: ReorderItem[]): Promise<void> {
  await api.put('/watchlist/items/reorder', { items })
}
