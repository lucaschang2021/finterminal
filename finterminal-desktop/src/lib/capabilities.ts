import { useEffect, useState } from 'react'
import { api } from '@/api'

/** 前后端共用的能力兜底；运行时以 /health 返回的图表服务为准。 */
export const DEFAULT_CHART_TYPES = ['line', 'bar', 'barh', 'stacked_bar', 'grouped_bar', 'scatter', 'bubble', 'pie', 'donut', 'area', 'candlestick', 'box', 'violin', 'histogram', 'heatmap', 'radar', 'waterfall', 'funnel', 'step', 'polar', 'errorbar', 'treemap', 'scatter3d', 'surface', 'technical', 'wordcloud', 'sankey']
export const INTERACTIVE_CHART_TYPES = ['line', 'bar', 'barh', 'area', 'stacked_bar', 'grouped_bar', 'scatter', 'bubble', 'pie', 'donut', 'box', 'histogram']
export const ANALYSIS_TYPES = ['describe', 'correlation', 'groupby', 'regression', 'test', 'trend', 'vif', 'event', 'did', 'backtest', 'report']

export function useCapabilities() {
  const [chartTypes, setChartTypes] = useState<string[]>(DEFAULT_CHART_TYPES)
  const [error, setError] = useState('')
  useEffect(() => {
    api.health()
      .then((r) => { if (r.data?.charts?.length) setChartTypes(r.data.charts) })
      .catch((e) => setError((e as Error).message))
  }, [])
  return { chartTypes, analysisTypes: ANALYSIS_TYPES, error }
}