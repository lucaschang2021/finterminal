import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { BarChart3, ChevronUp, FileText, Link2, PieChart } from 'lucide-react'

import { api, fileUrl, streamAsk } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useI18n } from '@/i18n/LanguageContext'
import { stripEmoji } from '@/lib/utils'
import EChart from './EChart'

interface BottomPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chartType?: string
  /** AI 对话中生成的图表文件（charts/ 下的 png/html 文件名） */
  chartFiles?: string[]
}

export default function BottomPanel({ open, onOpenChange, chartType, chartFiles }: BottomPanelProps) {
  const { t } = useI18n()
  const panelRef = useRef<HTMLDivElement>(null)
  const [render, setRender] = useState(open)
  const [tab, setTab] = useState('report')

  // 有图表类型或 AI 生成的图表时，自动切到「图表详情」
  useEffect(() => {
    if (chartType || (chartFiles && chartFiles.length > 0)) setTab('chart')
  }, [chartType, chartFiles])

  useEffect(() => {
    if (open) {
      setRender(true)
    } else {
      const t = window.setTimeout(() => setRender(false), 450)
      return () => window.clearTimeout(t)
    }
  }, [open])

  // 抽屉开合：弹性缓动 + 内容浮入
  useGSAP(() => {
    const el = panelRef.current
    if (!el) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(el, { height: open ? 340 : 22 })
    })
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        el,
        { height: open ? 22 : 340 },
        {
          height: open ? 340 : 22,
          duration: open ? 0.62 : 0.32,
          ease: open ? 'elastic.out(1, 0.7)' : 'power3.inOut',
          overwrite: 'auto',
        },
      )
      if (open) {
        gsap.fromTo(
          '.bp-content',
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.5, delay: 0.1, ease: 'power3.out', clearProps: 'transform' },
        )
      }
    })
    return () => mm.revert()
  }, { scope: panelRef, dependencies: [open] })

  return (
    <div
      ref={panelRef}
      className="glass-highlight relative shrink-0 overflow-hidden border-t"
      style={{
        height: 22,
        borderColor: 'var(--hairline)',
        background: open ? 'var(--glass-bg)' : 'transparent',
      }}
    >
      {/* 窗口拉手 */}
      <button
        className="absolute left-1/2 top-0 z-10 flex h-[22px] -translate-x-1/2 items-center justify-center"
        onClick={() => onOpenChange(!open)}
        title={open ? t('panel.collapse') : t('panel.pullUp')}
      >
        <span
          className="flex h-[15px] w-12 items-center justify-center rounded-b-md border-x border-b"
          style={{
            borderColor: 'var(--hairline-strong)',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--muted)',
          }}
        >
          <ChevronUp
            className="h-3 w-3"
            strokeWidth={2}
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.35s ease' }}
          />
        </span>
      </button>

      {render && (
        <div className="bp-content relative h-full px-4 pb-3 pt-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bp-tabs h-8 gap-1 border-0 bg-white/5">
              <TabsTrigger value="chart" className="h-6 px-3 text-xs">{t('panel.chartDetail')}</TabsTrigger>
              <TabsTrigger value="report" className="h-6 px-3 text-xs">{t('panel.report')}</TabsTrigger>
              <TabsTrigger value="chain" className="h-6 px-3 text-xs">{t('panel.chainViz')}</TabsTrigger>
              <TabsTrigger value="stats" className="h-6 px-3 text-xs">{t('panel.stats')}</TabsTrigger>
            </TabsList>
            <TabsContent value="chart" className="mt-2 h-[270px]">
              <ChartDetail initialType={chartType} chartFiles={chartFiles} />
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

/** 精致的空状态引导卡片，避免面板里出现大块空白 */
function EmptyState({
  icon,
  title,
  desc,
  actions,
}: {
  icon: ReactNode
  title: string
  desc: string
  actions: string[]
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div
        className="liquid-glass flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ borderRadius: 16 }}
      >
        <span className="flex items-center justify-center text-[var(--accent)]">{icon}</span>
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="max-w-sm text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{desc}</div>
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        {actions.map((a) => (
          <span
            key={a}
            className="rounded-full border px-3 py-1 text-xs transition-colors"
            style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'var(--muted)' }}
          >
            {a}
          </span>
        ))}
      </div>
    </div>
  )
}

const CHART_TYPES = ['line', 'bar', 'barh', 'stacked_bar', 'grouped_bar', 'scatter', 'bubble', 'pie', 'donut', 'area', 'candlestick', 'box', 'violin', 'histogram', 'heatmap', 'radar', 'waterfall', 'funnel', 'step', 'polar', 'errorbar', 'treemap', 'scatter3d', 'surface', 'technical', 'wordcloud', 'sankey']

/** AI 生成的图表：优先读取配套的 .option.json 用 ECharts 交互渲染，否则降级显示 PNG/HTML */
function ChartFileCard({ name }: { name: string }) {
  const [option, setOption] = useState<Record<string, unknown> | null>(null)
  const [showFallback, setShowFallback] = useState(false)

  useEffect(() => {
    if (!name.toLowerCase().endsWith('.png')) {
      setShowFallback(true)
      return
    }
    let alive = true
    const optName = name.replace(/\.png$/i, '.option.json')
    fetch(fileUrl(optName))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no option'))))
      .then((opt) => { if (alive && opt) setOption(opt) })
      .catch(() => { if (alive) setShowFallback(true) })
    return () => { alive = false }
  }, [name])

  if (option) {
    return (
      <div className="mb-2 h-48 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--hairline)' }}>
        <EChart option={option} height="100%" />
      </div>
    )
  }
  if (showFallback) {
    return (
      <div className="mb-2 overflow-hidden rounded-lg border bg-background/50" style={{ borderColor: 'var(--hairline)' }}>
        {name.toLowerCase().endsWith('.png') ? (
          <img src={fileUrl(name)} alt={name} className="max-h-44 w-full object-contain" />
        ) : (
          <a
            href={fileUrl(name)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2.5 text-xs text-sky-300 hover:underline"
          >
            <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
            交互图表: {name}
          </a>
        )}
      </div>
    )
  }
  return <div className="mb-2 h-48 rounded-lg border" style={{ borderColor: 'var(--hairline)' }} />
}

function ChartDetail({ initialType, chartFiles }: { initialType?: string; chartFiles?: string[] }) {
  const { t } = useI18n()
  const [path, setPath] = useState(() => localStorage.getItem('ft_chart_path') || '')
  const [chartType, setChartType] = useState(initialType || localStorage.getItem('ft_chart_type') || 'line')
  const [cols, setCols] = useState<{ columns: string[]; numeric: string[] }>({ columns: [], numeric: [] })
  const [xCol, setXCol] = useState(() => localStorage.getItem('ft_chart_x') || '')
  const [yCol, setYCol] = useState(() => localStorage.getItem('ft_chart_y') || '')
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
        <Input value={path} onChange={(e) => { setPath(e.target.value); localStorage.setItem('ft_chart_path', e.target.value) }} onBlur={() => loadCols(path)}
          placeholder={t('panel.dataPath')} className="glass-input h-8 border-0 text-xs" />
        <Select value={chartType} onValueChange={(v) => { setChartType(v); localStorage.setItem('ft_chart_type', v) }}>
          <SelectTrigger className="glass-input h-8 w-full border-0 px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHART_TYPES.map((ct) => <SelectItem key={ct} value={ct}>{t(`chartTypes.${ct}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        {cols.columns.length > 0 && (
          <>
            <Select value={xCol} onValueChange={(v) => { setXCol(v); localStorage.setItem('ft_chart_x', v) }}>
              <SelectTrigger className="glass-input h-8 w-full border-0 px-2 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cols.columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={yCol} onValueChange={(v) => { setYCol(v); localStorage.setItem('ft_chart_y', v) }}>
              <SelectTrigger className="glass-input h-8 w-full border-0 px-2 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cols.numeric.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}
        <Button size="sm" onClick={render} className="w-full">{t('panel.render')}</Button>
        {err && <p className="text-[11px] text-destructive">{err}</p>}
      </div>
      <div className="min-w-0 flex-1">
        {chartFiles && chartFiles.length > 0 ? (
          <div className="rb-scroll h-full overflow-y-auto pr-1">
            {chartFiles.map((name) => <ChartFileCard key={name} name={name} />)}
          </div>
        ) : option ? (
          <EChart option={option} height="100%" />
        ) : (
          <EmptyState
            icon={<BarChart3 className="h-6 w-6" />}
            title={t('panel.noChart')}
            desc={t('panel.noChartDesc')}
            actions={[t('chartTypes.line'), t('chartTypes.candlestick'), t('chartTypes.pie'), t('chartTypes.heatmap')]}
          />
        )}
      </div>
    </div>
  )
}

function ReportTab() {
  const { t, lang } = useI18n()
  const [topic, setTopic] = useState(() => t('panel.reportTopic'))
  const untouched = useRef(true)
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (untouched.current) setTopic(t('panel.reportTopic'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])
  const run = () => {
    setBusy(true); setResult('')
    const id = Date.now()
    streamAsk(topic, (d) => setResult((prev) => prev + d))
      .catch((e) => setResult((e as Error).message))
      .finally(() => setBusy(false))
  }
  return (
    <div className="flex h-full gap-3">
      <div className="w-72 shrink-0 space-y-2">
        <textarea value={topic} onChange={(e) => { untouched.current = false; setTopic(e.target.value) }} rows={4}
          className="glass-input w-full resize-none rounded-md p-2 text-xs outline-none" />
        <Button size="sm" onClick={run} disabled={busy}>{busy ? t('panel.generating') : t('panel.genReport')}</Button>
      </div>
      <ScrollArea className="min-w-0 flex-1">
        {result ? (
          <pre className="mono whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{stripEmoji(result)}</pre>
        ) : (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title={t('panel.reportGen')}
            desc={t('panel.reportGenDesc')}
            actions={[t('panel.reportAction1'), t('panel.reportAction2'), t('panel.reportAction3')]}
          />
        )}
      </ScrollArea>
    </div>
  )
}

function ChainTab() {
  const { t } = useI18n()
  const [path, setPath] = useState(() => localStorage.getItem('ft_chain_path') || '')
  const [result, setResult] = useState('')
  const run = (action: string) => {
    api.chain({ action, path: path || undefined }).then((r) => setResult(r.text ?? '')).catch((e) => setResult((e as Error).message))
  }
  return (
    <div className="flex h-full gap-3">
      <div className="w-72 shrink-0 space-y-2">
        <Input value={path} onChange={(e) => { setPath(e.target.value); localStorage.setItem('ft_chain_path', e.target.value) }} placeholder={t('panel.pathOptional')}
          className="glass-input h-8 border-0 text-xs" />
        <div className="flex flex-wrap gap-2">
          {['status', 'snapshot', 'verify', 'history'].map((a) => (
            <Button key={a} size="sm" variant="secondary" onClick={() => run(a)}>
              {a === 'status' ? t('common.status') : a === 'snapshot' ? t('chain.snapshot') : a === 'verify' ? t('chain.verify') : t('chain.history')}
            </Button>
          ))}
        </div>
      </div>
      <ScrollArea className="min-w-0 flex-1">
        {result ? (
          <pre className="mono whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{stripEmoji(result)}</pre>
        ) : (
          <EmptyState
            icon={<Link2 className="h-6 w-6" />}
            title={t('panel.chainTitle')}
            desc={t('panel.chainDesc')}
            actions={[t('common.status'), t('chain.snapshot'), t('chain.verify'), t('chain.history')]}
          />
        )}
      </ScrollArea>
    </div>
  )
}

function StatsTab() {
  const { t } = useI18n()
  const [filePath, setFilePath] = useState(() => localStorage.getItem('ft_stats_path') || '')
  const [analysis, setAnalysis] = useState('describe')
  const [extra, setExtra] = useState(() => localStorage.getItem('ft_stats_extra') || '')
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
    api.analyze(body).then((r) => setResult(r.text ?? '')).catch((e) => setResult((e as Error).message))
  }
  return (
    <div className="flex h-full gap-3">
      <div className="w-72 shrink-0 space-y-2">
        <Input value={filePath} onChange={(e) => { setFilePath(e.target.value); localStorage.setItem('ft_stats_path', e.target.value) }} placeholder={t('panel.filePath')}
          className="glass-input h-8 border-0 text-xs" />
        <Select value={analysis} onValueChange={setAnalysis}>
          <SelectTrigger className="glass-input h-8 w-full border-0 px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['describe', 'correlation', 'groupby', 'regression', 'test', 'trend', 'vif', 'event', 'did', 'backtest', 'report'].map((a) => (
              <SelectItem key={a} value={a}>{t(`statsTypes.${a}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={extra} onChange={(e) => { setExtra(e.target.value); localStorage.setItem('ft_stats_extra', e.target.value) }} placeholder={t('panel.paramsHint')}
          className="glass-input h-8 border-0 text-xs" />
        <Button size="sm" onClick={run}>{t('common.analyze')}</Button>
      </div>
      <ScrollArea className="min-w-0 flex-1">
        {result ? (
          <pre className="mono whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{stripEmoji(result)}</pre>
        ) : (
          <EmptyState
            icon={<PieChart className="h-6 w-6" />}
            title={t('panel.statsTitle')}
            desc={t('panel.statsDesc')}
            actions={[t('panel.statsAction1'), t('panel.statsAction2'), t('panel.statsAction3'), t('panel.statsAction4')]}
          />
        )}
      </ScrollArea>
    </div>
  )
}
