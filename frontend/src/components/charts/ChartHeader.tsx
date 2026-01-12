import { formatNumber, formatLargeNumber } from '@/lib/utils'
import type { LatestQuote } from '@/types'

interface ChartHeaderProps {
  quote: LatestQuote | null
}

export default function ChartHeader({ quote }: ChartHeaderProps) {
  if (!quote) {
    return (
      <div className="mb-4 grid grid-cols-5 gap-4 rounded-lg bg-card p-4">
        <div className="text-center text-muted-foreground">暂无数据</div>
      </div>
    )
  }

  const indicators = [
    { label: '今开', value: formatNumber(quote.open) },
    { label: '最高', value: formatNumber(quote.high) },
    { label: '最低', value: formatNumber(quote.low) },
    { label: '换手率', value: quote.turnover_rate ? `${quote.turnover_rate.toFixed(2)}%` : '-' },
    { label: '市盈率(TTM)', value: quote.pe_ttm ? formatNumber(quote.pe_ttm) : '-' },
    { label: '市净率', value: quote.pb ? formatNumber(quote.pb) : '-' },
    { label: '成交量', value: formatLargeNumber(quote.volume) },
    { label: '成交额', value: formatLargeNumber(quote.turnover) },
    { label: '市值', value: formatLargeNumber(quote.market_cap) },
  ]

  return (
    <div className="mb-4 grid grid-cols-3 gap-x-6 gap-y-2 rounded-lg bg-card p-4 md:grid-cols-5 lg:grid-cols-9">
      {indicators.map((item) => (
        <div key={item.label} className="text-center">
          <div className="text-xs text-muted-foreground">{item.label}</div>
          <div className="text-sm font-medium">{item.value}</div>
        </div>
      ))}
    </div>
  )
}
