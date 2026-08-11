import { useEffect, useState } from 'react'

import { api, streamAsk } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import EChart from './EChart'

interface BottomPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chartType?: string
}

export default function BottomPanel({ open, onOpenChange, chartType }: BottomPanelProps) {
  return (
    <div
      className="relative shrink-0 overflow-hidden border-t transition-all duration-500"
      style={{
        height: open ? 340 : 22,
        borderColor: 'rgba(255,255,255,0.05)',
        background: open ? 'rgba(22,27,34,0.60)' : 'transparent',
        backdropFilter: open ? 'blur(28px) saturate(1.4)' : 'none',
        WebkitBackdropFilter: open ? 'blur(28px) saturate(1.4)' : 'none',
      }}
    >
      <div className="flow-current blue-gold" style={{ '--flow-strength': '8%', '--flow-speed': '16s' } as React.CSSProperties} />

      {/* 窗帘拉手 */}
      <button
        className="absolute left-1/2 top-0 z-10 flex h-[22px] -translate-x-1/2 items-center px-6"
        onClick={() => onOpenChange(!open)}
        title={open ? '收起' : '拉出'}
      >
        <span className="h-1 w-12 rounded-full bg-[var(--muted)] opacity-50 transition-all hover:w-16 hover:opacity-80" />
      </button>

      {open && (
        <div className="relative h-full px-4 pb-3 pt-3">
          <Tabs defaultValue={chartType ? 'chart' : 'report'}>
            <TabsList className="h-8 border-0 bg-white/5">
              <TabsTrigger value="chart" className="h-6 px-3 text-xs">图表详情</TabsTrigger>
              <TabsTrigger value="report" className="h-6 px-3 text-xs">研报分析</TabsTrigger>
              <TabsTrigger value="chain" className="h-6 px-3 text-xs">数据链可视化</TabsTrigger>
              <TabsTrigger value="stats" className="h-6 px-3 text-xs">统计分析</TabsTrigger>
            </TabsList>
            <TabsContent value="chart" className="mt-2 h-[270px]">
              <ChartDetail initialType={chartType} />
            </TabsContent>
            <TabsContent value="report" className="mt-2 h-[270px]">
              <ReportTab />
            </TabsContent>
            <TabsContent value="chain" className="mt-2 h-[270px]">
              <ChainTab />
            </TabsContent>
            <TabsContent value="stats" className="mt-2 h-[270px]">
              <StatsTab />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}

const CHART_TYPES = ['line', 'bar', 'area', 'stacked_bar', 'grouped_bar', 'scatter', 'pie', 'donut', 'box', 'histogram', 'radar', 'heatmap', 'candlestick']

function ChartDetail({ initialType }: { initialType?: string }) {
  const [path, setPath] = useState('')
  const [chartType, setChartType] = useState(initialType || 'line')
  const [cols, setCols] = useState<{ columns: string[]; numeric: string[] }>({ columns: [], numeric: [] })
  const [xCol, setXCol] = useState('')
  const [yCol, setYCol] = useState('')
  const [option, setOption] = useState<Record<string, unknown> | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => { if (initialType) setChartType(initialType) }, [initialType])

  const loadCols = (p: string) => {
    if (!p) return
    api.columns(p).then((r) => {
      const c = r.data ?? { columns: [], numeric: [] }
      setCols(c); setXCol(c.columns[0] ?? ''); setYCol(c.numeric[0] ?? '')
    }).catch(() => {})
  }

  const render = () => {
    setErr('')
    const params: Record<string, string> = { chart_type: chartType, path }
    if (xCol) params.x_column = xCol
    if (yCol) params.y_column = yCol
    api.plotData(params).then((r) => setOption(r.data?.option ?? null)).catch((e) => setErr((e as Error).message))
  }

  return (
    <div className="flex h-full gap-3">
      <div className="w-64 shrink-0 space-y-2">
        <Input value={path} onChange={(e) => setPath(e.target.value)} onBlur={() => loadCols(path)}
          placeholder="数据文件路径" className="glass-input h-8 border-0 text-xs" />
        <select value={chartType} onChange={(e) => setChartType(e.target.value)}
          className="glass-input h-8 w-full rounded-md px-2 text-xs outline-none">
          {CHART_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {cols.columns.length > 0 && (
          <>
            <select value={xCol} onChange={(e) => setXCol(e.target.value)}
              className="glass-input h-8 w-full rounded-md px-2 text-xs outline-none">
              {cols.columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={yCol} onChange={(e) => setYCol(e.target.value)}
              className="glass-input h-8 w-full rounded-md px-2 text-xs outline-none">
              {cols.numeric.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </>
        )}
        <Button size="sm" onClick={render} className="w-full">渲染</Button>
        {err && <p className="text-[11px] text-destructive">{err}</p>}
      </div>
      <div className="min-w-0 flex-1">
        {option ? <EChart option={option} height="100%" /> : (
          <div className="flex h-full items-center justify-center text-xs" style={{ color: 'var(--muted)' }}>
            配置参数后渲染（K线/技术面可留空路径走行情源）
          </div>
        )}
      </div>
    </div>
  )
}

function ReportTab() {
  const [topic, setTopic] = useState('写一份贵州茅台的研究报告')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const run = () => {
    setBusy(true); setResult('')
    const id = Date.now()
    streamAsk(topic, (d) => setResult((prev) => prev + d))
      .catch((e) => setResult(`❌ ${(e as Error).message}`))
      .finally(() => setBusy(false))
  }
  return (
    <div className="flex h-full gap-3">
      <div className="w-72 space-y-2">
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={4}
          className="glass-input w-full resize-none rounded-md p-2 text-xs outline-none" />
        <Button size="sm" onClick={run} disabled={busy}>{busy ? '生成中…' : '生成研报'}</Button>
      </div>
      <ScrollArea className="min-w-0 flex-1">
        {result && <pre className="mono whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{result}</pre>}
      </ScrollArea>
    </div>
  )
}

function ChainTab() {
  const [path, setPath] = useState('')
  const [result, setResult] = useState('')
  const run = (action: string) => {
    api.chain({ action, path: path || undefined }).then((r) => setResult(r.text ?? '')).catch((e) => setResult(`❌ ${(e as Error).message}`))
  }
  return (
    <div className="flex h-full gap-3">
      <div className="w-72 space-y-2">
        <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="路径（可选）"
          className="glass-input h-8 border-0 text-xs" />
        <div className="flex flex-wrap gap-2">
          {['status', 'snapshot', 'verify', 'history'].map((a) => (
            <Button key={a} size="sm" variant="secondary" onClick={() => run(a)}>{a}</Button>
          ))}
        </div>
      </div>
      <ScrollArea className="min-w-0 flex-1">
        {result && <pre className="mono whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{result}</pre>}
      </ScrollArea>
    </div>
  )
}

function StatsTab() {
  const [filePath, setFilePath] = useState('')
  const [analysis, setAnalysis] = useState('describe')
  const [extra, setExtra] = useState('')
  const [result, setResult] = useState('')
  const run = () => {
    const body: Record<string, unknown> = { file_path: filePath, analysis }
    if (extra) {
      if (['groupby', 'test'].includes(analysis)) body.group_column = extra
      if (['regression', 'vif'].includes(analysis)) body.x_columns = extra
      if (analysis === 'regression') body.y_column = extra.split(',')[0]?.trim()
      if (analysis === 'event') body.event_date = extra
      if (analysis === 'backtest') body.signal_column = extra
      body.value_columns = extra
    }
    api.analyze(body).then((r) => setResult(r.text ?? '')).catch((e) => setResult(`❌ ${(e as Error).message}`))
  }
  return (
    <div className="flex h-full gap-3">
      <div className="w-72 space-y-2">
        <Input value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="数据文件路径"
          className="glass-input h-8 border-0 text-xs" />
        <select value={analysis} onChange={(e) => setAnalysis(e.target.value)}
          className="glass-input h-8 w-full rounded-md px-2 text-xs outline-none">
          {['describe', 'correlation', 'groupby', 'regression', 'test', 'trend', 'vif', 'event', 'did', 'backtest', 'report'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="参数（分组列/自变量/事件日期/信号列）"
          className="glass-input h-8 border-0 text-xs" />
        <Button size="sm" onClick={run}>分析</Button>
      </div>
      <ScrollArea className="min-w-0 flex-1">
        {result && <pre className="mono whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{result}</pre>}
      </ScrollArea>
    </div>
  )
}
