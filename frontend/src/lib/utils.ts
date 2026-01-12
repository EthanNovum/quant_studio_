import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined) return '-'
  return value.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatLargeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}万亿`
  if (value >= 1e8) return `${(value / 1e8).toFixed(2)}亿`
  if (value >= 1e4) return `${(value / 1e4).toFixed(2)}万`
  return value.toLocaleString('zh-CN')
}

export function getPriceColorClass(change: number | null | undefined): string {
  if (change === null || change === undefined || change === 0) return 'price-unchanged'
  return change > 0 ? 'price-up' : 'price-down'
}
