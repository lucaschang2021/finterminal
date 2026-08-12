import * as echarts from 'echarts'
import { useEffect, useRef } from 'react'

interface EChartProps {
  option: Record<string, unknown>
  height?: number | string
  className?: string
}

const CHART_FONT =
  "'Rajdhani', 'SF Pro Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"

export default function EChart({ option, height = 360, className }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current)
    chartRef.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(containerRef.current)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    if (chartRef.current && option) {
      chartRef.current.setOption(
        {
          textStyle: { fontFamily: CHART_FONT },
          title: { textStyle: { fontFamily: CHART_FONT } },
          legend: { textStyle: { fontFamily: CHART_FONT } },
          tooltip: { textStyle: { fontFamily: CHART_FONT } },
          ...option,
        },
        true,
      )
    }
  }, [option])

  return <div ref={containerRef} className={className} style={{ height, width: '100%' }} />
}
