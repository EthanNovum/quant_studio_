import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Trash2, FolderPlus, GripVertical, TrendingUp, ExternalLink } from 'lucide-react'
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
  reorderItems,
  type WatchlistGroup,
  type WatchlistItem,
} from '@/services/watchlistApi'
import { getQuotes } from '@/services/quoteApi'
import { getStockPrice } from '@/services/transactionApi'
import { useToastStore } from '@/store'

interface SortableItemProps {
  item: WatchlistItem
  isSelected: boolean
  onSelect: () => void
  onRemove: () => void
  onTrade: () => void
  onDetails: () => void
}

function SortableItem({ item, isSelected, onSelect, onRemove, onTrade, onDetails }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const getAssetTypeLabel = (assetType: string | null) => {
    if (!assetType || assetType === 'stock') return null
    if (assetType === 'etf') return 'ETF'
    if (assetType === 'lof') return 'LOF'
    return assetType.toUpperCase()
  }

  const assetLabel = getAssetTypeLabel(item.asset_type)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between rounded px-2 py-1.5 hover:bg-accent ${
        isSelected ? 'bg-accent' : ''
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={onSelect}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.symbol}</span>
            {assetLabel && (
              <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-400/30">
                {assetLabel}
              </span>
            )}
          </div>
          {item.stock_name && (
            <span className="text-sm text-muted-foreground truncate block">{item.stock_name}</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation()
            onTrade()
          }}
          title="交易"
        >
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation()
            onDetails()
          }}
          title="详情"
        >
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          title="删除"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    </div>
  )
}

function DragOverlayItem({ item }: { item: WatchlistItem }) {
  const getAssetTypeLabel = (assetType: string | null) => {
    if (!assetType || assetType === 'stock') return null
    if (assetType === 'etf') return 'ETF'
    if (assetType === 'lof') return 'LOF'
    return assetType.toUpperCase()
  }

  const assetLabel = getAssetTypeLabel(item.asset_type)

  return (
    <div className="flex items-center gap-2 rounded bg-accent px-2 py-1.5 shadow-lg">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.symbol}</span>
          {assetLabel && (
            <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
              {assetLabel}
            </span>
          )}
        </div>
        {item.stock_name && (
          <span className="text-sm text-muted-foreground">{item.stock_name}</span>
        )}
      </div>
    </div>
  )
}

export default function Watchlist() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const [selectedItem, setSelectedItem] = useState<WatchlistItem | null>(null)
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [addingToGroup, setAddingToGroup] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<WatchlistGroup | null>(null)
  const [activeItem, setActiveItem] = useState<WatchlistItem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const { data: groups, isLoading } = useQuery({
    queryKey: ['watchlist-groups'],
    queryFn: getWatchlistGroups,
  })

  const { data: quotesData } = useQuery({
    queryKey: ['quotes', selectedItem?.symbol],
    queryFn: () => getQuotes(selectedItem!.symbol),
    enabled: !!selectedItem,
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

  const reorderMutation = useMutation({
    mutationFn: reorderItems,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist-groups'] })
    },
  })

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const allItems = groups?.flatMap(g => g.items) || []
    const item = allItems.find(i => i.id === active.id)
    if (item) {
      setActiveItem(item)
    }
  }

  const handleDragOver = (_event: DragOverEvent) => {
    // Handle drag over for visual feedback if needed
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveItem(null)

    if (!over || !groups) return

    const activeId = active.id as number
    const overId = over.id as number

    // Find the source group and item
    let sourceGroup: WatchlistGroup | undefined
    let sourceItem: WatchlistItem | undefined
    for (const group of groups) {
      const item = group.items.find(i => i.id === activeId)
      if (item) {
        sourceGroup = group
        sourceItem = item
        break
      }
    }

    if (!sourceGroup || !sourceItem) return

    // Find the target group (where we're dropping)
    let targetGroup: WatchlistGroup | undefined
    let targetItemIndex = -1
    for (const group of groups) {
      const idx = group.items.findIndex(i => i.id === overId)
      if (idx !== -1) {
        targetGroup = group
        targetItemIndex = idx
        break
      }
    }

    // If dropping on a group header (no target item found), add to end of that group
    if (!targetGroup) {
      // Check if overId matches a group id
      targetGroup = groups.find(g => g.id === overId)
      if (targetGroup) {
        targetItemIndex = targetGroup.items.length
      }
    }

    if (!targetGroup) return

    // Build the reorder request
    const reorderData: { id: number; group_id: number; sort_order: number }[] = []

    if (sourceGroup.id === targetGroup.id) {
      // Same group reorder
      const items = [...sourceGroup.items]
      const oldIndex = items.findIndex(i => i.id === activeId)
      const newIndex = targetItemIndex

      if (oldIndex === newIndex) return

      // Remove and insert
      const [removed] = items.splice(oldIndex, 1)
      items.splice(newIndex > oldIndex ? newIndex : newIndex, 0, removed)

      // Build reorder data
      items.forEach((item, idx) => {
        reorderData.push({
          id: item.id,
          group_id: sourceGroup!.id,
          sort_order: idx,
        })
      })
    } else {
      // Cross-group move
      // Remove from source group
      const sourceItems = sourceGroup.items.filter(i => i.id !== activeId)
      sourceItems.forEach((item, idx) => {
        reorderData.push({
          id: item.id,
          group_id: sourceGroup!.id,
          sort_order: idx,
        })
      })

      // Add to target group
      const targetItems = [...targetGroup.items]
      targetItems.splice(targetItemIndex, 0, sourceItem)
      targetItems.forEach((item, idx) => {
        reorderData.push({
          id: item.id,
          group_id: targetGroup!.id,
          sort_order: idx,
        })
      })
    }

    reorderMutation.mutate(reorderData)
  }

  const handleTrade = async (item: WatchlistItem) => {
    const price = await getStockPrice(item.symbol)
    const params = new URLSearchParams({
      code: item.symbol,
      name: item.stock_name || '',
      price: price?.toString() || '',
    })
    navigate(`/trade_review?${params.toString()}`)
  }

  const handleDetails = (item: WatchlistItem) => {
    navigate(`/search/${item.symbol}`)
  }

  // Get latest quote for chart header
  const latestQuote = quotesData && quotesData.length > 0 ? quotesData[quotesData.length - 1] : null

  // Get all items for DndContext
  const allItems = groups?.flatMap(g => g.items) || []
  const allItemIds = allItems.map(i => i.id)

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
        <div className="space-y-4 lg:col-span-1 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">加载中...</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
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
                      <SortableContext
                        items={group.items.map(i => i.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {group.items.map((item) => (
                          <SortableItem
                            key={item.id}
                            item={item}
                            isSelected={selectedItem?.symbol === item.symbol}
                            onSelect={() => setSelectedItem(item)}
                            onRemove={() => removeItemMutation.mutate(item.id)}
                            onTrade={() => handleTrade(item)}
                            onDetails={() => handleDetails(item)}
                          />
                        ))}
                      </SortableContext>
                    )}
                  </CardContent>
                </Card>
              ))}

              <DragOverlay>
                {activeItem ? <DragOverlayItem item={activeItem} /> : null}
              </DragOverlay>

              {(!groups || groups.length === 0) && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    暂无自选股，点击"新建分组"开始
                  </CardContent>
                </Card>
              )}
            </DndContext>
          )}
        </div>

        {/* Chart area */}
        <div className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
          {selectedItem && quotesData ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedItem.symbol} {selectedItem.stock_name}</CardTitle>
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
