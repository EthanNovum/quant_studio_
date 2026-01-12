export interface Progress {
  is_running: boolean
  mode: string
  current: number
  total: number
  current_symbol: string
  started_at: string | null
  updated_at: string | null
}
