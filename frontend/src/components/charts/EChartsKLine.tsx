import { useEffect, useRef, useMemo } from 'react'
import * as echarts from 'echarts'
import type { Quote, SentimentMarker } from '@/types'

interface EChartsKLineProps {
  data: Quote[]
  sentimentMarkers?: SentimentMarker[]
  height?: number
  onMarkerClick?: (date: string, articleIds: string[]) => void
}

// Calculate MA (Moving Average)
function calculateMA(data: Quote[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else {
      let sum = 0
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close
      }
      result.push(Number((sum / period).toFixed(2)))
    }
  }
  return result
}

// Format large numbers
function formatVolume(value: number): string {
  if (value >= 100000000) {
    return (value / 100000000).toFixed(2) + '亿'
  } else if (value >= 10000) {
    return (value / 10000).toFixed(2) + '万'
  }
  return value.toString()
}

export default function EChartsKLine({
  data,
  sentimentMarkers,
  height = 500,
  onMarkerClick,
}: EChartsKLineProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  // Prepare data
  const chartData = useMemo(() => {
    const dates = data.map((d) => d.date)
    const ohlc = data.map((d) => [d.open, d.close, d.low, d.high])
    const volumes = data.map((d, i) => ({
      value: d.volume || 0,
      itemStyle: {
        color: d.close >= d.open ? '#ef4444' : '#22c55e',
      },
    }))

    // Create date -> index map for sentiment markers
    const dateIndexMap = new Map<string, number>()
    dates.forEach((date, index) => {
      dateIndexMap.set(date, index)
    })

    // Create date -> high price map
    const dateHighMap = new Map<string, number>()
    data.forEach((d) => {
      dateHighMap.set(d.date, d.high)
    })

    // Prepare sentiment scatter data
    const scatterData: any[] = []
    if (sentimentMarkers) {
      sentimentMarkers.forEach((marker) => {
        const index = dateIndexMap.get(marker.date)
        if (index !== undefined) {
          const highPrice = dateHighMap.get(marker.date) || 0
          scatterData.push({
            value: [index, highPrice * 1.03], // Position above the candle
            date: marker.date,
            count: marker.count,
            titles: marker.titles,
            articleIds: marker.article_ids,
            // Use is_weekend from backend (display_date != original_date)
            isWeekend: marker.is_weekend ?? false,
          })
        }
      })
    }

    return {
      dates,
      ohlc,
      volumes,
      scatterData,
      ma5: calculateMA(data, 5),
      ma10: calculateMA(data, 10),
      ma20: calculateMA(data, 20),
    }
  }, [data, sentimentMarkers])

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return

    // Initialize chart
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark')
    }

    const chart = chartInstance.current

    const option: echarts.EChartsOption = {
      backgroundColor: '#0a0a0a',
      animation: false,
      legend: {
        data: ['K线', 'MA5', 'MA10', 'MA20', '舆情'],
        top: 10,
        left: 'center',
        textStyle: { color: '#a3a3a3' },
        inactiveColor: '#404040',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        borderColor: '#333',
        textStyle: { color: '#e5e5e5' },
        enterable: true,
        hideDelay: 300,
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return ''

          // Check if hovering over scatter point
          const scatterParam = params.find((p: any) => p.seriesName === '舆情')
          if (scatterParam && scatterParam.data) {
            const { date, count, titles, articleIds, isWeekend } = scatterParam.data
            let html = `<div style="font-weight:bold;margin-bottom:8px;">${date} ${isWeekend ? '(发布于周末)' : ''}</div>`
            html += `<div style="color:#3b82f6;margin-bottom:8px;">📰 ${count} 篇相关文章</div>`
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
            html += '<div style="color:#3b82f6;font-size:11px;margin-top:8px;text-align:center;">👆 点击文章标题查看详情</div>'
            return html
          }

          // Normal K-line tooltip
          const klineParam = params.find((p: any) => p.seriesName === 'K线')
          if (!klineParam) return ''

          const date = chartData.dates[klineParam.dataIndex]
          const [open, close, low, high] = klineParam.data
          const quote = data[klineParam.dataIndex]
          const change = ((close - open) / open * 100).toFixed(2)
          const changeColor = close >= open ? '#ef4444' : '#22c55e'

          let html = `<div style="font-weight:bold;margin-bottom:8px;">${date}</div>`
          html += `<div>开盘: <span style="color:${changeColor}">${open.toFixed(2)}</span></div>`
          html += `<div>收盘: <span style="color:${changeColor}">${close.toFixed(2)}</span></div>`
          html += `<div>最高: <span style="color:#ef4444">${high.toFixed(2)}</span></div>`
          html += `<div>最低: <span style="color:#22c55e">${low.toFixed(2)}</span></div>`
          html += `<div>涨跌: <span style="color:${changeColor}">${change}%</span></div>`
          if (quote.volume) {
            html += `<div>成交量: ${formatVolume(quote.volume)}</div>`
          }

          // Show MA values
          params.forEach((p: any) => {
            if (p.seriesName.startsWith('MA') && p.data !== null) {
              html += `<div>${p.seriesName}: ${p.data}</div>`
            }
          })

          return html
        },
      },
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
        label: {
          backgroundColor: '#333',
        },
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
          start: 70,
          end: 100,
        },
        {
          show: true,
          xAxisIndex: [0, 1],
          type: 'slider',
          top: '92%',
          start: 70,
          end: 100,
          height: 20,
          borderColor: '#333',
          backgroundColor: '#1a1a1a',
          fillerColor: 'rgba(59, 130, 246, 0.2)',
          handleStyle: { color: '#3b82f6' },
          textStyle: { color: '#a3a3a3' },
        },
      ],
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: chartData.ohlc,
          itemStyle: {
            color: '#ef4444', // Up color (red for A-share)
            color0: '#22c55e', // Down color (green for A-share)
            borderColor: '#ef4444',
            borderColor0: '#22c55e',
          },
        },
        {
          name: 'MA5',
          type: 'line',
          data: chartData.ma5,
          smooth: true,
          lineStyle: { width: 1, color: '#f59e0b' },
          symbol: 'none',
        },
        {
          name: 'MA10',
          type: 'line',
          data: chartData.ma10,
          smooth: true,
          lineStyle: { width: 1, color: '#3b82f6' },
          symbol: 'none',
        },
        {
          name: 'MA20',
          type: 'line',
          data: chartData.ma20,
          smooth: true,
          lineStyle: { width: 1, color: '#a855f7' },
          symbol: 'none',
        },
        {
          name: '舆情',
          type: 'scatter',
          data: chartData.scatterData,
          symbol: 'circle',
          symbolSize: (data: any) => {
            const count = data.count || 1
            return Math.min(8 + count * 4, 24) // Size based on article count
          },
          itemStyle: {
            color: '#3b82f6',
            shadowBlur: 10,
            shadowColor: 'rgba(59, 130, 246, 0.5)',
          },
          emphasis: {
            itemStyle: {
              color: '#60a5fa',
              shadowBlur: 15,
              shadowColor: 'rgba(59, 130, 246, 0.8)',
            },
          },
          z: 10,
        },
        {
          name: '成交量',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: chartData.volumes,
        },
      ],
    }

    chart.setOption(option)

    // Remove old click handlers before adding new one
    chart.off('click')

    // Handle click on scatter points
    chart.on('click', 'series.scatter', (params: any) => {
      console.log('Scatter clicked:', params.data) // Debug log
      if (params.data && onMarkerClick) {
        onMarkerClick(params.data.date, params.data.articleIds)
      }
    })

    // Handle resize
    const handleResize = () => {
      chart.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.off('click')
    }
  }, [chartData, data, onMarkerClick])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose()
        chartInstance.current = null
      }
    }
  }, [])

  return <div ref={chartRef} style={{ width: '100%', height }} />
}
