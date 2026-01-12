import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getTrades, deleteTrade } from '@/services/transactionApi'
import { useToastStore } from '@/store'
import { formatNumber } from '@/lib/utils'

export default function TransactionList() {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const { data, isLoading } = useQuery({
    queryKey: ['trades'],
    queryFn: getTrades,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      addToast({ title: '记录已删除' })
    },
  })

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'BUY':
        return <span className="text-up">买入</span>
      case 'SELL':
        return <span className="text-down">卖出</span>
      case 'DIVIDEND':
        return <span className="text-primary">分红</span>
      default:
        return action
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>交易流水</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">加载中...</div>
        ) : !data?.length ? (
          <div className="py-8 text-center text-muted-foreground">暂无交易记录</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>代码</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>操作</TableHead>
                <TableHead className="text-right">价格</TableHead>
                <TableHead className="text-right">数量</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                  <TableCell className="font-medium">{tx.code}</TableCell>
                  <TableCell>{tx.name || '-'}</TableCell>
                  <TableCell>{getActionLabel(tx.action)}</TableCell>
                  <TableCell className="text-right">{formatNumber(tx.price)}</TableCell>
                  <TableCell className="text-right">{tx.quantity}</TableCell>
                  <TableCell className="text-right">{formatNumber(tx.price * tx.quantity)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(tx.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
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
