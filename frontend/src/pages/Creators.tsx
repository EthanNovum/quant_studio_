import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  User,
  Loader2,
  Plus,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToastStore } from '@/store'
import {
  getCreators,
  getSyncStatus,
  addCreator,
  deleteCreator,
  startCrawl,
  getArticleTimeRange,
} from '@/services/sentimentApi'

function formatDateTime(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).replace(/\//g, '-')
}

export default function Creators() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newCreatorLink, setNewCreatorLink] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [creatorToDelete, setCreatorToDelete] = useState<{ userId: string; nickname: string } | null>(null)
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncingCreatorId, setSyncingCreatorId] = useState<string | null>(null)

  const { data: creators, isLoading } = useQuery({
    queryKey: ['creators'],
    queryFn: getCreators,
  })

  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: getSyncStatus,
    refetchInterval: isSyncing ? 2000 : false,
  })

  const { data: articleTimeRange } = useQuery({
    queryKey: ['article-time-range'],
    queryFn: getArticleTimeRange,
  })

  const addCreatorMutation = useMutation({
    mutationFn: addCreator,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creators'] })
      setAddDialogOpen(false)
      setNewCreatorLink('')
      addToast({ title: '创作者已添加，下次同步时将抓取文章', type: 'success' })
    },
    onError: (error: any) => {
      const message = error?.response?.data?.detail || '添加失败'
      addToast({ title: message, type: 'error' })
    },
  })

  const deleteCreatorMutation = useMutation({
    mutationFn: deleteCreator,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creators'] })
      setDeleteDialogOpen(false)
      setCreatorToDelete(null)
      addToast({ title: '创作者已删除' })
    },
    onError: () => {
      addToast({ title: '删除失败', type: 'error' })
    },
  })

  const sortedCreators = useMemo(() => {
    if (!creators) return []
    return [...creators].sort((a, b) => {
      const aTime = a.last_crawled_at ? new Date(a.last_crawled_at).getTime() : 0
      const bTime = b.last_crawled_at ? new Date(b.last_crawled_at).getTime() : 0
      return bTime - aTime
    })
  }, [creators])

  const handleRowClick = (userId: string) => {
    navigate(`/creators/${userId}`)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked && creators) {
      setSelectedIds(new Set(creators.map((c) => c.user_id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (userId: string, checked: boolean) => {
    const newSet = new Set(selectedIds)
    if (checked) {
      newSet.add(userId)
    } else {
      newSet.delete(userId)
    }
    setSelectedIds(newSet)
  }

  const handleBatchDelete = async () => {
    const idsToDelete = Array.from(selectedIds)
    let successCount = 0
    let failCount = 0

    for (const id of idsToDelete) {
      try {
        await deleteCreator(id)
        successCount++
      } catch {
        failCount++
      }
    }

    queryClient.invalidateQueries({ queryKey: ['creators'] })
    setBatchDeleteDialogOpen(false)
    setSelectedIds(new Set())

    if (failCount === 0) {
      addToast({ title: `成功删除 ${successCount} 位创作者`, type: 'success' })
    } else {
      addToast({ title: `删除完成: ${successCount} 成功, ${failCount} 失败`, type: 'warning' })
    }
  }

  const handleSync = async (creatorIds?: string[]) => {
    try {
      if (creatorIds && creatorIds.length === 1) {
        setSyncingCreatorId(creatorIds[0])
      }
      setIsSyncing(true)
      await startCrawl({ creator_ids: creatorIds })
      addToast({ title: '同步任务已启动', type: 'success' })
    } catch (error: any) {
      const message = error?.response?.data?.detail || '同步启动失败'
      addToast({ title: message, type: 'error' })
    } finally {
      setSyncingCreatorId(null)
    }
  }

  const handleBatchSync = () => {
    if (selectedIds.size > 0) {
      handleSync(Array.from(selectedIds))
    } else {
      handleSync()
    }
  }

  // Export creators to JSON file
  const handleExport = () => {
    if (!creators || creators.length === 0) {
      addToast({ title: '没有可导出的创作者', type: 'error' })
      return
    }

    const creatorsToExport = selectedIds.size > 0
      ? creators.filter((c) => selectedIds.has(c.user_id))
      : creators

    const exportData = creatorsToExport.map((c) => ({
      user_link: c.user_link,
      user_nickname: c.user_nickname,
      url_token: c.url_token,
    }))

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `creators_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    addToast({ title: `已导出 ${creatorsToExport.length} 位创作者`, type: 'success' })
  }

  // Import creators from JSON file
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const importData = JSON.parse(text) as Array<{ user_link?: string; url_token?: string }>

      // Get existing url_tokens for deduplication
      const existingTokens = new Set(creators?.map((c) => c.url_token) || [])

      // Filter out duplicates
      const newCreators = importData.filter((item) => {
        const token = item.url_token || item.user_link?.split('/').pop()
        return token && !existingTokens.has(token)
      })

      if (newCreators.length === 0) {
        addToast({ title: '所有创作者已存在，无需导入', type: 'info' })
        setIsImporting(false)
        return
      }

      // Add new creators one by one
      let successCount = 0
      let failCount = 0

      for (const item of newCreators) {
        const link = item.user_link || `https://www.zhihu.com/people/${item.url_token}`
        try {
          await addCreator(link)
          successCount++
        } catch {
          failCount++
        }
      }

      queryClient.invalidateQueries({ queryKey: ['creators'] })

      if (failCount === 0) {
        addToast({ title: `成功导入 ${successCount} 位创作者`, type: 'success' })
      } else {
        addToast({ title: `导入完成: ${successCount} 成功, ${failCount} 失败`, type: 'warning' })
      }
    } catch (error) {
      addToast({ title: '导入失败，请检查文件格式', type: 'error' })
    } finally {
      setIsImporting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Calculate sync progress for a creator
  const getSyncProgress = (creator: typeof sortedCreators[0]) => {
    const totalArticles = creator.article_count + creator.answer_count
    if (totalArticles === 0) return { percent: 0, synced: 0, total: 0 }
    // For now, we assume all articles are synced if the creator has been crawled
    const synced = creator.last_crawled_at ? totalArticles : 0
    return {
      percent: totalArticles > 0 ? Math.round((synced / totalArticles) * 100) : 0,
      synced,
      total: totalArticles,
    }
  }

  // Format sync time range
  const syncTimeRange = articleTimeRange
    ? `${articleTimeRange.newest_date || ''} ~ ${articleTimeRange.oldest_date || ''}`
    : ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">创作者管理</h1>
        {syncTimeRange && (
          <div className="text-sm text-primary">
            同步范围: {syncTimeRange}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Add creator button */}
        <Button
          size="sm"
          onClick={() => setAddDialogOpen(true)}
          className="h-9 bg-blue-500 hover:bg-blue-600"
        >
          <UserPlus className="h-4 w-4 mr-1" />
          添加
        </Button>

        {/* Import button */}
        <Button
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="h-9 bg-blue-600 hover:bg-blue-700"
        >
          {isImporting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1" />
          )}
          批量导入
        </Button>

        {/* Export button */}
        <Button
          size="sm"
          onClick={handleExport}
          disabled={!creators || creators.length === 0}
          className="h-9 bg-blue-500 hover:bg-blue-600"
        >
          <Upload className="h-4 w-4 mr-1" />
          批量导出
        </Button>

        {/* Delete button */}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setBatchDeleteDialogOpen(true)}
          disabled={selectedIds.size === 0}
          className="h-9"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          删除
        </Button>

        {/* Sync button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleBatchSync}
          disabled={syncStatus?.is_running}
          className="h-9"
        >
          {syncStatus?.is_running ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          同步
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!creators || creators.length === 0) && (
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <div className="text-muted-foreground">暂无创作者</div>
          <p className="text-sm text-muted-foreground">
            点击"添加"按钮添加知乎创作者
          </p>
        </div>
      )}

      {/* Creators table */}
      {sortedCreators.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === creators?.length && creators.length > 0}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  />
                </TableHead>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead className="w-16">头像</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>最后同步时间</TableHead>
                <TableHead className="text-right">消息总数</TableHead>
                <TableHead className="text-right">已同步消息数</TableHead>
                <TableHead className="w-40">同步进度</TableHead>
                <TableHead className="w-20 text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCreators.map((creator, index) => {
                const progress = getSyncProgress(creator)
                const isCurrentlySyncing = syncingCreatorId === creator.user_id ||
                  (syncStatus?.is_running && syncStatus?.current_task?.includes(creator.user_id))

                return (
                  <TableRow
                    key={creator.user_id}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(creator.user_id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(creator.user_id)}
                        onCheckedChange={(checked) => handleSelectOne(creator.user_id, !!checked)}
                      />
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      {creator.user_avatar ? (
                        <img
                          src={creator.user_avatar}
                          alt={creator.user_nickname}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {creator.user_nickname}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(creator.last_crawled_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {progress.total}
                    </TableCell>
                    <TableCell className="text-right">
                      {progress.synced}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">
                          {progress.percent}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => handleSync([creator.user_id])}
                          disabled={syncStatus?.is_running}
                        >
                          {isCurrentlySyncing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setCreatorToDelete({ userId: creator.user_id, nickname: creator.user_nickname })
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add creator dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加创作者</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="输入知乎主页地址，如 https://www.zhihu.com/people/xxx"
                value={newCreatorLink}
                onChange={(e) => setNewCreatorLink(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              添加后将在下次同步时抓取该创作者的文章
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => addCreatorMutation.mutate(newCreatorLink)}
              disabled={!newCreatorLink.trim() || addCreatorMutation.isPending}
            >
              {addCreatorMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除创作者 "{creatorToDelete?.nickname}" 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => creatorToDelete && deleteCreatorMutation.mutate(creatorToDelete.userId)}
              disabled={deleteCreatorMutation.isPending}
            >
              {deleteCreatorMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch delete confirmation dialog */}
      <Dialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认批量删除</DialogTitle>
            <DialogDescription>
              确定要删除选中的 {selectedIds.size} 位创作者吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleBatchDelete}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除 {selectedIds.size} 位
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
