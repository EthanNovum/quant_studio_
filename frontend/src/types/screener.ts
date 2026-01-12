import type { Stock } from './stock'

export interface FilterCriteria {
  field: string
  operator: string
  value: string | number | number[]
}

export interface SavedScreener {
  id: number
  name: string
  criteria_json: string
  created_at: string
  updated_at: string
}

export interface ScreenersResponse {
  screeners: SavedScreener[]
}

export interface ScreenerExecuteRequest {
  filters: FilterCriteria[]
  exclude_negative: boolean
  page: number
  limit: number
}

export interface ScreenerExecuteResponse {
  results: Stock[]
  total: number
}
