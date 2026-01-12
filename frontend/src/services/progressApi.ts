import api from './api'
import type { Progress } from '@/types'

export async function getProgress(): Promise<Progress> {
  const { data } = await api.get('/progress')
  return data
}
