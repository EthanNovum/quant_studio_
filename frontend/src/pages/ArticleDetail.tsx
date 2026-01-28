import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ArrowLeft,
  ExternalLink,
  ThumbsUp,
  MessageSquare,
  Calendar,
  User,
  Plus,
  X,
  Tag,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import StockSearch from '@/components/stocks/StockSearch'
import { getArticle, updateArticleStocks, createAlias, getStatsByStock } from '@/services/sentimentApi'
import { useToastStore } from '@/store'

function formatDate(timestamp: number): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Smart paragraph splitting for Chinese text
function splitIntoParagraphs(text: string): string[] {
  if (!text) return ['暂无内容']

  // First, try to split by existing newlines
  const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean)

  // If we have reasonable paragraphs already, use them
  if (lines.length > 1 && lines.every(line => line.length < 500)) {
    return lines
  }

  // Otherwise, split long text by Chinese sentence endings
  // Split at 。！？ but keep the punctuation
  const paragraphs: string[] = []
  let currentParagraph = ''

  // Join all lines first
  const fullText = lines.join('')

  // Split by sentence endings, keeping punctuation
  const sentences = fullText.split(/(?<=[。！？])/g).filter(Boolean)

  for (const sentence of sentences) {
    currentParagraph += sentence

    // Start a new paragraph if:
    // 1. Current paragraph is long enough (> 150 chars)
    // 2. And we just ended a sentence
    if (currentParagraph.length > 150) {
      paragraphs.push(currentParagraph.trim())
      currentParagraph = ''
    }
  }

  // Don't forget the last paragraph
  if (currentParagraph.trim()) {
    paragraphs.push(currentParagraph.trim())
  }

  return paragraphs.length > 0 ? paragraphs : ['暂无内容']
}

export default function ArticleDetail() {
  const { contentId } = useParams<{ contentId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  const [addStockOpen, setAddStockOpen] = useState(false)
  const [addAliasOpen, setAddAliasOpen] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState('')
  const [selectedStockName, setSelectedStockName] = useState('')
  const [newAlias, setNewAlias] = useState('')

  const { data: article, isLoading } = useQuery({
    queryKey: ['article', contentId],
    queryFn: () => getArticle(contentId!),
    enabled: !!contentId,
  })

  // Get stock stats for name lookup
  const { data: stockStats } = useQuery({
    queryKey: ['stats-by-stock'],
    queryFn: getStatsByStock,
  })

  // Create a map of symbol -> name for quick lookup
  const stockNameMap = new Map<string, string>()
  stockStats?.forEach((stat) => {
    stockNameMap.set(stat.symbol, stat.name)
  })

  const updateStocksMutation = useMutation({
    mutationFn: (symbols: string[]) => updateArticleStocks(contentId!, symbols),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', contentId] })
      addToast({ title: '关联股票已更新' })
    },
    onError: () => {
      addToast({ title: '更新失败', variant: 'destructive' })
    },
  })

  const addAliasMutation = useMutation({
    mutationFn: ({ symbol, alias }: { symbol: string; alias: string }) =>
      createAlias(symbol, alias),
    onSuccess: () => {
      setAddAliasOpen(false)
      setNewAlias('')
      addToast({ title: '别名已添加' })
    },
    onError: () => {
      addToast({ title: '添加别名失败', variant: 'destructive' })
    },
  })

  const handleAddStock = (stock: { code: string; name: string }) => {
    const currentStocks = article?.related_stocks || []
    if (!currentStocks.includes(stock.code)) {
      updateStocksMutation.mutate([...currentStocks, stock.code])
      // Update local map
      stockNameMap.set(stock.code, stock.name)
    }
    setAddStockOpen(false)
  }

  const handleRemoveStock = (symbol: string) => {
    const currentStocks = article?.related_stocks || []
    updateStocksMutation.mutate(currentStocks.filter((s) => s !== symbol))
  }

  const handleAddAlias = () => {
    if (selectedSymbol && newAlias.trim()) {
      addAliasMutation.mutate({ symbol: selectedSymbol, alias: newAlias.trim() })
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <div className="text-muted-foreground">文章不存在</div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        返回
      </Button>

      {/* Main layout: Content left, Sidebar right */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Article content - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Article header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="text-xl leading-relaxed">{article.title}</CardTitle>
                {article.content_url && (
                  <a
                    href={article.content_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </a>
                )}
              </div>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(article.created_time)}
                </span>
                {article.author_name && (
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {article.author_name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4" />
                  {article.voteup_count} 赞
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  {article.comment_count} 评论
                </span>
                <Badge variant="outline">
                  {article.content_type === 'answer' ? '回答' : '文章'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {/* Content - Smart paragraph splitting for better readability */}
              <article className="max-w-none">
                <div className="space-y-6">
                  {splitIntoParagraphs(article.content_text || '').map((paragraph, idx) => (
                    <p
                      key={idx}
                      className="text-base leading-[2] tracking-wide text-foreground/90"
                      style={{ textIndent: '2em' }}
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </article>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar: Related stocks - 1/3 width */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Tag className="h-4 w-4" />
                关联股票
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {article.related_stocks && article.related_stocks.length > 0 ? (
                <div className="space-y-2">
                  {article.related_stocks.map((symbol) => {
                    const stockName = stockNameMap.get(symbol) || ''
                    return (
                      <div
                        key={symbol}
                        className="flex items-center justify-between rounded-md border p-2 hover:bg-accent/50"
                      >
                        <Link
                          to={`/search/${symbol}`}
                          className="flex items-center gap-2 flex-1 min-w-0 hover:text-primary"
                        >
                          <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="font-medium">{symbol}</div>
                            {stockName && (
                              <div className="text-xs text-muted-foreground truncate">
                                {stockName}
                              </div>
                            )}
                          </div>
                        </Link>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setSelectedSymbol(symbol)
                              setSelectedStockName(stockName)
                              setAddAliasOpen(true)
                            }}
                            title="添加别名"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveStock(symbol)}
                            title="移除关联"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  暂无关联股票
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddStockOpen(true)}
                className="w-full gap-1"
              >
                <Plus className="h-3 w-3" />
                添加股票
              </Button>

              <p className="text-xs text-muted-foreground">
                点击股票代码可查看该股票的 K 线图与舆情锚点
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add stock dialog */}
      <Dialog open={addStockOpen} onOpenChange={setAddStockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加关联股票</DialogTitle>
          </DialogHeader>
          <StockSearch onSelect={handleAddStock} />
        </DialogContent>
      </Dialog>

      {/* Add alias dialog */}
      <Dialog open={addAliasOpen} onOpenChange={setAddAliasOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              为 {selectedSymbol} {selectedStockName && `(${selectedStockName})`} 添加别名
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="输入别名（如：茅台、宁王）"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
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
