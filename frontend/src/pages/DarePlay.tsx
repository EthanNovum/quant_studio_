import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as echarts from 'echarts'
import { X, Plus, TrendingUp, User } from 'lucide-react'
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
import { getCreators, getCreatorDetail } from '@/services/sentimentApi'
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

export default function DarePlay() {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  const [selectedStocks, setSelectedStocks] = useState<SelectedStock[]>([])
  const [selectedCreators, setSelectedCreators] = useState<SelectedCreator[]>([])
  const [addStockOpen, setAddStockOpen] = useState(false)
  const [addCreatorOpen, setAddCreatorOpen] = useState(false)

  // Fetch quotes for all selected stocks
  const stockQueries = selectedStocks.map((stock) => ({
    symbol: stock.symbol,
    query: useQuery({
      queryKey: ['quotes', stock.symbol],
      queryFn: () => getQuotes(stock.symbol),
      enabled: true,
    }),
  }))

  // Fetch creator details for timeline data
  const creatorQueries = selectedCreators.map((creator) => ({
    userId: creator.userId,
    query: useQuery({
      queryKey: ['creator-detail', creator.userId],
      queryFn: () => getCreatorDetail(creator.userId),
      enabled: true,
    }),
  }))

  // Fetch all creators for selection
  const { data: allCreators } = useQuery({
    queryKey: ['creators'],
    queryFn: getCreators,
  })

  // Prepare chart data
  const chartData = useMemo(() => {
    // Collect all dates from all stocks
    const allDates = new Set<string>()
    const stockDataMap = new Map<string, Map<string, Quote>>()

    stockQueries.forEach(({ symbol, query }) => {
      if (query.data) {
        const dateMap = new Map<string, Quote>()
        query.data.forEach((quote) => {
          allDates.add(quote.date)
          dateMap.set(quote.date, quote)
        })
        stockDataMap.set(symbol, dateMap)
      }
    })

    // Collect all article dates from creators
    const creatorArticleMap = new Map<string, Map<string, { count: number; titles: string[]; articleIds: string[] }>>()
    creatorQueries.forEach(({ userId, query }) => {
      if (query.data?.timeline) {
        const dateMap = new Map<string, { count: number; titles: string[]; articleIds: string[] }>()
        query.data.timeline.forEach((item) => {
          allDates.add(item.date)
          dateMap.set(item.date, {
            count: item.count,
            titles: item.titles,
            articleIds: item.article_ids,
          })
        })
        creatorArticleMap.set(userId, dateMap)
      }
    })

    // Sort dates
    const sortedDates = Array.from(allDates).sort()

    // Prepare stock series data (normalized to percentage change from first day)
    const stockSeries = selectedStocks.map((stock) => {
      const dateMap = stockDataMap.get(stock.symbol)
      if (!dateMap) return { stock, data: [] }

      // Find first valid close price
      let basePrice: number | null = null
      for (const date of sortedDates) {
        const quote = dateMap.get(date)
        if (quote) {
          basePrice = quote.close
          break
        }
      }

      const data = sortedDates.map((date) => {
        const quote = dateMap.get(date)
        if (!quote || !basePrice) return null
        // Return percentage change from base
        return Number((((quote.close - basePrice) / basePrice) * 100).toFixed(2))
      })

      return { stock, data }
    })

    // Prepare creator scatter data
    const creatorScatterData = selectedCreators.map((creator, creatorIndex) => {
      const dateMap = creatorArticleMap.get(creator.userId)
      if (!dateMap) return { creator, data: [] }

      const data: any[] = []
      sortedDates.forEach((date, dateIndex) => {
        const articles = dateMap.get(date)
        if (articles) {
          data.push({
            value: [dateIndex, 5 + creatorIndex * 3], // Fixed Y position per creator
            date,
            count: articles.count,
            titles: articles.titles,
            articleIds: articles.articleIds,
            creatorName: creator.nickname,
          })
        }
      })

      return { creator, data }
    })

    return {
      dates: sortedDates,
      stockSeries,
      creatorScatterData,
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

    const series: any[] = []

    // Add stock line series
    chartData.stockSeries.forEach(({ stock, data }) => {
      if (data.length > 0) {
        series.push({
          name: `${stock.symbol} ${stock.name}`,
          type: 'line',
          data,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: stock.color },
          itemStyle: { color: stock.color },
        })
      }
    })

    // Add creator scatter series
    chartData.creatorScatterData.forEach(({ creator, data }) => {
      if (data.length > 0) {
        series.push({
          name: creator.nickname,
          type: 'scatter',
          data,
          symbol: 'circle',
          symbolSize: (d: any) => Math.min(8 + d.count * 3, 20),
          itemStyle: {
            color: creator.color,
            shadowBlur: 8,
            shadowColor: creator.color + '80',
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 12,
            },
          },
          z: 10,
        })
      }
    })

    const option: echarts.EChartsOption = {
      backgroundColor: '#0a0a0a',
      animation: false,
      legend: {
        data: [
          ...chartData.stockSeries.map(({ stock }) => `${stock.symbol} ${stock.name}`),
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
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return ''

          // Check for scatter point
          const scatterParam = params.find((p: any) => p.seriesType === 'scatter')
          if (scatterParam?.data) {
            const { date, count, titles, creatorName } = scatterParam.data
            let html = `<div style="font-weight:bold;margin-bottom:8px;">${date}</div>`
            html += `<div style="color:${scatterParam.color};margin-bottom:8px;">👤 ${creatorName}: ${count} 篇文章</div>`
            html += '<div style="max-height:150px;overflow-y:auto;">'
            titles.slice(0, 3).forEach((title: string) => {
              const truncated = title.length > 30 ? title.slice(0, 30) + '...' : title
              html += `<div style="color:#a3a3a3;font-size:12px;margin:4px 0;">• ${truncated}</div>`
            })
            if (titles.length > 3) {
              html += `<div style="color:#666;font-size:11px;">还有 ${titles.length - 3} 篇...</div>`
            }
            html += '</div>'
            return html
          }

          // Line tooltip
          const date = chartData.dates[params[0]?.dataIndex]
          let html = `<div style="font-weight:bold;margin-bottom:8px;">${date}</div>`
          params.forEach((p: any) => {
            if (p.seriesType === 'line' && p.data !== null) {
              const color = p.data >= 0 ? '#ef4444' : '#22c55e'
              html += `<div><span style="color:${p.color}">●</span> ${p.seriesName}: <span style="color:${color}">${p.data > 0 ? '+' : ''}${p.data}%</span></div>`
            }
          })
          return html
        },
      },
      grid: {
        left: '8%',
        right: '5%',
        top: 80,
        bottom: 80,
      },
      xAxis: {
        type: 'category',
        data: chartData.dates,
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#a3a3a3' },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: {
          color: '#a3a3a3',
          formatter: (value: number) => `${value}%`,
        },
        splitLine: { lineStyle: { color: '#262626' } },
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          show: true,
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddStockOpen(true)}
                disabled={selectedStocks.length >= 5}
              >
                <Plus className="h-4 w-4 mr-1" />
                添加
              </Button>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddCreatorOpen(true)}
                disabled={selectedCreators.length >= 3}
              >
                <Plus className="h-4 w-4 mr-1" />
                添加
              </Button>
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
            {availableCreators?.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                暂无可选创作者
              </div>
            ) : (
              availableCreators?.map((creator) => (
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
