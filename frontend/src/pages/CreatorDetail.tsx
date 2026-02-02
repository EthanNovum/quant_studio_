import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ExternalLink,
  User,
  Users,
  FileText,
  MessageSquare,
  ThumbsUp,
  Calendar,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import CreatorTimeline from '@/components/charts/CreatorTimeline'
import { getCreatorDetail, getArticles, toggleCreator } from '@/services/sentimentApi'
import { useToastStore } from '@/store'

function formatNumber(value: number): string {
  if (value >= 10000) {
    return (value / 10000).toFixed(1) + '万'
  }
  return value.toString()
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function CreatorDetail() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([])
  const pageSize = 20
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const { data: creator, isLoading: creatorLoading } = useQuery({
    queryKey: ['creator-detail', userId],
    queryFn: () => getCreatorDetail(userId!),
    enabled: !!userId,
  })

  const {
    data: articlesData,
    isLoading: articlesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['creator-articles-infinite', userId],
    queryFn: ({ pageParam = 1 }) =>
      getArticles({
        author_id: userId,
        page: pageParam,
        page_size: pageSize,
        sort_by: 'time',
        sort_order: 'desc',
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.length * pageSize
      return totalLoaded < lastPage.total ? allPages.length + 1 : undefined
    },
    enabled: !!userId && !selectedDate,
  })

  // Fetch all articles when a date is selected to ensure we have the filtered ones
  const { data: allArticlesData, isLoading: allArticlesLoading } = useQuery({
    queryKey: ['creator-articles-all', userId],
    queryFn: () =>
      getArticles({
        author_id: userId,
        page: 1,
        page_size: 1000,
        sort_by: 'time',
        sort_order: 'desc',
      }),
    enabled: !!userId && !!selectedDate,
  })

  // Intersection Observer for infinite scroll
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries
      if (target.isIntersecting && hasNextPage && !isFetchingNextPage && !selectedDate) {
        fetchNextPage()
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage, selectedDate]
  )

  useEffect(() => {
    const element = loadMoreRef.current
    if (!element) return

    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
      rootMargin: '100px',
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [handleObserver])

  const toggleMutation = useMutation({
    mutationFn: toggleCreator,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creator-detail', userId] })
      queryClient.invalidateQueries({ queryKey: ['creators'] })
      addToast({ title: '关注状态已更新', type: 'success' })
    },
    onError: () => {
      addToast({ title: '操作失败', type: 'error' })
    },
  })

  const handleDateClick = (date: string, articleIds: string[]) => {
    setSelectedDate(date)
    setSelectedArticleIds(articleIds)
    // Scroll to articles section
    document.getElementById('articles-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  // Flatten all pages into a single array for infinite scroll
  const allInfiniteArticles = articlesData?.pages.flatMap((page) => page.items) ?? []
  const totalArticles = articlesData?.pages[0]?.total ?? 0

  // Filter articles by selected date if any
  const filteredArticles = selectedDate
    ? allArticlesData?.items.filter((article) =>
        selectedArticleIds.includes(article.content_id)
      )
    : allInfiniteArticles

  const isLoadingArticles = selectedDate ? allArticlesLoading : articlesLoading

  if (creatorLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (!creator) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <div className="text-muted-foreground">创作者不存在</div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/creators')} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        返回创作者列表
      </Button>

      {/* Creator profile card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Avatar */}
            <div className="shrink-0">
              {creator.user_avatar ? (
                <img
                  src={creator.user_avatar}
                  alt={creator.user_nickname}
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-12 w-12 text-primary" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Name and follow status */}
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">{creator.user_nickname}</h1>
                {creator.is_active === 1 ? (
                  <Badge variant="default">已关注</Badge>
                ) : (
                  <Badge variant="secondary">未关注</Badge>
                )}
              </div>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {formatNumber(creator.fans)} 粉丝
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  {creator.answer_count} 回答
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {creator.article_count} 文章
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4" />
                  {formatNumber(creator.voteup_count)} 获赞
                </span>
              </div>

              {/* Database stats */}
              <div className="text-sm text-muted-foreground">
                已收录 <span className="font-medium text-foreground">{creator.total_articles_in_db}</span> 篇文章
                {creator.last_crawled_at && (
                  <span className="ml-4">
                    <Clock className="h-3 w-3 inline mr-1" />
                    最后同步: {new Date(creator.last_crawled_at).toLocaleDateString('zh-CN')}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3">
                {creator.user_link && (
                  <a
                    href={creator.user_link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      查看主页
                    </Button>
                  </a>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">关注同步</span>
                  <Switch
                    checked={creator.is_active === 1}
                    onCheckedChange={() => toggleMutation.mutate(creator.user_id)}
                    disabled={toggleMutation.isPending}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            发布时间轴
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CreatorTimeline
            data={creator.timeline}
            height={300}
            onDateClick={handleDateClick}
          />
          {selectedDate && (
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="secondary">
                已筛选: {selectedDate}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(null)}
              >
                清除筛选
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Articles list */}
      <Card id="articles-section">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              文章列表
            </span>
            {totalArticles > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                共 {totalArticles} 篇
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingArticles ? (
            <div className="flex h-32 items-center justify-center">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          ) : filteredArticles && filteredArticles.length > 0 ? (
            <div className="space-y-3">
              {filteredArticles.map((article) => (
                <Link
                  key={article.content_id}
                  to={`/sentiment/${article.content_id}`}
                  className="block"
                >
                  <div className="rounded-lg border p-4 transition-all hover:shadow-md hover:border-primary/50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium line-clamp-2 mb-2">
                          {article.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(article.created_time)}
                          </span>
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" />
                            {article.voteup_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {article.comment_count}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {article.content_type === 'answer' ? '回答' : '文章'}
                          </Badge>
                        </div>
                        {article.related_stocks && article.related_stocks.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {article.related_stocks.slice(0, 5).map((symbol) => (
                              <Badge key={symbol} variant="secondary" className="text-xs">
                                {symbol}
                              </Badge>
                            ))}
                            {article.related_stocks.length > 5 && (
                              <Badge variant="secondary" className="text-xs">
                                +{article.related_stocks.length - 5}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}

              {/* Infinite scroll loading trigger */}
              {!selectedDate && (
                <div ref={loadMoreRef} className="flex items-center justify-center py-4">
                  {isFetchingNextPage ? (
                    <div className="text-muted-foreground">加载中...</div>
                  ) : hasNextPage ? (
                    <div className="text-muted-foreground text-sm">向下滚动加载更多</div>
                  ) : allInfiniteArticles.length > 0 ? (
                    <div className="text-muted-foreground text-sm">已加载全部文章</div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              {selectedDate ? `${selectedDate} 没有文章` : '暂无文章'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
