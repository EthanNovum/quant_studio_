import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ArrowLeft, Users, MessageSquare, FileText, ThumbsUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useToastStore } from '@/store'
import {
  getCreators,
  addCreator,
  deleteCreator,
  toggleCreator,
} from '@/services/sentimentApi'

function formatNumber(value: number): string {
  if (value >= 10000) {
    return (value / 10000).toFixed(1) + '万'
  }
  return value.toString()
}

export default function CreatorsManagement() {
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()

  const [newCreatorUrl, setNewCreatorUrl] = useState('')

  const { data: creators, isLoading: creatorsLoading } = useQuery({
    queryKey: ['creators'],
    queryFn: getCreators,
  })

  const addCreatorMutation = useMutation({
    mutationFn: addCreator,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creators'] })
      setNewCreatorUrl('')
      addToast({ title: '创作者已添加', type: 'success' })
    },
    onError: (error: any) => {
      addToast({ title: '添加失败', description: error.response?.data?.detail || '请检查URL格式', type: 'error' })
    },
  })

  const deleteCreatorMutation = useMutation({
    mutationFn: deleteCreator,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creators'] })
      addToast({ title: '创作者已删除', type: 'success' })
    },
  })

  const toggleCreatorMutation = useMutation({
    mutationFn: toggleCreator,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creators'] })
    },
  })

  const activeCount = creators?.filter(c => c.is_active === 1).length || 0
  const totalCount = creators?.length || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">创作者管理</h1>
          <p className="text-sm text-muted-foreground">
            管理要爬取的知乎用户，共 {totalCount} 位创作者，{activeCount} 位活跃
          </p>
        </div>
      </div>

      {/* Add creator form */}
      <Card>
        <CardHeader>
          <CardTitle>添加创作者</CardTitle>
          <CardDescription>输入知乎用户主页链接添加新的监控创作者</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="https://www.zhihu.com/people/xxx"
              value={newCreatorUrl}
              onChange={(e) => setNewCreatorUrl(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCreatorUrl) {
                  addCreatorMutation.mutate(newCreatorUrl)
                }
              }}
            />
            <Button
              onClick={() => addCreatorMutation.mutate(newCreatorUrl)}
              disabled={!newCreatorUrl || addCreatorMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              添加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Creators list */}
      <Card>
        <CardHeader>
          <CardTitle>创作者列表</CardTitle>
          <CardDescription>点击开关启用/禁用创作者，点击删除按钮移除创作者</CardDescription>
        </CardHeader>
        <CardContent>
          {creatorsLoading && (
            <div className="text-sm text-muted-foreground text-center py-8">加载中...</div>
          )}

          {!creatorsLoading && creators?.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">暂无监控的创作者</p>
              <p className="text-sm text-muted-foreground mt-1">添加知乎用户链接开始监控</p>
            </div>
          )}

          <div className="space-y-3">
            {creators?.map((creator) => (
              <div
                key={creator.user_id}
                className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
                  creator.is_active === 1 ? 'bg-card' : 'bg-muted/50 opacity-60'
                }`}
              >
                {/* Avatar */}
                {creator.user_avatar ? (
                  <img
                    src={creator.user_avatar}
                    alt=""
                    className="h-12 w-12 rounded-full shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">{creator.user_nickname}</span>
                    {creator.is_active === 0 && (
                      <Badge variant="secondary" className="text-xs">已禁用</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {formatNumber(creator.fans || 0)} 粉丝
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {creator.answer_count || 0} 回答
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {creator.article_count || 0} 文章
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      {formatNumber(creator.voteup_count || 0)} 赞同
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <Switch
                    checked={creator.is_active === 1}
                    onCheckedChange={() => toggleCreatorMutation.mutate(creator.user_id)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm(`确定要删除创作者 "${creator.user_nickname}" 吗？`)) {
                        deleteCreatorMutation.mutate(creator.user_id)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
