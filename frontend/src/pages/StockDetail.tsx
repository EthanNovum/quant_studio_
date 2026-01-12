import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import KLineChart from '@/components/charts/KLineChart'
import ChartHeader from '@/components/charts/ChartHeader'
import { getStockDetail } from '@/services/stockApi'
import { getQuotes } from '@/services/quoteApi'

export default function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>()

  const { data: stock, isLoading: stockLoading } = useQuery({
    queryKey: ['stock-detail', symbol],
    queryFn: () => getStockDetail(symbol!),
    enabled: !!symbol,
  })

  const { data: quotesData } = useQuery({
    queryKey: ['quotes', symbol],
    queryFn: () => getQuotes(symbol!),
    enabled: !!symbol,
  })

  if (stockLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (!stock) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">股票不存在或数据待更新</div>
      </div>
    )
  }

  const latestQuote = quotesData && quotesData.length > 0 ? quotesData[quotesData.length - 1] : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">
          {stock.symbol} - {stock.name}
        </h1>
      </div>

      {/* Danger warnings */}
      {stock.danger_reasons && stock.danger_reasons.length > 0 && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              风险提示
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm text-destructive">
              {stock.danger_reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle>基础信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm text-muted-foreground">行业</div>
              <div className="font-medium">{stock.industry || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">ROE</div>
              <div className="font-medium">{stock.roe ? `${stock.roe.toFixed(2)}%` : '-'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">上市日期</div>
              <div className="font-medium">{stock.listing_date || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">实控人</div>
              <div className="font-medium">{stock.controller || '-'}</div>
            </div>
          </div>
          {stock.description && (
            <div className="mt-4">
              <div className="text-sm text-muted-foreground">公司简介</div>
              <div className="mt-1 text-sm">{stock.description}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>K线图</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartHeader quote={latestQuote ? {
            date: latestQuote.date,
            open: latestQuote.open,
            high: latestQuote.high,
            low: latestQuote.low,
            close: latestQuote.close,
            volume: latestQuote.volume || null,
            turnover: latestQuote.turnover || null,
            turnover_rate: null,
            pe_ttm: null,
            pb: null,
            market_cap: null,
          } : null} />
          {quotesData && quotesData.length > 0 ? (
            <KLineChart data={quotesData} />
          ) : (
            <div className="flex h-96 items-center justify-center text-muted-foreground">
              暂无行情数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
