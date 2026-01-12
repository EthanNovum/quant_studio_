import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, FolderPlus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import KLineChart from '@/components/charts/KLineChart'
import ChartHeader from '@/components/charts/ChartHeader'
import StockSearch from '@/components/stocks/StockSearch'
import {
  getWatchlistGroups,
  createGroup,
  deleteGroup,
  addItem,
  removeItem,
  type WatchlistGroup,
} from '@/services/watchlistApi'
import { getQuotes } from '@/services/quoteApi'
import { useToastStore } from '@/store'

export default function Watchlist() {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null)
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [addingToGroup, setAddingToGroup] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<WatchlistGroup | null>(null)

  const { data: groups, isLoading } = useQuery({
    queryKey: ['watchlist-groups'],
    queryFn: getWatchlistGroups,
  })

  const { data: quotesData } = useQuery({
    queryKey: ['quotes', selectedSymbol],
    queryFn: () => getQuotes(selectedSymbol!),
    enabled: !!selectedSymbol,
  })

  const createGroupMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-groups'] })
      setIsNewGroupOpen(false)
      setNewGroupName('')
      addToast({ title: '分组已创建' })
    },
  })

  const deleteGroupMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-groups'] })
      setDeleteConfirm(null)
      addToast({ title: '分组已删除' })
    },
  })

  const addItemMutation = useMutation({
    mutationFn: ({ groupId, symbol }: { groupId: number; symbol: string }) => addItem(groupId, symbol),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-groups'] })
      setAddingToGroup(null)
      addToast({ title: '已添加到自选' })
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      const message = error.response?.data?.detail || '添加失败'
      addToast({ title: message, variant: 'destructive' })
    },
  })

  const removeItemMutation = useMutation({
    mutationFn: removeItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-groups'] })
    },
  })

  // Get latest quote for chart header
  const latestQuote = quotesData && quotesData.length > 0 ? quotesData[quotesData.length - 1] : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">自选股</h1>
        <Button onClick={() => setIsNewGroupOpen(true)}>
          <FolderPlus className="mr-2 h-4 w-4" />
          新建分组
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Groups list */}
        <div className="space-y-4 lg:col-span-1">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">加载中...</div>
          ) : (
            <>
              {/* Groups */}
              {groups?.map((group) => (
                <Card key={group.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setAddingToGroup(group.id)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(group)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {group.items.length === 0 ? (
                      <div className="py-2 text-sm text-muted-foreground">空</div>
                    ) : (
                      group.items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex cursor-pointer items-center justify-between rounded px-2 py-1.5 hover:bg-accent ${
                            selectedSymbol === item.symbol ? 'bg-accent' : ''
                          }`}
                          onClick={() => setSelectedSymbol(item.symbol)}
                        >
                          <div>
                            <span className="font-medium">{item.symbol}</span>
                            {item.stock_name && (
                              <span className="ml-2 text-sm text-muted-foreground">{item.stock_name}</span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeItemMutation.mutate(item.id)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ))}

              {(!groups || groups.length === 0) && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    暂无自选股，点击"新建分组"开始
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Chart area */}
        <div className="lg:col-span-2">
          {selectedSymbol && quotesData ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedSymbol}</CardTitle>
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
                {quotesData.length > 0 && <KLineChart data={quotesData} />}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex h-96 items-center justify-center text-muted-foreground">
                选择一只股票查看K线图
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* New group dialog */}
      <Dialog open={isNewGroupOpen} onOpenChange={setIsNewGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建分组</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="分组名称"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewGroupOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => createGroupMutation.mutate(newGroupName)}
              disabled={!newGroupName || createGroupMutation.isPending}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add stock dialog */}
      <Dialog open={addingToGroup !== null} onOpenChange={() => setAddingToGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加股票</DialogTitle>
          </DialogHeader>
          <StockSearch
            onSelect={(stock) => {
              if (addingToGroup !== null) {
                addItemMutation.mutate({
                  groupId: addingToGroup,
                  symbol: stock.code,
                })
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p>确定要删除分组 "{deleteConfirm?.name}" 吗？此操作无法撤销。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteGroupMutation.mutate(deleteConfirm.id)}
              disabled={deleteGroupMutation.isPending}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
