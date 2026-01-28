import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, FileText, ArrowLeft, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getStatsByStock, getSyncStatus } from '@/services/sentimentApi'
import { getQuotes } from '@/services/quoteApi'

export default function SentimentSymbols() {
  const { data: stockStats, isLoading } = useQuery({
    queryKey: ['stats-by-stock'],
    queryFn: getStatsByStock,
  })

  // Get sync status for last sentiment update time
  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: getSyncStatus,
  })

  // Get latest quote date as price update time (use first stock if available)
  const firstSymbol = stockStats?.[0]?.symbol
  const { data: quotesData } = useQuery({
    queryKey: ['quotes-for-date', firstSymbol],
    queryFn: () => getQuotes(firstSymbol!),
    enabled: !!firstSymbol,
  })

  const latestQuoteDate = quotesData && quotesData.length > 0
    ? quotesData[quotesData.length - 1].date
    : null

  const lastSyncTime = syncStatus?.last_sync_at
    ? new Date(syncStatus.last_sync_at).toLocaleDateString('zh-CN')
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/sentiment">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">股票列表</h1>
            <p className="text-sm text-muted-foreground">
              共 {stockStats?.length || 0} 只股票
            </p>
          </div>
        </div>

        {/* Update times */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {latestQuoteDate && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              行情: {latestQuoteDate}
            </span>
          )}
          {lastSyncTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              舆情: {lastSyncTime}
            </span>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!stockStats || stockStats.length === 0) && (
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <div className="text-muted-foreground">暂无股票数据</div>
          <p className="text-sm text-muted-foreground">
            请先爬取文章并进行股票标注
          </p>
          <Link to="/settings">
            <Button variant="outline">前往设置</Button>
          </Link>
        </div>
      )}

      {/* Stocks grid - horizontal cards */}
      {stockStats && stockStats.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stockStats.map((stock) => {
            const isUp = stock.price_change_pct && stock.price_change_pct > 0
            const isDown = stock.price_change_pct && stock.price_change_pct < 0
            const priceChangeColor = isUp ? 'text-red-500' : isDown ? 'text-green-500' : ''

            return (
              <Link
                key={stock.symbol}
                to={`/search/${stock.symbol}`}
                className="block"
              >
                <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Stock icon - red up or green down */}
                      <div className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-lg ${
                        isUp ? 'bg-red-500/10' : isDown ? 'bg-green-500/10' : 'bg-muted'
                      }`}>
                        {isUp ? (
                          <TrendingUp className="h-5 w-5 text-red-500" />
                        ) : isDown ? (
                          <TrendingDown className="h-5 w-5 text-green-500" />
                        ) : (
                          <TrendingUp className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {/* Symbol and article count */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="font-bold">{stock.symbol}</h3>
                          <Badge variant="secondary" className="gap-1 shrink-0">
                            <FileText className="h-3 w-3" />
                            {stock.count}
                          </Badge>
                        </div>
                        {/* Full name */}
                        {stock.name && (
                          <p className="text-sm text-muted-foreground truncate mb-1">
                            {stock.name}
                          </p>
                        )}
                        {/* Price on separate line */}
                        {stock.latest_price ? (
                          <div className={`text-sm font-medium ${priceChangeColor}`}>
                            {stock.latest_price.toFixed(2)}
                            {stock.price_change_pct !== null && (
                              <span className="ml-2">
                                {stock.price_change_pct > 0 ? '+' : ''}{stock.price_change_pct.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">暂无行情</div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
