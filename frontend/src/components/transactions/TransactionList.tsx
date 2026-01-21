import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Pencil, MessageSquare } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getTrades, deleteTrade, updateTrade, type Trade } from '@/services/transactionApi'
import { useToastStore } from '@/store'
import { formatNumber } from '@/lib/utils'

export default function TransactionList() {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const [editingTrade, setEditingTrade] = useState<Trade | null>(null)
  const [editForm, setEditForm] = useState({
    price: '',
    quantity: '',
    date: '',
    reason: '',
  })

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateTrade>[1] }) =>
      updateTrade(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['positions'] })
      setEditingTrade(null)
      addToast({ title: '记录已更新' })
    },
    onError: () => {
      addToast({ title: '更新失败', variant: 'destructive' })
    },
  })

  const handleEdit = (trade: Trade) => {
    setEditingTrade(trade)
    setEditForm({
      price: trade.price.toString(),
      quantity: trade.quantity.toString(),
      date: trade.date,
      reason: trade.reason || '',
    })
  }

  const handleSave = () => {
    if (!editingTrade) return
    updateMutation.mutate({
      id: editingTrade.id,
      data: {
        price: parseFloat(editForm.price),
        quantity: parseFloat(editForm.quantity),
        date: editForm.date,
        reason: editForm.reason || undefined,
      },
    })
  }

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
    <>
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
            <TooltipProvider>
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
                      <TableCell className="text-right">{formatNumber(tx.price, 3)}</TableCell>
                      <TableCell className="text-right">{tx.quantity}</TableCell>
                      <TableCell className="text-right">{formatNumber(tx.price * tx.quantity, 3)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {tx.reason && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <p className="text-sm">{tx.reason}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(tx)}
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => deleteMutation.mutate(tx.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editingTrade !== null} onOpenChange={() => setEditingTrade(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              编辑交易记录 - {editingTrade?.code} {editingTrade?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>价格</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>数量</Label>
                <Input
                  type="number"
                  step="100"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>日期</Label>
              <Input
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>交易理由</Label>
              <textarea
                className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={editForm.reason}
                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTrade(null)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
