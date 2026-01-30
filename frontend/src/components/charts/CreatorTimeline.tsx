import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { CreatorArticleTimelineItem } from '@/types'

interface CreatorTimelineProps {
  data: CreatorArticleTimelineItem[]
  height?: number
  onDateClick?: (date: string, articleIds: string[]) => void
}

export default function CreatorTimeline({
  data,
  height = 300,
  onDateClick,
}: CreatorTimelineProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return

    // Initialize chart
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark')
    }

    const chart = chartInstance.current

    const dates = data.map((d) => d.date)
    const counts = data.map((d) => d.count)

    const option: echarts.EChartsOption = {
      backgroundColor: '#0a0a0a',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        borderColor: '#333',
        textStyle: { color: '#e5e5e5' },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return ''
          const param = params[0]
          const item = data[param.dataIndex]
          if (!item) return ''

          let html = `<div style="font-weight:bold;margin-bottom:8px;">${item.date}</div>`
          html += `<div style="color:#3b82f6;margin-bottom:8px;">📰 ${item.count} 篇文章</div>`
          html += '<div style="max-height:150px;overflow-y:auto;">'
          item.titles.slice(0, 5).forEach((title) => {
            const truncated = title.length > 30 ? title.slice(0, 30) + '...' : title
            html += `<div style="color:#a3a3a3;font-size:12px;margin:4px 0;">• ${truncated}</div>`
          })
          if (item.titles.length > 5) {
            html += `<div style="color:#666;font-size:11px;margin-top:4px;">还有 ${item.titles.length - 5} 篇...</div>`
          }
          html += '</div>'
          html += '<div style="color:#3b82f6;font-size:11px;margin-top:8px;text-align:center;">点击查看该日文章</div>'
          return html
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: {
          color: '#a3a3a3',
          rotate: 45,
          fontSize: 10,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#a3a3a3' },
        splitLine: { lineStyle: { color: '#262626' } },
        minInterval: 1,
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
          top: '90%',
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
      series: [
        {
          name: '文章数',
          type: 'bar',
          data: counts,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#3b82f6' },
              { offset: 1, color: '#1d4ed8' },
            ]),
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#60a5fa' },
                { offset: 1, color: '#3b82f6' },
              ]),
            },
          },
        },
      ],
    }

    chart.setOption(option)

    // Remove old click handlers before adding new one
    chart.off('click')

    // Handle click on bars
    chart.on('click', (params: any) => {
      if (params.componentType === 'series' && onDateClick) {
        const item = data[params.dataIndex]
        if (item) {
          onDateClick(item.date, item.article_ids)
        }
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
  }, [data, onDateClick])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose()
        chartInstance.current = null
      }
    }
  }, [])

  if (data.length === 0) {
    return (
      <div
        style={{ width: '100%', height }}
        className="flex items-center justify-center text-muted-foreground"
      >
        暂无文章数据
      </div>
    )
  }

  return <div ref={chartRef} style={{ width: '100%', height }} />
}
