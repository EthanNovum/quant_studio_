export interface WatchlistItem {
  id: number
  symbol: string
  sort_order: number
  added_at: string
  stock_name: string | null
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

export interface WatchlistItemCreate {
  group_id: number
  symbol: string
}

export interface WatchlistGroupCreate {
  name: string
}

export interface ReorderItem {
  id: number
  group_id: number
  sort_order: number
}
