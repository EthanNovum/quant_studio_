import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ExternalLink,
  ThumbsUp,
  MessageSquare,
  Calendar,
  User,
  LayoutGrid,
  List,
  ArrowUpDown,
  Filter,
  Users,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getArticles, getStatsByStock, getStatsByAuthor } from '@/services/sentimentApi'

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

type ViewMode = 'card' | 'list'
type SortBy = 'time' | 'votes'
type SortOrder = 'desc' | 'asc'

export default function Sentiment() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortBy, setSortBy] = useState<SortBy>('time')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selectedStock, setSelectedStock] = useState<string>(searchParams.get('stock') || '')
  const [selectedAuthor, setSelectedAuthor] = useState<string>(searchParams.get('author') || '')

  // Sync URL with filter state
  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedStock) params.set('stock', selectedStock)
    if (selectedAuthor) params.set('author', selectedAuthor)
    setSearchParams(params, { replace: true })
  }, [selectedStock, selectedAuthor, setSearchParams])

  // Fetch articles with filters and sorting
  const { data, isLoading } = useQuery({
    queryKey: ['articles', page, pageSize, sortBy, sortOrder, selectedStock, selectedAuthor],
    queryFn: () =>
      getArticles({
        page,
        page_size: pageSize,
        stock_symbol: selectedStock || undefined,
        author_id: selectedAuthor || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      }),
  })

  // Fetch statistics for filters
  const { data: stockStats } = useQuery({
    queryKey: ['stats-by-stock'],
    queryFn: getStatsByStock,
  })

  const { data: authorStats } = useQuery({
    queryKey: ['stats-by-author'],
    queryFn: getStatsByAuthor,
  })

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  const handleSortChange = (newSortBy: SortBy) => {
    if (newSortBy === sortBy) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(newSortBy)
      setSortOrder('desc')
    }
    setPage(1)
  }

  const handleStockChange = (value: string) => {
    setSelectedStock(value === 'all' ? '' : value)
    setPage(1)
  }

  const handleAuthorChange = (value: string) => {
    setSelectedAuthor(value === 'all' ? '' : value)
    setPage(1)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value))
    setPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">舆情仪表盘</h1>
          <p className="text-sm text-muted-foreground">
            知乎文章与回答 · 共 {data?.total || 0} 篇
          </p>
        </div>

        {/* Quick links and view mode toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick links to authors and symbols pages */}
          <Link to="/sentiment/authors">
            <Button variant="outline" size="sm" className="gap-1">
              <Users className="h-4 w-4" />
              按创作者
            </Button>
          </Link>
          <Link to="/sentiment/symbols">
            <Button variant="outline" size="sm" className="gap-1">
              <TrendingUp className="h-4 w-4" />
              按股票
            </Button>
          </Link>

          <div className="h-6 w-px bg-border mx-1" />

          {/* View mode toggle */}
          <Button
            variant={viewMode === 'card' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('card')}
            className="gap-1"
          >
            <LayoutGrid className="h-4 w-4" />
            卡片
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="gap-1"
          >
            <List className="h-4 w-4" />
            列表
          </Button>
        </div>
      </div>

      {/* Filters toolbar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          {/* Sort options */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">排序:</span>
            <Button
              variant={sortBy === 'time' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleSortChange('time')}
              className="gap-1"
            >
              时间
              {sortBy === 'time' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
            </Button>
            <Button
              variant={sortBy === 'votes' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => handleSortChange('votes')}
              className="gap-1"
            >
              点赞
              {sortBy === 'votes' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
            </Button>
          </div>

          <div className="h-6 w-px bg-border" />

          {/* Stock filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedStock || 'all'} onValueChange={handleStockChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="全部股票" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部股票</SelectItem>
                {stockStats?.map((stat) => (
                  <SelectItem key={stat.symbol} value={stat.symbol}>
                    {stat.symbol} {stat.name && `${stat.name}`} ({stat.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Author filter */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedAuthor || 'all'} onValueChange={handleAuthorChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="全部作者" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部作者</SelectItem>
                {authorStats?.map((stat) => (
                  <SelectItem key={stat.author_id} value={stat.author_id}>
                    {stat.author_name} ({stat.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clear filters */}
          {(selectedStock || selectedAuthor) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedStock('')
                setSelectedAuthor('')
                setPage(1)
              }}
            >
              清除筛选
            </Button>
          )}

          <div className="h-6 w-px bg-border" />

          {/* Page size selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">每页:</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10条</SelectItem>
                <SelectItem value="20">20条</SelectItem>
                <SelectItem value="50">50条</SelectItem>
                <SelectItem value="100">100条</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <div className="text-muted-foreground">加载中...</div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!data || data.items.length === 0) && (
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <div className="text-muted-foreground">暂无舆情数据</div>
          <p className="text-sm text-muted-foreground">
            请在设置页面添加知乎创作者并运行爬虫
          </p>
          <Link to="/settings">
            <Button variant="outline">前往设置</Button>
          </Link>
        </div>
      )}

      {/* Card view */}
      {data && data.items.length > 0 && viewMode === 'card' && (
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
                        <Badge
                          key={symbol}
                          variant="secondary"
                          className="cursor-pointer hover:bg-accent"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setSelectedStock(symbol)
                            setPage(1)
                          }}
                        >
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

      {/* List view */}
      {data && data.items.length > 0 && viewMode === 'list' && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%] min-w-[300px]">标题</TableHead>
                <TableHead className="w-[100px]">作者</TableHead>
                <TableHead
                  className="w-[100px] cursor-pointer hover:text-foreground"
                  onClick={() => handleSortChange('time')}
                >
                  时间 {sortBy === 'time' && (sortOrder === 'desc' ? '↓' : '↑')}
                </TableHead>
                <TableHead
                  className="w-[80px] cursor-pointer hover:text-foreground"
                  onClick={() => handleSortChange('votes')}
                >
                  点赞 {sortBy === 'votes' && (sortOrder === 'desc' ? '↓' : '↑')}
                </TableHead>
                <TableHead className="w-[150px]">关联股票</TableHead>
                <TableHead className="w-[60px]">类型</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((article) => (
                <TableRow
                  key={article.content_id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => {
                    window.location.href = `/sentiment/${article.content_id}`
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="line-clamp-1 font-medium">{article.title}</span>
                      {article.content_url && (
                        <a
                          href={article.content_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {article.author_name || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(article.created_time)}
                  </TableCell>
                  <TableCell>{article.voteup_count}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {article.related_stocks?.slice(0, 3).map((symbol) => (
                        <Badge
                          key={symbol}
                          variant="secondary"
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedStock(symbol)
                            setPage(1)
                          }}
                        >
                          {symbol}
                        </Badge>
                      ))}
                      {(article.related_stocks?.length || 0) > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{article.related_stocks!.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {article.content_type === 'answer' ? '回答' : '文章'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
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
