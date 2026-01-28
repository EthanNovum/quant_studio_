import { useEffect, useRef, useState, useMemo } from 'react'
import { createChart, IChartApi, CandlestickData, Time, ISeriesApi, SeriesMarker } from 'lightweight-charts'
import type { Quote, SentimentMarker } from '@/types'

type Period = '5d' | 'daily' | 'weekly' | 'monthly' | 'all'

interface KLineChartProps {
  data: Quote[]
  height?: number
  sentimentMarkers?: SentimentMarker[]
}

// Aggregate daily data into weekly/monthly candles
function aggregateData(data: Quote[], period: Period): Quote[] {
  if (period === 'daily' || period === 'all' || data.length === 0) return data

  if (period === '5d') {
    // Return last 5 trading days
    return data.slice(-5)
  }

  const aggregated: Quote[] = []
  let currentGroup: Quote[] = []
  let currentKey = ''

  for (const quote of data) {
    const date = new Date(quote.date)
    let key: string

    if (period === 'weekly') {
      // Group by week (using ISO week)
      const year = date.getFullYear()
      const firstDayOfYear = new Date(year, 0, 1)
      const days = Math.floor((date.getTime() - firstDayOfYear.getTime()) / 86400000)
      const week = Math.ceil((days + firstDayOfYear.getDay() + 1) / 7)
      key = `${year}-W${week}`
    } else {
      // Group by month
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }

    if (key !== currentKey && currentGroup.length > 0) {
      // Aggregate current group
      aggregated.push(aggregateGroup(currentGroup))
      currentGroup = []
    }

    currentKey = key
    currentGroup.push(quote)
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    aggregated.push(aggregateGroup(currentGroup))
  }

  return aggregated
}

function aggregateGroup(group: Quote[]): Quote {
  const first = group[0]
  const last = group[group.length - 1]

  return {
    date: last.date, // Use last date of the period
    open: first.open,
    high: Math.max(...group.map(q => q.high)),
    low: Math.min(...group.map(q => q.low)),
    close: last.close,
    volume: group.reduce((sum, q) => sum + (q.volume || 0), 0),
    turnover: group.reduce((sum, q) => sum + (q.turnover || 0), 0),
    turnover_rate: null,
    pe_ttm: last.pe_ttm,
    pb: last.pb,
    market_cap: last.market_cap,
  }
}

const periodLabels: Record<Period, string> = {
  '5d': '五日',
  'daily': '日K',
  'weekly': '周K',
  'monthly': '月K',
  'all': '成立以来',
}

export default function KLineChart({ data, height = 400, sentimentMarkers }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [period, setPeriod] = useState<Period>('daily')

  const displayData = useMemo(() => aggregateData(data, period), [data, period])

  useEffect(() => {
    if (!containerRef.current || displayData.length === 0) return

    // Create chart
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: '#0a0a0a' },
        textColor: '#a3a3a3',
      },
      grid: {
        vertLines: { color: '#262626' },
        horzLines: { color: '#262626' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#262626',
      },
      timeScale: {
        borderColor: '#262626',
        timeVisible: true,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
    })

    chartRef.current = chart

    // Add candlestick series with A-share colors (red=up, green=down)
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#ef4444',
      downColor: '#22c55e',
      borderUpColor: '#ef4444',
      borderDownColor: '#22c55e',
      wickUpColor: '#ef4444',
      wickDownColor: '#22c55e',
    })

    // Transform data
    const chartData: CandlestickData<Time>[] = displayData.map((q) => ({
      time: q.date as Time,
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
    }))

    candleSeries.setData(chartData)

    // Add sentiment markers if available (only for daily view)
    if (sentimentMarkers && sentimentMarkers.length > 0 && period === 'daily') {
      // Create a map of date -> high price for positioning markers
      const dateHighMap = new Map<string, number>()
      displayData.forEach((q) => {
        dateHighMap.set(q.date, q.high)
      })

      // Create markers for sentiment data
      const markers: SeriesMarker<Time>[] = sentimentMarkers
        .filter((m) => dateHighMap.has(m.date))
        .map((marker) => ({
          time: marker.date as Time,
          position: 'aboveBar' as const,
          color: '#3b82f6', // Blue color for sentiment markers
          shape: 'circle' as const,
          text: marker.count > 1 ? `${marker.count}` : '',
          size: Math.min(marker.count, 3), // Size based on count, max 3
        }))

      if (markers.length > 0) {
        candleSeries.setMarkers(markers)
      }
    }

    // Add volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    })

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    })

    const volumeData = displayData.map((q) => ({
      time: q.date as Time,
      value: q.volume || 0,
      color: q.close >= q.open ? '#ef4444' : '#22c55e',
    }))

    volumeSeries.setData(volumeData)

    // Set visible range based on period
    if (displayData.length > 0) {
      const lastDate = new Date(displayData[displayData.length - 1].date)
      let fromDate: Date

      if (period === 'daily') {
        // Daily K: show last 3 months
        fromDate = new Date(lastDate)
        fromDate.setMonth(fromDate.getMonth() - 3)
      } else if (period === 'weekly') {
        // Weekly K: show last 24 months
        fromDate = new Date(lastDate)
        fromDate.setMonth(fromDate.getMonth() - 24)
      } else {
        // For 5d, monthly, all: fit all content
        chart.timeScale().fitContent()
        fromDate = new Date(0) // Will be ignored since we already called fitContent
      }

      if (period === 'daily' || period === 'weekly') {
        const fromDateStr = fromDate.toISOString().split('T')[0]
        const toDateStr = lastDate.toISOString().split('T')[0]
        chart.timeScale().setVisibleRange({
          from: fromDateStr as Time,
          to: toDateStr as Time,
        })
      }
    }

    // Handle resize
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [displayData, height, sentimentMarkers, period])

  return (
    <div className="w-full">
      {/* Period selector */}
      <div className="mb-2 flex gap-1">
        {(Object.keys(periodLabels) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              period === p
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div ref={containerRef} className="w-full" />
    </div>
  )
}
