import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import * as echarts from 'echarts'
import { X, Plus, TrendingUp, User, FileText, Calendar, ThumbsUp, MessageSquare, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import StockSearch from '@/components/stocks/StockSearch'
import { getQuotes } from '@/services/quoteApi'
import { getCreators, getCreatorDetail, getArticles } from '@/services/sentimentApi'
import type { Quote } from '@/types'

interface SelectedStock {
  symbol: string
  name: string
  color: string
}

interface SelectedCreator {
  userId: string
  nickname: string
  color: string
}

// Colors for stocks (warm colors)
const STOCK_COLORS = ['#ef4444', '#f59e0b', '#84cc16', '#06b6d4', '#8b5cf6']
// Colors for creators (blue shades)
const CREATOR_COLORS = ['#3b82f6', '#60a5fa', '#93c5fd']

function formatDate(timestamp: number): string {
  if (!timestamp) return '-'
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface SelectedArticleInfo {
  date: string
  creatorName: string
  creatorColor: string
  creatorUserId: string
  articleIds: string[]
}

export default function DarePlay() {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  // Load from localStorage on mount
  const [selectedStocks, setSelectedStocks] = useState<SelectedStock[]>(() => {
    try {
      const saved = localStorage.getItem('dareplay-stocks')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [selectedCreators, setSelectedCreators] = useState<SelectedCreator[]>(() => {
    try {
      const saved = localStorage.getItem('dareplay-creators')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [addStockOpen, setAddStockOpen] = useState(false)
  const [addCreatorOpen, setAddCreatorOpen] = useState(false)
  const [selectedArticleInfo, setSelectedArticleInfo] = useState<SelectedArticleInfo | null>(null)

  // Save to localStorage when selections change
  useEffect(() => {
    localStorage.setItem('dareplay-stocks', JSON.stringify(selectedStocks))
  }, [selectedStocks])

  useEffect(() => {
    localStorage.setItem('dareplay-creators', JSON.stringify(selectedCreators))
  }, [selectedCreators])

  // Fetch quotes for all selected stocks using useQueries
  const stockQueries = useQueries({
    queries: selectedStocks.map((stock) => ({
      queryKey: ['quotes', stock.symbol],
      queryFn: () => getQuotes(stock.symbol),
    })),
  })

  // Fetch creator details for timeline data using useQueries
  const creatorQueries = useQueries({
    queries: selectedCreators.map((creator) => ({
      queryKey: ['creator-detail', creator.userId],
      queryFn: () => getCreatorDetail(creator.userId),
    })),
  })

  // Fetch all creators for selection
  const { data: allCreators } = useQuery({
    queryKey: ['creators'],
    queryFn: getCreators,
  })

  // Fetch articles when a scatter point is clicked
  const { data: selectedArticlesData, isLoading: articlesLoading } = useQuery({
    queryKey: ['dareplay-articles', selectedArticleInfo?.creatorUserId],
    queryFn: () => getArticles({
      author_id: selectedArticleInfo!.creatorUserId,
      page: 1,
      page_size: 1000,
      sort_by: 'time',
      sort_order: 'desc',
    }),
    enabled: !!selectedArticleInfo?.creatorUserId,
  })

  // Filter articles by selected IDs
  const filteredArticles = useMemo(() => {
    if (!selectedArticleInfo?.articleIds || !selectedArticlesData?.items) return []
    return selectedArticlesData.items.filter((article) =>
      selectedArticleInfo.articleIds.includes(article.content_id)
    )
  }, [selectedArticleInfo, selectedArticlesData])

  // Prepare chart data - using first selected stock as the main K-line
  const chartData = useMemo(() => {
    // Use the first stock's data as the base for dates and K-line
    const primaryStock = selectedStocks[0]
    const primaryQuery = stockQueries[0]

    if (!primaryStock || !primaryQuery?.data || primaryQuery.data.length === 0) {
      return {
        dates: [],
        ohlc: [],
        volumes: [],
        dateIndexMap: new Map<string, number>(),
        dateHighMap: new Map<string, number>(),
        creatorScatterData: [],
      }
    }

    const quotes = primaryQuery.data
    const dates = quotes.map((d) => d.date)
    const ohlc = quotes.map((d) => [d.open, d.close, d.low, d.high])
    const volumes = quotes.map((d) => ({
      value: d.volume || 0,
      itemStyle: {
        color: d.close >= d.open ? '#ef4444' : '#22c55e',
      },
    }))

    // Create date -> index map
    const dateIndexMap = new Map<string, number>()
    dates.forEach((date, index) => {
      dateIndexMap.set(date, index)
    })

    // Create date -> high price map for positioning scatter points
    const dateHighMap = new Map<string, number>()
    quotes.forEach((d) => {
      dateHighMap.set(d.date, d.high)
    })

    // Collect all article dates from creators
    const creatorArticleMap = new Map<string, Map<string, { count: number; titles: string[]; articleIds: string[] }>>()
    creatorQueries.forEach((query, index) => {
      if (query.data?.timeline) {
        const userId = selectedCreators[index]?.userId
        if (userId) {
          const dateMap = new Map<string, { count: number; titles: string[]; articleIds: string[] }>()
          query.data.timeline.forEach((item) => {
            dateMap.set(item.date, {
              count: item.count,
              titles: item.titles,
              articleIds: item.article_ids,
            })
          })
          creatorArticleMap.set(userId, dateMap)
        }
      }
    })

    // Prepare creator scatter data - position above K-line candles
    const creatorScatterData = selectedCreators.map((creator, creatorIndex) => {
      const dateMap = creatorArticleMap.get(creator.userId)
      if (!dateMap) {
        console.log('[DarePlay] No dateMap for creator:', creator.userId, creator.nickname)
        return { creator, data: [] }
      }

      console.log('[DarePlay] Creator timeline dates:', creator.nickname, Array.from(dateMap.keys()).slice(0, 5))
      console.log('[DarePlay] Stock dates sample:', dates.slice(0, 5))

      const scatterData: any[] = []
      dateMap.forEach((articles, date) => {
        const index = dateIndexMap.get(date)
        if (index !== undefined) {
          const highPrice = dateHighMap.get(date) || 0
          // Position each creator's points at different heights above the candle
          const yOffset = 1.02 + creatorIndex * 0.02
          scatterData.push({
            value: [date, highPrice * yOffset],
            date,
            count: articles.count,
            titles: articles.titles,
            articleIds: articles.articleIds,
            creatorName: creator.nickname,
            creatorColor: creator.color,
            creatorUserId: creator.userId,
          })
        }
      })

      console.log('[DarePlay] Scatter data count for', creator.nickname, ':', scatterData.length)

      return { creator, data: scatterData }
    })

    return {
      dates,
      ohlc,
      volumes,
      dateIndexMap,
      dateHighMap,
      creatorScatterData,
      primaryStock,
    }
  }, [stockQueries, creatorQueries, selectedStocks, selectedCreators])

  // Render chart
  useEffect(() => {
    if (!chartRef.current) return

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark')
    }

    const chart = chartInstance.current

    if (chartData.dates.length === 0) {
      chart.clear()
      return
    }

    const series: any[] = [
      // K-line candlestick
      {
        name: chartData.primaryStock ? `${chartData.primaryStock.symbol} ${chartData.primaryStock.name}` : 'K线',
        type: 'candlestick',
        data: chartData.ohlc,
        itemStyle: {
          color: '#ef4444',
          color0: '#22c55e',
          borderColor: '#ef4444',
          borderColor0: '#22c55e',
        },
      },
      // Volume bars
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: chartData.volumes,
      },
    ]

    // Add creator scatter series - each creator with their own color
    chartData.creatorScatterData.forEach(({ creator, data }) => {
      if (data.length > 0) {
        console.log('[DarePlay] Adding scatter series for:', creator.nickname, 'with', data.length, 'points')
        console.log('[DarePlay] Sample scatter data:', data.slice(0, 3))
        series.push({
          name: creator.nickname,
          type: 'scatter',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data,
          symbol: 'circle',
          symbolSize: 20,
          itemStyle: {
            color: creator.color,
            shadowBlur: 10,
            shadowColor: creator.color + '80',
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 15,
              shadowColor: creator.color,
            },
          },
          z: 100,
        })
      }
    })

    console.log('[DarePlay] Total series count:', series.length, series.map(s => s.name))

    const option: echarts.EChartsOption = {
      backgroundColor: '#0a0a0a',
      animation: false,
      legend: {
        data: [
          chartData.primaryStock ? `${chartData.primaryStock.symbol} ${chartData.primaryStock.name}` : 'K线',
          ...chartData.creatorScatterData.map(({ creator }) => creator.nickname),
        ],
        top: 10,
        left: 'center',
        textStyle: { color: '#a3a3a3' },
        inactiveColor: '#404040',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        borderColor: '#333',
        textStyle: { color: '#e5e5e5' },
        enterable: true,
        hideDelay: 300,
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return ''

          // Check if hovering over scatter point (creator articles)
          const scatterParam = params.find((p: any) => p.seriesType === 'scatter')
          if (scatterParam?.data) {
            const { date, count, titles, creatorName, articleIds } = scatterParam.data
            let html = `<div style="font-weight:bold;margin-bottom:8px;">${date}</div>`
            html += `<div style="color:${scatterParam.color};margin-bottom:8px;">${creatorName}: ${count} 篇文章</div>`
            html += '<div style="max-height:200px;overflow-y:auto;">'
            titles.slice(0, 5).forEach((title: string, i: number) => {
              const truncated = title.length > 35 ? title.slice(0, 35) + '...' : title
              const articleId = articleIds[i] || ''
              html += `<a href="/sentiment/${articleId}" style="display:block;color:#a3a3a3;font-size:12px;margin:6px 0;text-decoration:none;padding:4px;border-radius:4px;background:rgba(255,255,255,0.05);" onmouseover="this.style.background='rgba(59,130,246,0.2)';this.style.color='#60a5fa'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#a3a3a3'">• ${truncated}</a>`
            })
            if (titles.length > 5) {
              html += `<div style="color:#666;font-size:11px;margin-top:4px;">还有 ${titles.length - 5} 篇...</div>`
            }
            html += '</div>'
            html += `<div style="color:${scatterParam.color};font-size:11px;margin-top:8px;text-align:center;">点击文章标题查看详情</div>`
            return html
          }

          // K-line tooltip
          const klineParam = params.find((p: any) => p.seriesType === 'candlestick')
          if (!klineParam) return ''

          const date = chartData.dates[klineParam.dataIndex]
          const [open, close, low, high] = klineParam.data
          const change = ((close - open) / open * 100).toFixed(2)
          const changeColor = close >= open ? '#ef4444' : '#22c55e'

          let html = `<div style="font-weight:bold;margin-bottom:8px;">${date}</div>`
          html += `<div>开盘: <span style="color:${changeColor}">${open.toFixed(2)}</span></div>`
          html += `<div>收盘: <span style="color:${changeColor}">${close.toFixed(2)}</span></div>`
          html += `<div>最高: <span style="color:#ef4444">${high.toFixed(2)}</span></div>`
          html += `<div>最低: <span style="color:#22c55e">${low.toFixed(2)}</span></div>`
          html += `<div>涨跌: <span style="color:${changeColor}">${Number(change) > 0 ? '+' : ''}${change}%</span></div>`

          return html
        },
      },
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
        label: { backgroundColor: '#333' },
      },
      grid: [
        {
          left: '10%',
          right: '8%',
          top: 60,
          height: '55%',
        },
        {
          left: '10%',
          right: '8%',
          top: '75%',
          height: '15%',
        },
      ],
      xAxis: [
        {
          type: 'category',
          data: chartData.dates,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#333' } },
          axisLabel: { color: '#a3a3a3' },
          splitLine: { show: false },
          min: 'dataMin',
          max: 'dataMax',
          axisPointer: { z: 100 },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: chartData.dates,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#333' } },
          axisLabel: { show: false },
          splitLine: { show: false },
          min: 'dataMin',
          max: 'dataMax',
        },
      ],
      yAxis: [
        {
          scale: true,
          splitArea: { show: false },
          axisLine: { lineStyle: { color: '#333' } },
          axisLabel: { color: '#a3a3a3' },
          splitLine: { lineStyle: { color: '#262626' } },
        },
        {
          scale: true,
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
          start: 0,
          end: 100,
        },
        {
          show: true,
          xAxisIndex: [0, 1],
          type: 'slider',
          top: '92%',
          start: 0,
          end: 100,
          height: 20,
          borderColor: '#333',
          backgroundColor: '#1a1a1a',
          fillerColor: 'rgba(59, 130, 246, 0.2)',
          handleStyle: { color: '#3b82f6' },
          textStyle: { color: '#a3a3a3' },
        },
      ],
      series,
    }

    chart.setOption(option, true)

    // Handle scatter point click
    chart.off('click')
    chart.on('click', (params: any) => {
      if (params.seriesType === 'scatter' && params.data) {
        const { date, articleIds, creatorName, creatorColor, creatorUserId } = params.data
        setSelectedArticleInfo({
          date,
          creatorName,
          creatorColor,
          creatorUserId,
          articleIds,
        })
        // Scroll to articles section
        setTimeout(() => {
          document.getElementById('articles-section')?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }
    })

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [chartData])

  // Cleanup
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose()
        chartInstance.current = null
      }
    }
  }, [])

  const handleAddStock = (stock: { code: string; name: string }) => {
    if (selectedStocks.length >= 5) return
    if (selectedStocks.some((s) => s.symbol === stock.code)) return

    const colorIndex = selectedStocks.length
    setSelectedStocks([
      ...selectedStocks,
      { symbol: stock.code, name: stock.name, color: STOCK_COLORS[colorIndex] },
    ])
    setAddStockOpen(false)
  }

  const handleRemoveStock = (symbol: string) => {
    setSelectedStocks(selectedStocks.filter((s) => s.symbol !== symbol))
  }

  const handleAddCreator = (creator: { user_id: string; user_nickname: string }) => {
    if (selectedCreators.length >= 3) return
    if (selectedCreators.some((c) => c.userId === creator.user_id)) return

    const colorIndex = selectedCreators.length
    setSelectedCreators([
      ...selectedCreators,
      { userId: creator.user_id, nickname: creator.user_nickname, color: CREATOR_COLORS[colorIndex] },
    ])
    setAddCreatorOpen(false)
  }

  const handleRemoveCreator = (userId: string) => {
    setSelectedCreators(selectedCreators.filter((c) => c.userId !== userId))
  }

  const availableCreators = allCreators?.filter(
    (c) => !selectedCreators.some((sc) => sc.userId === c.user_id)
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">舆论试炼场</h1>
        <p className="text-sm text-muted-foreground">
          对比股票走势与创作者发文时间，探索舆情与行情的关联
        </p>
      </div>

      {/* Selection panels */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Stocks panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                股票/基金 ({selectedStocks.length}/5)
              </span>
              <div className="flex items-center gap-1">
                {selectedStocks.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedStocks([])}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddStockOpen(true)}
                  disabled={selectedStocks.length >= 5}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  添加
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedStocks.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                点击添加按钮选择股票
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedStocks.map((stock) => (
                  <Badge
                    key={stock.symbol}
                    variant="secondary"
                    className="gap-1 pr-1"
                    style={{ borderColor: stock.color, borderWidth: 2 }}
                  >
                    <span style={{ color: stock.color }}>●</span>
                    {stock.symbol} {stock.name}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1 hover:bg-destructive/20"
                      onClick={() => handleRemoveStock(stock.symbol)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Creators panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <User className="h-4 w-4" />
                创作者 ({selectedCreators.length}/3)
              </span>
              <div className="flex items-center gap-1">
                {selectedCreators.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCreators([])}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddCreatorOpen(true)}
                  disabled={selectedCreators.length >= 3}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  添加
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedCreators.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                点击添加按钮选择创作者
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedCreators.map((creator) => (
                  <Badge
                    key={creator.userId}
                    variant="secondary"
                    className="gap-1 pr-1"
                    style={{ borderColor: creator.color, borderWidth: 2 }}
                  >
                    <span style={{ color: creator.color }}>●</span>
                    {creator.nickname}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1 hover:bg-destructive/20"
                      onClick={() => handleRemoveCreator(creator.userId)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardContent className="p-4">
          {selectedStocks.length === 0 && selectedCreators.length === 0 ? (
            <div className="flex h-[500px] items-center justify-center text-muted-foreground">
              请添加股票或创作者以显示图表
            </div>
          ) : (
            <div ref={chartRef} style={{ width: '100%', height: 500 }} />
          )}
        </CardContent>
      </Card>

      {/* Articles list - shown when a scatter point is clicked */}
      {selectedArticleInfo && (
        <Card id="articles-section">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                文章列表
              </span>
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  style={{ borderColor: selectedArticleInfo.creatorColor, borderWidth: 2 }}
                >
                  <span style={{ color: selectedArticleInfo.creatorColor }}>●</span>
                  <span className="ml-1">{selectedArticleInfo.creatorName}</span>
                </Badge>
                <Badge variant="outline">{selectedArticleInfo.date}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedArticleInfo(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {articlesLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="text-muted-foreground">加载中...</div>
              </div>
            ) : filteredArticles.length > 0 ? (
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
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                未找到相关文章
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add stock dialog */}
      <Dialog open={addStockOpen} onOpenChange={setAddStockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加股票/基金</DialogTitle>
          </DialogHeader>
          <StockSearch onSelect={handleAddStock} />
        </DialogContent>
      </Dialog>

      {/* Add creator dialog */}
      <Dialog open={addCreatorOpen} onOpenChange={setAddCreatorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择创作者</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {!availableCreators || availableCreators.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                暂无可选创作者
              </div>
            ) : (
              availableCreators.map((creator) => (
                <div
                  key={creator.user_id}
                  className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/50"
                  onClick={() => handleAddCreator(creator)}
                >
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
                  <div>
                    <div className="font-medium">{creator.user_nickname}</div>
                    <div className="text-xs text-muted-foreground">
                      {creator.article_count} 文章 · {creator.answer_count} 回答
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
