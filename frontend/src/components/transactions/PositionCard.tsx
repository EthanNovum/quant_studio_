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
      <CardHeader>
        <CardTitle>当前持仓</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">加载中...</div>
        ) : !data?.length ? (
          <div className="py-8 text-center text-muted-foreground">暂无持仓</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>代码</TableHead>
                <TableHead>名称</TableHead>
                <TableHead className="text-right">持仓量</TableHead>
                <TableHead className="text-right">平均成本</TableHead>
                <TableHead className="text-right">现价</TableHead>
                <TableHead className="text-right">浮动盈亏</TableHead>
                <TableHead className="text-right">盈亏率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((pos) => (
                <TableRow key={pos.code}>
                  <TableCell className="font-medium">{pos.code}</TableCell>
                  <TableCell>{pos.name || '-'}</TableCell>
                  <TableCell className="text-right">{pos.quantity}</TableCell>
                  <TableCell className="text-right">{formatNumber(pos.avg_cost)}</TableCell>
                  <TableCell className="text-right">{pos.current_price ? formatNumber(pos.current_price) : '-'}</TableCell>
                  <TableCell className={`text-right ${getPriceColorClass(pos.unrealized_pnl)}`}>
                    {pos.unrealized_pnl !== undefined ? formatNumber(pos.unrealized_pnl) : '-'}
                  </TableCell>
                  <TableCell className={`text-right ${getPriceColorClass(pos.unrealized_pnl_pct)}`}>
                    {pos.unrealized_pnl_pct !== undefined ? formatPercent(pos.unrealized_pnl_pct) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
