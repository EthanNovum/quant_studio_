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
import { Plus, Trash2, FolderPlus, GripVertical, TrendingUp, ExternalLink, Newspaper, Calendar, Tag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import EChartsKLine from '@/components/charts/EChartsKLine'
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
import { getSentimentMarkers, getStockAliases, createAlias } from '@/services/sentimentApi'
import { getStockPrice } from '@/services/transactionApi'
import { useToastStore } from '@/store'

// Format market cap
function formatMarketCap(value: number | null): string {
  if (!value) return '-'
  if (value >= 100000000) {
    return (value / 100000000).toFixed(2) + '亿'
  } else if (value >= 10000) {
    return (value / 10000).toFixed(2) + '万'
  }
  return value.toFixed(2)
}

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
  const priceChangeColor = item.price_change_pct
    ? item.price_change_pct > 0 ? 'text-red-500' : item.price_change_pct < 0 ? 'text-green-500' : ''
    : ''

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between rounded px-2 py-2 hover:bg-accent ${
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
            {/* Price and change */}
            {item.latest_price && (
              <span className={`text-sm font-medium ${priceChangeColor}`}>
                {item.latest_price.toFixed(2)}
                {item.price_change_pct !== null && (
                  <span className="ml-1">
                    ({item.price_change_pct > 0 ? '+' : ''}{item.price_change_pct.toFixed(2)}%)
                  </span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {item.stock_name && (
              <span className="truncate max-w-[80px]">{item.stock_name}</span>
            )}
            {/* Sentiment info */}
            {item.mention_count > 0 && (
              <span className="flex items-center gap-0.5 text-blue-500">
                <Newspaper className="h-3 w-3" />
                提及{item.mention_count}次
              </span>
            )}
          </div>
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
  const [addAliasOpen, setAddAliasOpen] = useState(false)
  const [newAlias, setNewAlias] = useState('')

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

  const { data: sentimentData } = useQuery({
    queryKey: ['sentiment-markers', selectedItem?.symbol],
    queryFn: () => getSentimentMarkers(selectedItem!.symbol),
    enabled: !!selectedItem,
  })

  const { data: aliasesData } = useQuery({
    queryKey: ['stock-aliases', selectedItem?.symbol],
    queryFn: () => getStockAliases(selectedItem!.symbol),
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

  const addAliasMutation = useMutation({
    mutationFn: ({ symbol, alias }: { symbol: string; alias: string }) =>
      createAlias(symbol, alias),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-aliases', selectedItem?.symbol] })
      setAddAliasOpen(false)
      setNewAlias('')
      addToast({ title: '别名已添加' })
    },
    onError: () => {
      addToast({ title: '添加别名失败', variant: 'destructive' })
    },
  })

  const handleAddAlias = () => {
    if (selectedItem && newAlias.trim()) {
      addAliasMutation.mutate({ symbol: selectedItem.symbol, alias: newAlias.trim() })
    }
  }

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
        <div className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start space-y-4">
          {selectedItem && quotesData ? (
            <>
              {/* Stock header with sentiment info */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {selectedItem.symbol} {selectedItem.stock_name}
                      {selectedItem.asset_type && selectedItem.asset_type !== 'stock' && (
                        <Badge variant="secondary">{selectedItem.asset_type.toUpperCase()}</Badge>
                      )}
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={() => handleDetails(selectedItem)}>
                      查看详情
                    </Button>
                  </div>
                  {/* Sentiment info line */}
                  {selectedItem.mention_count > 0 && (
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <Newspaper className="h-4 w-4 text-blue-500" />
                        提及 {selectedItem.mention_count} 次
                      </span>
                      {selectedItem.last_mention_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          最近提及 {selectedItem.last_mention_date}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Aliases display */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    {aliasesData && aliasesData.aliases.length > 0 ? (
                      aliasesData.aliases.map((alias, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {alias}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">暂无别名</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setAddAliasOpen(true)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      添加别名
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Financial indicators grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-3 rounded-lg bg-accent/30">
                      <div className="text-xs text-muted-foreground mb-1">最新价</div>
                      <div className={`text-lg font-bold ${
                        selectedItem.price_change_pct
                          ? selectedItem.price_change_pct > 0 ? 'text-red-500' : selectedItem.price_change_pct < 0 ? 'text-green-500' : ''
                          : ''
                      }`}>
                        {selectedItem.latest_price?.toFixed(2) || '-'}
                      </div>
                      {selectedItem.price_change_pct !== null && (
                        <div className={`text-xs ${
                          selectedItem.price_change_pct > 0 ? 'text-red-500' : selectedItem.price_change_pct < 0 ? 'text-green-500' : ''
                        }`}>
                          {selectedItem.price_change_pct > 0 ? '+' : ''}{selectedItem.price_change_pct.toFixed(2)}%
                        </div>
                      )}
                    </div>
                    <div className="text-center p-3 rounded-lg bg-accent/30">
                      <div className="text-xs text-muted-foreground mb-1">PE (TTM)</div>
                      <div className="text-lg font-bold">
                        {selectedItem.pe_ttm?.toFixed(2) || '-'}
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-accent/30">
                      <div className="text-xs text-muted-foreground mb-1">PB</div>
                      <div className="text-lg font-bold">
                        {selectedItem.pb?.toFixed(2) || '-'}
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-accent/30">
                      <div className="text-xs text-muted-foreground mb-1">股息率</div>
                      <div className="text-lg font-bold">
                        {selectedItem.dividend_yield ? `${selectedItem.dividend_yield.toFixed(2)}%` : '-'}
                      </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-accent/30">
                      <div className="text-xs text-muted-foreground mb-1">市值</div>
                      <div className="text-lg font-bold">
                        {formatMarketCap(selectedItem.market_cap)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* K-Line Chart with sentiment markers */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    K线图
                    {sentimentData && sentimentData.markers.length > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        (点击蓝点查看相关舆情)
                      </span>
                    )}
                  </CardTitle>
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
                  {quotesData.length > 0 ? (
                    <EChartsKLine
                      data={quotesData}
                      sentimentMarkers={sentimentData?.markers}
                      height={400}
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center text-muted-foreground">
                      暂无行情数据
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex h-96 items-center justify-center text-muted-foreground">
                选择一只股票查看K线图和财务指标
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

      {/* Add alias dialog */}
      <Dialog open={addAliasOpen} onOpenChange={setAddAliasOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              为 {selectedItem?.symbol} {selectedItem?.stock_name && `(${selectedItem.stock_name})`} 添加别名
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="输入别名（如：茅台、宁王）"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newAlias.trim()) {
                  handleAddAlias()
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              添加别名后，系统可自动识别文章中出现的该别名并关联到此股票
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAliasOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleAddAlias}
              disabled={!newAlias.trim() || addAliasMutation.isPending}
            >
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
