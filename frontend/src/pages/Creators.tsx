import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  User,
  FileText,
  ArrowLeft,
  Users,
  MessageSquare,
  Clock,
  ArrowUpDown,
  UserPlus,
  UserMinus,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  toggleCreator,
  batchToggleCreators,
  getSyncStatus,
  addCreator,
  deleteCreator,
} from '@/services/sentimentApi'

function formatNumber(value: number): string {
  if (value >= 10000) {
    return (value / 10000).toFixed(1) + '万'
  }
  return value.toString()
}

type SortBy = 'fans' | 'articles' | 'created'
type SortOrder = 'desc' | 'asc'

export default function Creators() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const [sortBy, setSortBy] = useState<SortBy>('fans')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newCreatorLink, setNewCreatorLink] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [creatorToDelete, setCreatorToDelete] = useState<{ userId: string; nickname: string } | null>(null)

  const { data: creators, isLoading } = useQuery({
    queryKey: ['creators'],
    queryFn: getCreators,
  })

  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: getSyncStatus,
  })

  const toggleMutation = useMutation({
    mutationFn: toggleCreator,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creators'] })
    },
    onError: () => {
      addToast({ title: '操作失败', type: 'error' })
    },
  })

  const batchToggleMutation = useMutation({
    mutationFn: batchToggleCreators,
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ['creators'] })
      addToast({
        title: action === 'follow_all' ? '已全部关注' : '已全部取消关注',
        type: 'success',
      })
    },
    onError: () => {
      addToast({ title: '操作失败', type: 'error' })
    },
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
      let aVal: number, bVal: number

      switch (sortBy) {
        case 'fans':
          aVal = a.fans
          bVal = b.fans
          break
        case 'articles':
          aVal = a.article_count + a.answer_count
          bVal = b.article_count + b.answer_count
          break
        case 'created':
          aVal = new Date(a.created_at).getTime()
          bVal = new Date(b.created_at).getTime()
          break
        default:
          return 0
      }

      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
    })
  }, [creators, sortBy, sortOrder])

  const lastSyncTime = syncStatus?.last_sync_at
    ? new Date(syncStatus.last_sync_at).toLocaleDateString('zh-CN')
    : null

  const followedCount = creators?.filter((c) => c.is_active === 1).length || 0
  const totalCount = creators?.length || 0

  const handleCardClick = (userId: string) => {
    navigate(`/creators/${userId}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link to="/sentiment">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">创作者管理</h1>
            <p className="text-sm text-muted-foreground">
              共 {totalCount} 位创作者，已关注 {followedCount} 位
            </p>
          </div>
        </div>

        {lastSyncTime && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            最后同步: {lastSyncTime}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort controls */}
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fans">按粉丝数</SelectItem>
              <SelectItem value="articles">按文章数</SelectItem>
              <SelectItem value="created">按添加时间</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="h-9"
          >
            <ArrowUpDown className="h-4 w-4 mr-1" />
            {sortOrder === 'desc' ? '降序' : '升序'}
          </Button>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Batch actions */}
        <Button
          variant="default"
          size="sm"
          onClick={() => batchToggleMutation.mutate('follow_all')}
          disabled={batchToggleMutation.isPending}
          className="h-9"
        >
          {batchToggleMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4 mr-1" />
          )}
          全部关注
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => batchToggleMutation.mutate('unfollow_all')}
          disabled={batchToggleMutation.isPending}
          className="h-9"
        >
          {batchToggleMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <UserMinus className="h-4 w-4 mr-1" />
          )}
          全部取消关注
        </Button>

        <div className="h-6 w-px bg-border" />

        {/* Add creator button */}
        <Button
          variant="default"
          size="sm"
          onClick={() => setAddDialogOpen(true)}
          className="h-9"
        >
          <Plus className="h-4 w-4 mr-1" />
          添加创作者
        </Button>
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
            请在设置页面添加知乎创作者
          </p>
          <Link to="/settings">
            <Button variant="outline">前往设置</Button>
          </Link>
        </div>
      )}

      {/* Creators grid */}
      {sortedCreators.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedCreators.map((creator) => (
            <Card
              key={creator.user_id}
              className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
              onClick={() => handleCardClick(creator.user_id)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                {/* Avatar */}
                <div className="shrink-0">
                  {creator.user_avatar ? (
                    <img
                      src={creator.user_avatar}
                      alt={creator.user_nickname}
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-7 w-7 text-primary" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {/* Name */}
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">
                      {creator.user_nickname}
                    </h3>
                  </div>

                  {/* Stats row */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {formatNumber(creator.fans)} 粉丝
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {creator.answer_count} 回答
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {creator.article_count} 文章
                    </span>
                  </div>
                </div>

                {/* Follow switch and delete button */}
                <div className="shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={creator.is_active === 1}
                    onCheckedChange={() => toggleMutation.mutate(creator.user_id)}
                    disabled={toggleMutation.isPending}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      setCreatorToDelete({ userId: creator.user_id, nickname: creator.user_nickname })
                      setDeleteDialogOpen(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
    </div>
  )
}
