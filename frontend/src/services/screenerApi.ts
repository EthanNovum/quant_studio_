import api from './api'

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

export interface ScreenerResult {
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

export interface ScreenerExecuteResponse {
  results: ScreenerResult[]
  total: number
}

export async function executeScreener(params: {
  filters: FilterCriteria[]
  exclude_negative?: boolean
  page?: number
  limit?: number
}): Promise<ScreenerExecuteResponse> {
  const { data } = await api.post<ScreenerExecuteResponse>('/screener/execute', {
    filters: params.filters,
    exclude_negative: params.exclude_negative ?? false,
    page: params.page ?? 1,
    limit: params.limit ?? 50,
  })
  return data
}

export async function getIndustries(): Promise<string[]> {
  const { data } = await api.get<string[]>('/screener/industries')
  return data
}

export async function getSavedScreeners(): Promise<SavedScreener[]> {
  const { data } = await api.get<{ screeners: SavedScreener[] }>('/screeners')
  return data.screeners
}

export async function saveScreener(name: string, criteriaJson: string): Promise<SavedScreener> {
  const { data } = await api.post<SavedScreener>('/screeners', { name, criteria_json: criteriaJson })
  return data
}

export async function deleteScreener(id: number): Promise<void> {
  await api.delete(`/screeners/${id}`)
}
