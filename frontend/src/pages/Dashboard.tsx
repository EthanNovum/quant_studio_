import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Wallet, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPositions, getTrades } from '@/services/transactionApi'
import { formatNumber, formatPercent, formatLargeNumber } from '@/lib/utils'

export default function Dashboard() {
  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: getPositions,
  })

  const { data: trades } = useQuery({
    queryKey: ['trades'],
    queryFn: getTrades,
  })

  const positionsList = positions || []
  const tradesList = trades || []

  // Calculate summary stats
  const totalValue = positionsList.reduce(
    (sum, p) => sum + (p.current_price || p.avg_cost) * p.quantity,
    0
  )
  const totalCost = positionsList.reduce((sum, p) => sum + p.avg_cost * p.quantity, 0)
  const totalPnL = positionsList.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0)
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0

  const recentTrades = tradesList.slice(0, 5)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">仪表盘</h1>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">持仓市值</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLargeNumber(totalValue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">持仓成本</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLargeNumber(totalCost)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">浮动盈亏</CardTitle>
            {totalPnL >= 0 ? (
              <TrendingUp className="h-4 w-4 text-up" />
            ) : (
              <TrendingDown className="h-4 w-4 text-down" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-up' : 'text-down'}`}>
              {formatNumber(totalPnL)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">收益率</CardTitle>
            {totalPnLPct >= 0 ? (
              <TrendingUp className="h-4 w-4 text-up" />
            ) : (
              <TrendingDown className="h-4 w-4 text-down" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnLPct >= 0 ? 'text-up' : 'text-down'}`}>
              {formatPercent(totalPnLPct)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Positions */}
        <Card>
          <CardHeader>
            <CardTitle>当前持仓</CardTitle>
          </CardHeader>
          <CardContent>
            {positionsList.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">暂无持仓</div>
            ) : (
              <div className="space-y-4">
                {positionsList.map((pos) => (
                  <div key={pos.code} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{pos.code}</div>
                      <div className="text-sm text-muted-foreground">{pos.name}</div>
                    </div>
                    <div className="text-right">
                      <div className={pos.unrealized_pnl_pct && pos.unrealized_pnl_pct >= 0 ? 'text-up' : 'text-down'}>
                        {formatPercent(pos.unrealized_pnl_pct)}
                      </div>
                      <div className="text-sm text-muted-foreground">{formatNumber(pos.unrealized_pnl)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent trades */}
        <Card>
          <CardHeader>
            <CardTitle>最近交易</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTrades.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">暂无交易记录</div>
            ) : (
              <div className="space-y-4">
                {recentTrades.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{tx.code}</div>
                      <div className="text-sm text-muted-foreground">{tx.date}</div>
                    </div>
                    <div className="text-right">
                      <div className={tx.action === 'BUY' ? 'text-up' : tx.action === 'SELL' ? 'text-down' : ''}>
                        {tx.action === 'BUY' ? '买入' : tx.action === 'SELL' ? '卖出' : '分红'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatNumber(tx.price)} x {tx.quantity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
