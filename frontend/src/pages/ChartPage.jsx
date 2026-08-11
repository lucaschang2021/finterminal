import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { api } from '../api'

const TYPES = ['line', 'bar', 'barh', 'area', 'stacked_bar', 'grouped_bar',
  'scatter', 'bubble', 'pie', 'donut', 'box', 'histogram']

export default function ChartPage({ initialPath }) {
  const [path, setPath] = useState(initialPath || '')
  const [chartType, setChartType] = useState('line')
  const [cols, setCols] = useState({ columns: [], numeric: [] })
  const [xCol, setXCol] = useState('')
  const [yCol, setYCol] = useState('')
  const [yCols, setYCols] = useState('')
  const [valueCol, setValueCol] = useState('')
  const [option, setOption] = useState(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialPath) { setPath(initialPath); loadCols(initialPath) }
  }, [initialPath])

  const loadCols = (p) => {
    if (!p) return
    api.columns(p).then((r) => {
      setCols({ columns: r.data.columns, numeric: r.data.numeric })
      setXCol(r.data.columns[0] || '')
      setYCol(r.data.numeric[0] || '')
    }).catch((e) => setErr(e.message))
  }

  const render = () => {
    setErr(''); setLoading(true); setOption(null)
    const params = { chart_type: chartType, path }
    if (xCol) params.x_column = xCol
    if (yCol) params.y_column = yCol
    if (yCols) params.y_columns = yCols
    if (valueCol) params.value_column = valueCol
    api.plotData(params).then((r) => {
      setOption(r.data.option)
    }).catch((e) => setErr(e.message)).finally(() => setLoading(false))
  }

  const isCategory = ['line', 'bar', 'barh', 'area', 'stacked_bar', 'grouped_bar'].includes(chartType)
  const isPie = ['pie', 'donut'].includes(chartType)

  return (
    <div>
      <h1 className="page-title">图表</h1>
      <p className="page-desc">ECharts 交互渲染：缩放、悬停、图例切换</p>

      <div className="card">
        <div className="row">
          <input className="input" value={path} onChange={(e) => setPath(e.target.value)}
            onBlur={() => loadCols(path)} placeholder="数据文件路径（CSV/Excel）" />
          <select className="select" value={chartType} onChange={(e) => setChartType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn" onClick={render} disabled={loading}>{loading ? '生成中…' : '渲染'}</button>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          {cols.columns.length > 0 && (
            <>
              {isCategory || isPie ? (
                <select className="select" value={xCol} onChange={(e) => setXCol(e.target.value)}>
                  {cols.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : null}
              {isCategory && (
                <input className="input" value={yCols || yCol} placeholder="数值列，逗号分隔（留空自动选）"
                  onChange={(e) => { setYCols(e.target.value); setYCol(e.target.value) }} />
              )}
              {!isCategory && !isPie && (
                <select className="select" value={yCol} onChange={(e) => setYCol(e.target.value)}>
                  {cols.numeric.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {isPie && (
                <select className="select" value={valueCol} onChange={(e) => setValueCol(e.target.value)}>
                  {cols.numeric.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <span className="badge gray">列：{cols.columns.join(', ')}</span>
            </>
          )}
        </div>
        {err && <p className="error" style={{ marginTop: 10 }}>{err}</p>}
      </div>

      <div className="card">
        {option ? (
          <ReactECharts option={option} className="chart-wrap" style={{ height: 480 }}
            notMerge opts={{ renderer: 'canvas' }} />
        ) : (
          <div className="chart-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>
            {loading ? '加载中…' : '配置参数后点击「渲染」'}
          </div>
        )}
      </div>
    </div>
  )
}
