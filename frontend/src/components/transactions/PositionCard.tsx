import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getPositions } from '@/services/transactionApi'
import { formatNumber, formatPercent, getPriceColorClass } from '@/lib/utils'

export default function PositionCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['positions'],
    queryFn: getPositions,
  })

  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-6">
        <CardTitle className="text-base sm:text-lg">当前持仓</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">加载中...</div>
        ) : !data?.length ? (
          <div className="py-8 text-center text-muted-foreground">暂无持仓</div>
        ) : (
          /* Scrollable table container for mobile */
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap text-xs sm:text-sm">代码</TableHead>
                  <TableHead className="whitespace-nowrap text-xs sm:text-sm hidden sm:table-cell">名称</TableHead>
                  <TableHead className="whitespace-nowrap text-xs sm:text-sm text-right">持仓量</TableHead>
                  <TableHead className="whitespace-nowrap text-xs sm:text-sm text-right hidden md:table-cell">平均成本</TableHead>
                  <TableHead className="whitespace-nowrap text-xs sm:text-sm text-right">现价</TableHead>
                  <TableHead className="whitespace-nowrap text-xs sm:text-sm text-right hidden sm:table-cell">浮动盈亏</TableHead>
                  <TableHead className="whitespace-nowrap text-xs sm:text-sm text-right">盈亏率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((pos) => (
                  <TableRow key={pos.code}>
                    <TableCell className="font-medium text-xs sm:text-sm">{pos.code}</TableCell>
                    <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{pos.name || '-'}</TableCell>
                    <TableCell className="text-right text-xs sm:text-sm">{pos.quantity}</TableCell>
                    <TableCell className="text-right text-xs sm:text-sm hidden md:table-cell">{formatNumber(pos.avg_cost, 3)}</TableCell>
                    <TableCell className="text-right text-xs sm:text-sm">{pos.current_price ? formatNumber(pos.current_price, 3) : '-'}</TableCell>
                    <TableCell className={`text-right text-xs sm:text-sm hidden sm:table-cell ${getPriceColorClass(pos.unrealized_pnl)}`}>
                      {pos.unrealized_pnl !== undefined ? formatNumber(pos.unrealized_pnl) : '-'}
                    </TableCell>
                    <TableCell className={`text-right text-xs sm:text-sm ${getPriceColorClass(pos.unrealized_pnl_pct)}`}>
                      {pos.unrealized_pnl_pct !== undefined ? formatPercent(pos.unrealized_pnl_pct) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
