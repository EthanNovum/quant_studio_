import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useRef, useCallback, useState, useEffect } from 'react'
import { AlertTriangle, Newspaper, ChevronDown, ChevronUp, Calendar, ThumbsUp, User, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import EChartsKLine from '@/components/charts/EChartsKLine'
import ChartHeader from '@/components/charts/ChartHeader'
import { getStockDetail } from '@/services/stockApi'
import { getQuotes } from '@/services/quoteApi'
import { getSentimentMarkers, getArticles, getArticle } from '@/services/sentimentApi'
import type { ZhihuContent } from '@/types'

function formatDate(timestamp: number): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('zh-CN')
}

export default function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>()
  const articleListRef = useRef<HTMLDivElement>(null)
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null)
  const [isInfoCollapsed, setIsInfoCollapsed] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([])
  const [selectedArticles, setSelectedArticles] = useState<ZhihuContent[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)

  const { data: stock, isLoading: stockLoading } = useQuery({
    queryKey: ['stock-detail', symbol],
    queryFn: () => getStockDetail(symbol!),
    enabled: !!symbol,
  })

  const { data: quotesData } = useQuery({
    queryKey: ['quotes', symbol],
    queryFn: () => getQuotes(symbol!),
    enabled: !!symbol,
  })

  const { data: sentimentData } = useQuery({
    queryKey: ['sentiment-markers', symbol],
    queryFn: () => getSentimentMarkers(symbol!),
    enabled: !!symbol,
  })

  const { data: articlesData } = useQuery({
    queryKey: ['stock-articles', symbol],
    queryFn: () => getArticles({ stock_symbol: symbol!, page_size: 50 }),
    enabled: !!symbol,
  })

  // Handle click on sentiment marker - show articles in preview panel
  const handleMarkerClick = useCallback((date: string, articleIds: string[]) => {
    setHighlightedDate(date)
    setSelectedDate(date)
    setSelectedArticleIds(articleIds)
  }, [])

  // Fetch selected articles when articleIds change
  useEffect(() => {
    if (selectedArticleIds.length === 0) {
      setSelectedArticles([])
      return
    }

    const fetchArticles = async () => {
      setLoadingPreview(true)
      try {
        const articles = await Promise.all(
          selectedArticleIds.map(id => getArticle(id))
        )
        setSelectedArticles(articles)
      } catch (error) {
        console.error('Failed to fetch articles:', error)
        setSelectedArticles([])
      } finally {
        setLoadingPreview(false)
      }
    }

    fetchArticles()
  }, [selectedArticleIds])

  // Check if an article matches the highlighted date
  const isArticleHighlighted = useCallback((createdTime: number) => {
    if (!highlightedDate) return false
    const articleDate = new Date(createdTime * 1000).toISOString().split('T')[0]
    return articleDate === highlightedDate
  }, [highlightedDate])

  if (stockLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (!stock) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">股票不存在或数据待更新</div>
      </div>
    )
  }

  const latestQuote = quotesData && quotesData.length > 0 ? quotesData[quotesData.length - 1] : null
  const hasArticles = articlesData && articlesData.items.length > 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">
          {stock.symbol} - {stock.name}
        </h1>
        {sentimentData && sentimentData.markers.length > 0 && (
          <Badge variant="secondary">
            <Newspaper className="mr-1 h-3 w-3" />
            {sentimentData.markers.reduce((sum, m) => sum + m.count, 0)} 篇舆情
          </Badge>
        )}
      </div>

      {/* Danger warnings */}
      {stock.danger_reasons && stock.danger_reasons.length > 0 && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              风险提示
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm text-destructive">
              {stock.danger_reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Basic info - Collapsible */}
      <Card>
        <CardHeader
          className="cursor-pointer pb-2"
          onClick={() => setIsInfoCollapsed(!isInfoCollapsed)}
        >
          <CardTitle className="flex items-center justify-between">
            <span>基础信息</span>
            {isInfoCollapsed ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </CardTitle>
        </CardHeader>
        {!isInfoCollapsed && (
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <div className="text-sm text-muted-foreground">行业</div>
                <div className="font-medium">{stock.industry || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">ROE</div>
                <div className="font-medium">{stock.roe ? `${stock.roe.toFixed(2)}%` : '-'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">上市日期</div>
                <div className="font-medium">{stock.listing_date || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">实控人</div>
                <div className="font-medium">{stock.controller || '-'}</div>
              </div>
            </div>
            {stock.description && (
              <div className="mt-4">
                <div className="text-sm text-muted-foreground">公司简介</div>
                <div className="mt-1 text-sm">{stock.description}</div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* K-Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            K线图与舆情锚点
            {sentimentData && sentimentData.markers.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                (点击蓝点查看相关文章)
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
          {quotesData && quotesData.length > 0 ? (
            <EChartsKLine
              data={quotesData}
              sentimentMarkers={sentimentData?.markers}
              height={450}
              onMarkerClick={handleMarkerClick}
            />
          ) : (
            <div className="flex h-96 items-center justify-center text-muted-foreground">
              暂无行情数据
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sentiment Preview Panel - Shows when clicking on sentiment marker */}
      {selectedDate && selectedArticles.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span>{selectedDate} 相关舆情</span>
                <Badge variant="secondary">{selectedArticles.length} 篇</Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setSelectedDate(null)
                  setSelectedArticleIds([])
                  setHighlightedDate(null)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {selectedArticles.map((article) => (
                <Link
                  key={article.content_id}
                  to={`/sentiment/${article.content_id}`}
                  className="block rounded-md border bg-background p-3 transition-all hover:bg-accent/50 hover:shadow-md"
                >
                  <div className="font-medium line-clamp-2 mb-2">
                    {article.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(article.created_time)}
                    </span>
                    {article.author_name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="truncate max-w-[80px]">{article.author_name}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      {article.voteup_count}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {article.content_type === 'answer' ? '回答' : '文章'}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related Articles - Full width below chart */}
      {hasArticles && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Newspaper className="h-5 w-5" />
              相关舆情
              <Badge variant="outline" className="ml-auto">
                {articlesData.total} 篇
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={articleListRef}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {articlesData.items.map((article) => {
                const isHighlighted = isArticleHighlighted(article.created_time)
                return (
                  <a
                    id={`article-${article.content_id}`}
                    key={article.content_id}
                    href={`/sentiment/${article.content_id}`}
                    className={`block rounded-md border p-3 transition-all duration-300 hover:bg-accent/50 hover:shadow-md ${
                      isHighlighted
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/50'
                        : ''
                    }`}
                  >
                    <div className="font-medium line-clamp-2 mb-2">
                      {article.title}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(article.created_time)}</span>
                      {article.author_name && (
                        <span className="truncate max-w-[80px]">{article.author_name}</span>
                      )}
                      <span>{article.voteup_count} 赞</span>
                      <Badge variant="outline" className="text-xs">
                        {article.content_type === 'answer' ? '回答' : '文章'}
                      </Badge>
                    </div>
                  </a>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
