import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Tag,
  Loader2,
  CheckCircle,
  Calendar,
  BarChart3,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { useToastStore } from '@/store'
import { getDailyReview, createDecision } from '@/services/aiApi'
import type { DailyReviewStock, UserDecisionCreate } from '@/types'

export default function DailyReview() {
  const { addToast } = useToastStore()
  const queryClient = useQueryClient()

  const [reviewDate, setReviewDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [currentIndex, setCurrentIndex] = useState(0)
  const [rationale, setRationale] = useState('')
  const [confidence, setConfidence] = useState(5)

  const { data: reviewData, isLoading } = useQuery({
    queryKey: ['daily-review', reviewDate],
    queryFn: () => getDailyReview(reviewDate),
  })

  const createDecisionMutation = useMutation({
    mutationFn: (decision: UserDecisionCreate) => createDecision(decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-review', reviewDate] })
      addToast({ title: '决策已保存', type: 'success' })
      // Move to next stock
      if (reviewData && currentIndex < reviewData.stocks.length - 1) {
        setCurrentIndex(currentIndex + 1)
        setRationale('')
        setConfidence(5)
      }
    },
    onError: () => {
      addToast({ title: '保存失败', type: 'error' })
    },
  })

  const currentStock = reviewData?.stocks[currentIndex]

  const handleDecision = (actionType: 'BUY' | 'SELL' | 'HOLD') => {
    if (!currentStock) return

    createDecisionMutation.mutate({
      stock_symbol: currentStock.symbol,
      review_date: reviewDate,
      action_type: actionType,
      rationale: rationale || undefined,
      confidence_level: confidence,
      linked_insight_ids: [], // Could link to specific insights
    })
  }

  const getSentimentColor = (label: string | null) => {
    switch (label) {
      case 'Bullish':
        return 'text-red-500'
      case 'Bearish':
        return 'text-green-500'
      default:
        return 'text-gray-500'
    }
  }

  const getSentimentIcon = (label: string | null) => {
    switch (label) {
      case 'Bullish':
        return <TrendingUp className="h-5 w-5" />
      case 'Bearish':
        return <TrendingDown className="h-5 w-5" />
      default:
        return <Minus className="h-5 w-5" />
    }
  }

  const getPriceChangeColor = (change: number | null) => {
    if (change === null) return ''
    return change > 0 ? 'text-red-500' : change < 0 ? 'text-green-500' : ''
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            当日复盘中心
          </h1>
          <p className="text-sm text-muted-foreground">
            基于 AI 分析做出交易决策，记录复盘笔记
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={reviewDate}
            onChange={(e) => {
              setReviewDate(e.target.value)
              setCurrentIndex(0)
              setRationale('')
              setConfidence(5)
            }}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      {/* Progress */}
      {reviewData && reviewData.stocks.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${((currentIndex + 1) / reviewData.stocks.length) * 100}%`,
              }}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {reviewData.stocks.length}
          </span>
        </div>
      )}

      {/* Main Content */}
      {!reviewData || reviewData.stocks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无待复盘股票</h3>
            <p className="text-sm text-muted-foreground mb-4">
              当前日期没有 AI 分析的舆情数据，请先运行 AI 分析
            </p>
            <Link to="/settings">
              <Button variant="outline">前往设置</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Stock List */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">待复盘列表</CardTitle>
              <CardDescription>
                {reviewData.stocks.filter((s) => s.existing_decision).length} /{' '}
                {reviewData.stocks.length} 已完成
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {reviewData.stocks.map((stock, idx) => (
                  <div
                    key={stock.symbol}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                      idx === currentIndex
                        ? 'bg-primary/10 border border-primary'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => {
                      setCurrentIndex(idx)
                      setRationale(stock.existing_decision?.rationale || '')
                      setConfidence(stock.existing_decision?.confidence_level || 5)
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{stock.symbol}</span>
                        {stock.existing_decision && (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {stock.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={getSentimentColor(stock.sentiment_label)}>
                        {getSentimentIcon(stock.sentiment_label)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stock.insight_count} 条
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Right: Detail & Decision */}
          <Card className="lg:col-span-2">
            {currentStock && (
              <>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Link
                          to={`/search/${currentStock.symbol}`}
                          className="hover:underline"
                        >
                          {currentStock.symbol}
                        </Link>
                        <span className="text-muted-foreground font-normal">
                          {currentStock.name}
                        </span>
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        {currentStock.latest_price && (
                          <span>
                            ¥{currentStock.latest_price.toFixed(2)}
                            {currentStock.price_change_pct !== null && (
                              <span
                                className={`ml-1 ${getPriceChangeColor(
                                  currentStock.price_change_pct
                                )}`}
                              >
                                {currentStock.price_change_pct > 0 ? '+' : ''}
                                {currentStock.price_change_pct.toFixed(2)}%
                              </span>
                            )}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={currentIndex === 0}
                        onClick={() => {
                          setCurrentIndex(currentIndex - 1)
                          const prevStock = reviewData.stocks[currentIndex - 1]
                          setRationale(prevStock?.existing_decision?.rationale || '')
                          setConfidence(prevStock?.existing_decision?.confidence_level || 5)
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={currentIndex === reviewData.stocks.length - 1}
                        onClick={() => {
                          setCurrentIndex(currentIndex + 1)
                          const nextStock = reviewData.stocks[currentIndex + 1]
                          setRationale(nextStock?.existing_decision?.rationale || '')
                          setConfidence(nextStock?.existing_decision?.confidence_level || 5)
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* AI Summary */}
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-primary" />
                      <span className="font-medium">AI 分析摘要</span>
                      <Badge
                        variant={
                          currentStock.sentiment_label === 'Bullish'
                            ? 'destructive'
                            : currentStock.sentiment_label === 'Bearish'
                            ? 'default'
                            : 'secondary'
                        }
                        className={
                          currentStock.sentiment_label === 'Bullish'
                            ? 'bg-red-500'
                            : currentStock.sentiment_label === 'Bearish'
                            ? 'bg-green-500'
                            : ''
                        }
                      >
                        {currentStock.sentiment_label || '中性'}
                        {currentStock.avg_sentiment_score && (
                          <span className="ml-1">
                            ({currentStock.avg_sentiment_score.toFixed(1)})
                          </span>
                        )}
                      </Badge>
                    </div>
                    <p className="text-sm">
                      {currentStock.ai_summary || '暂无 AI 摘要'}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <BarChart3 className="h-3 w-3" />
                      基于 {currentStock.insight_count} 条舆情分析
                    </div>
                  </div>

                  {/* Tags */}
                  {currentStock.key_tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      {currentStock.key_tags.map((tag, idx) => (
                        <Badge key={idx} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Related Articles */}
                  {currentStock.article_ids.length > 0 && (
                    <div className="text-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">相关文章</span>
                      </div>
                      <div className="flex gap-2">
                        {currentStock.article_ids.slice(0, 3).map((id) => (
                          <Link
                            key={id}
                            to={`/sentiment/${id}`}
                            className="text-primary hover:underline text-xs"
                          >
                            查看文章
                          </Link>
                        ))}
                        {currentStock.article_ids.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{currentStock.article_ids.length - 3} 更多
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Decision Section */}
                  <div className="border-t pt-4 space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        复盘笔记
                      </label>
                      <Textarea
                        placeholder="记录你的分析和想法..."
                        value={rationale}
                        onChange={(e) => setRationale(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        信心程度: {confidence}
                      </label>
                      <Slider
                        value={[confidence]}
                        onValueChange={(v) => setConfidence(v[0])}
                        min={1}
                        max={10}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>低</span>
                        <span>高</span>
                      </div>
                    </div>

                    {/* Existing Decision */}
                    {currentStock.existing_decision && (
                      <div className="rounded-md bg-muted p-3 text-sm">
                        <span className="text-muted-foreground">已有决策: </span>
                        <Badge
                          variant={
                            currentStock.existing_decision.action_type === 'BUY'
                              ? 'destructive'
                              : currentStock.existing_decision.action_type === 'SELL'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {currentStock.existing_decision.action_type === 'BUY'
                            ? '买入'
                            : currentStock.existing_decision.action_type === 'SELL'
                            ? '卖出'
                            : '观望'}
                        </Badge>
                      </div>
                    )}

                    {/* Decision Buttons */}
                    <div className="flex gap-3">
                      <Button
                        className="flex-1 bg-red-500 hover:bg-red-600"
                        onClick={() => handleDecision('BUY')}
                        disabled={createDecisionMutation.isPending}
                      >
                        {createDecisionMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <TrendingUp className="h-4 w-4 mr-2" />
                        )}
                        看多 / 买入
                      </Button>
                      <Button
                        className="flex-1 bg-green-500 hover:bg-green-600"
                        onClick={() => handleDecision('SELL')}
                        disabled={createDecisionMutation.isPending}
                      >
                        {createDecisionMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <TrendingDown className="h-4 w-4 mr-2" />
                        )}
                        看空 / 卖出
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleDecision('HOLD')}
                        disabled={createDecisionMutation.isPending}
                      >
                        {createDecisionMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Minus className="h-4 w-4 mr-2" />
                        )}
                        观望
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
