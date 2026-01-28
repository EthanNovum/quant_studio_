import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { User, FileText, ThumbsUp, ArrowLeft, Users, MessageSquare, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getStatsByAuthor, getSyncStatus } from '@/services/sentimentApi'

function formatNumber(value: number): string {
  if (value >= 10000) {
    return (value / 10000).toFixed(1) + '万'
  }
  return value.toString()
}

export default function SentimentAuthors() {
  const { data: authorStats, isLoading } = useQuery({
    queryKey: ['stats-by-author'],
    queryFn: getStatsByAuthor,
  })

  // Get sync status for last sentiment update time
  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: getSyncStatus,
  })

  const lastSyncTime = syncStatus?.last_sync_at
    ? new Date(syncStatus.last_sync_at).toLocaleDateString('zh-CN')
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/sentiment">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">创作者列表</h1>
            <p className="text-sm text-muted-foreground">
              共 {authorStats?.length || 0} 位创作者
            </p>
          </div>
        </div>

        {/* Update time */}
        {lastSyncTime && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            舆情更新: {lastSyncTime}
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!authorStats || authorStats.length === 0) && (
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <div className="text-muted-foreground">暂无创作者数据</div>
          <p className="text-sm text-muted-foreground">
            请在设置页面添加知乎创作者并运行爬虫
          </p>
          <Link to="/settings">
            <Button variant="outline">前往设置</Button>
          </Link>
        </div>
      )}

      {/* Authors grid - horizontal cards */}
      {authorStats && authorStats.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {authorStats.map((author) => (
            <Link
              key={author.author_id}
              to={`/sentiment?author=${author.author_id}`}
              className="block"
            >
              <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50">
                <CardContent className="flex items-center gap-4 p-4">
                  {/* Avatar */}
                  <div className="shrink-0">
                    {author.avatar ? (
                      <img
                        src={author.avatar}
                        alt={author.author_name}
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
                    <h3 className="font-medium truncate mb-1">
                      {author.author_name}
                    </h3>

                    {/* Stats row */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {formatNumber(author.fans)} 粉丝
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {author.answer_count} 回答
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {author.article_count} 文章
                      </span>
                    </div>
                  </div>

                  {/* Article count badge */}
                  <div className="shrink-0">
                    <Badge variant="secondary" className="gap-1">
                      <FileText className="h-3 w-3" />
                      {author.count} 篇
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
