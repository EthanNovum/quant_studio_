import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ExternalLink,
  ThumbsUp,
  MessageSquare,
  Calendar,
  User,
  ArrowLeft,
  Heart,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getFavorites } from '@/services/sentimentApi'

function formatDate(timestamp: number): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function truncateText(text: string | null, maxLength: number = 200): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export default function SentimentFavorites() {
  const [page, setPage] = useState(1)
  const pageSize = 20

  const { data, isLoading } = useQuery({
    queryKey: ['favorites', page, pageSize],
    queryFn: () => getFavorites({ page, page_size: pageSize }),
  })

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/sentiment">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500" />
            我的收藏
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            共 {data?.total || 0} 篇收藏文章
          </p>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!data || data.items.length === 0) && (
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <Heart className="h-12 w-12 text-muted-foreground" />
          <div className="text-muted-foreground">暂无收藏文章</div>
          <p className="text-sm text-muted-foreground">
            在文章详情页点击心形图标即可收藏
          </p>
          <Link to="/sentiment">
            <Button variant="outline">浏览文章</Button>
          </Link>
        </div>
      )}

      {/* Favorites grid */}
      {data && data.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((article) => (
            <Link
              key={article.content_id}
              to={`/sentiment/${article.content_id}`}
              className="block"
            >
              <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
                <CardContent className="flex flex-1 flex-col p-4">
                  {/* Header */}
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="font-medium leading-tight line-clamp-2">
                      {article.title}
                    </h3>
                    {article.content_url && (
                      <a
                        href={article.content_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>

                  {/* Meta info */}
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(article.created_time)}
                    </span>
                    {article.author_name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {article.author_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      {article.voteup_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {article.comment_count}
                    </span>
                  </div>

                  {/* Content preview */}
                  <p className="mb-3 flex-1 text-sm text-muted-foreground line-clamp-3">
                    {truncateText(article.content_text, 150)}
                  </p>

                  {/* Related stocks */}
                  {article.related_stocks && article.related_stocks.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {article.related_stocks.slice(0, 5).map((symbol) => (
                        <Badge key={symbol} variant="secondary">
                          {symbol}
                        </Badge>
                      ))}
                      {article.related_stocks.length > 5 && (
                        <Badge variant="outline">+{article.related_stocks.length - 5}</Badge>
                      )}
                    </div>
                  )}

                  {/* Type badge */}
                  <div className="mt-2">
                    <Badge variant="outline" className="text-xs">
                      {article.content_type === 'answer' ? '回答' : '文章'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  )
}
