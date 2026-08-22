import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { BarChart3, ChevronUp, FileText, Link2, PieChart } from 'lucide-react'

import { api, fileUrl, streamAsk, type StatisticalArtifact } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useI18n } from '@/i18n/LanguageContext'
import { useCapabilities } from '@/lib/capabilities'
import type { ActiveFile } from '@/lib/active-file'
import { stripEmoji } from '@/lib/utils'
import EChart from './EChart'

interface BottomPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chartType?: string
  /** AI 对话中生成的图表文件（charts/ 下的 png/html 文件名） */
  chartFiles?: string[]
  /** AI 对话中 analyze 工具产生的统计结果，可与图表同时存在 */
  statResults?: StatisticalArtifact[]
  activeFile?: ActiveFile | null
}

export default function BottomPanel({ open, onOpenChange, chartType, chartFiles, statResults, activeFile }: BottomPanelProps) {
  const { t } = useI18n()
  const { chartTypes, analysisTypes } = useCapabilities()
  const panelRef = useRef<HTMLDivElement>(null)
  const [render, setRender] = useState(open)
  const [tab, setTab] = useState('report')

  // 组合成果优先展示图表；只有统计结果时直接进入统计分析。
  useEffect(() => {
    if (chartType || (chartFiles && chartFiles.length > 0)) setTab('chart')
    else if (statResults && statResults.length > 0) setTab('stats')
  }, [chartType, chartFiles, statResults])

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
      gsap.set(el, { height: open ? 420 : 22 })
    })
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        el,
        { height: open ? 22 : 420 },
        {
          height: open ? 420 : 22,
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
            {activeFile && (
              <div className="mb-2 flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px]" style={{ borderColor: 'var(--hairline)', background: 'rgba(255,255,255,0.035)' }}>
                <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate" title={activeFile.path}>{activeFile.path}</span>
                <span className="shrink-0" style={{ color: 'var(--muted)' }}>{activeFile.detection}</span>
              </div>
            )}
            <TabsList className="bp-tabs h-8 gap-1 border-0 bg-white/5">
              <TabsTrigger value="chart" className="h-6 gap-1.5 px-3 text-xs">
                {t('panel.chartDetail')}
                {!!chartFiles?.length && (
                  <span className="rounded-full bg-white/10 px-1.5 text-[10px] tabular-nums" aria-label={t('panel.resultCount', { n: chartFiles.length })}>
                    {chartFiles.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="report" className="h-6 px-3 text-xs">{t('panel.report')}</TabsTrigger>
              <TabsTrigger value="chain" className="h-6 px-3 text-xs">{t('panel.chainViz')}</TabsTrigger>
              <TabsTrigger value="stats" className="h-6 gap-1.5 px-3 text-xs">
                {t('panel.stats')}
                {!!statResults?.length && (
                  <span className="rounded-full bg-white/10 px-1.5 text-[10px] tabular-nums" aria-label={t('panel.resultCount', { n: statResults.length })}>
                    {statResults.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="chart" className="mt-2 h-[340px]">
              <ChartDetail initialType={chartType} chartFiles={chartFiles} chartTypes={chartTypes} activeFile={activeFile} />
            </TabsContent>
            <TabsContent value="report" className="mt-2 h-[340px]">
              <ReportTab activeFile={activeFile} />
            </TabsContent>
            <TabsContent value="chain" className="mt-2 h-[340px]">
              <ChainTab activeFile={activeFile} />
            </TabsContent>
            <TabsContent value="stats" className="mt-2 h-[340px]">
              <StatsTab generatedResults={statResults} analysisTypes={analysisTypes} activeFile={activeFile} />
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

/** 下边框交互图表界面：读取 .option.json（含 option + 绘图参数），支持切换图表类型、缩放、导出另存 */
function ChartFileCard({ name, chartTypes }: { name: string; chartTypes: string[] }) {
  const { t } = useI18n()
  const [activeName, setActiveName] = useState(name)
  const [payload, setPayload] = useState<{ chart_type: string; option: Record<string, unknown>; params: Record<string, string> } | null>(null)
  const [showFallback, setShowFallback] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPayload(null)
    setShowFallback(false)
    if (!activeName.toLowerCase().endsWith('.png')) {
      setShowFallback(true)
      return
    }
    let alive = true
    const optName = activeName.replace(/\.png$/i, '.option.json')
    fetch(fileUrl(optName))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no option'))))
      .then((json) => { if (alive && json) setPayload(json) })
      .catch(() => { if (alive) setShowFallback(true) })
    return () => { alive = false }
  }, [activeName])

  // 切换图表类型：用原始参数重新请求后端生成新 option
  const switchType = async (newType: string) => {
    if (!payload || newType === payload.chart_type || busy) return
    setBusy(true)
    setSaveErr(null)
    try {
      // 后端图表接口参数名为 path，而 option.json 里存的是 file_path，需转换；
      // 同时去掉旧类型的标题，让后端为新类型生成默认标题
      const { file_path, title: _oldTitle, ...rest } = payload.params || {}
      try {
        const r = await api.plotData({ ...rest, chart_type: newType, path: file_path || '' })
        if (r.data?.option) setPayload({ ...payload, chart_type: newType, option: r.data.option })
      } catch {
        const r = await api.plotSave({ ...rest, chart_type: newType, path: file_path || '' })
        const match = r.text?.match(/([^\\/\s:]+\.(?:png|html))/i)
        if (!match) throw new Error(r.text || '图表生成失败')
        setActiveName(match[1])
      }
    } catch (e) {
      setSaveErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const saveAs = async () => {
    setSaveErr(null)
    setSaved(null)
    try {
      const response = await fetch(fileUrl(activeName))
      if (!response.ok) throw new Error(`无法读取图表文件（${response.status}）`)
      const fileData = await response.arrayBuffer()
      if (!window.finterminal?.saveChart) {
        const href = URL.createObjectURL(new Blob([fileData]))
        const link = document.createElement('a')
        link.href = href; link.download = activeName; link.click()
        URL.revokeObjectURL(href)
        setSaved(activeName)
        return
      }
      const r = await window.finterminal.saveChart(activeName, fileData)
      if (r.ok) setSaved(r.path || '')
      else if (r?.canceled) { /* 用户取消 */ }
      else setSaveErr(r?.error || 'Save failed')
    } catch (e) {
      setSaveErr((e as Error).message)
    }
  }

  const isPng = activeName.toLowerCase().endsWith('.png')

  // 降级：无 ECharts option 时显示 PNG / HTML 链接
  if (!payload && showFallback) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center bg-background/50">
          {isPng ? (
            <img src={fileUrl(activeName)} alt={activeName} className="max-h-full w-full object-contain" />
          ) : (
            <a href={fileUrl(name)} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2.5 text-xs text-sky-300 hover:underline">
              <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
              交互图表: {activeName}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 border-t px-3 py-2" style={{ borderColor: 'var(--hairline)' }}>
          <button onClick={saveAs} className="rounded px-2 py-1 text-[11px] transition-colors hover:bg-white/10" style={{ color: 'var(--accent)' }}>
            {t('panel.saveAs')}
          </button>
          {saved && <span className="truncate text-[10px]" style={{ color: 'var(--ok)' }} title={saved}>{t('panel.savedTo', { path: saved })}</span>}
          {saveErr && <span className="truncate text-[10px]" style={{ color: 'var(--bad)' }}>{saveErr}</span>}
        </div>
      </div>
    )
  }
  if (!payload) return <div className="flex h-full items-center justify-center text-xs" style={{ color: 'var(--muted)' }}>{t('panel.generating')}</div>

  const option = {
    ...payload.option,
    // 交互增强：滚轮/滑块缩放 + 工具栏（还原、保存图片）
    toolbox: { feature: { dataZoom: { yAxisIndex: 'none' }, restore: {}, saveAsImage: {} } },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 14, bottom: 4 }],
  }
  const switchable = ['line', 'bar', 'area', 'stacked_bar', 'grouped_bar', 'scatter', 'pie', 'donut', 'box', 'histogram']
  return (
    <div className="flex h-full flex-col">
      {/* 顶部：图表类型切换 */}
      <div className="flex items-center gap-2 border-b px-3 py-1.5" style={{ borderColor: 'var(--hairline)' }}>
        <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{t('panel.chartType')}</span>
        <Select value={payload.chart_type} onValueChange={switchType} disabled={busy}>
          <SelectTrigger className="glass-input h-7 w-36 border-0 px-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {chartTypes.map((ct) => (
              <SelectItem key={ct} value={ct}>{t(`chartTypes.${ct}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {busy && <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{t('panel.generating')}</span>}
      </div>
      {/* 中部：交互大图 */}
      <div className="min-h-0 flex-1">
        <EChart option={option} height="100%" />
      </div>
      {/* 底部：导出 */}
      <div className="flex items-center gap-2 border-t px-3 py-1.5" style={{ borderColor: 'var(--hairline)' }}>
        <button
          onClick={saveAs}
          className="rounded bg-white/5 px-2.5 py-1 text-[11px] transition-colors hover:bg-white/10"
          style={{ color: 'var(--accent)' }}
        >
          {t('panel.saveAs')}
        </button>
        {saved && <span className="truncate text-[10px]" style={{ color: 'var(--ok)' }} title={saved}>{t('panel.savedTo', { path: saved })}</span>}
        {saveErr && <span className="truncate text-[10px]" style={{ color: 'var(--bad)' }}>{saveErr}</span>}
      </div>
    </div>
  )
}

function ChartDetail({ initialType, chartFiles, chartTypes, activeFile }: { initialType?: string; chartFiles?: string[]; chartTypes: string[]; activeFile?: ActiveFile | null }) {
  const { t } = useI18n()
  const [path, setPath] = useState(() => localStorage.getItem('ft_chart_path') || '')
  const [chartType, setChartType] = useState(initialType || localStorage.getItem('ft_chart_type') || 'line')
  const [cols, setCols] = useState<{ columns: string[]; numeric: string[] }>({ columns: [], numeric: [] })
  const [xCol, setXCol] = useState(() => localStorage.getItem('ft_chart_x') || '')
  const [yCol, setYCol] = useState(() => localStorage.getItem('ft_chart_y') || '')
  const [option, setOption] = useState<Record<string, unknown> | null>(null)
  const [err, setErr] = useState('')
  const [selectedChart, setSelectedChart] = useState(0)

  useEffect(() => {
    if (chartFiles?.length) setSelectedChart((current) => Math.min(current, chartFiles.length - 1))
  }, [chartFiles])

  useEffect(() => { if (initialType) setChartType(initialType) }, [initialType])
  useEffect(() => {
    if (activeFile?.capabilities.chart) {
      setPath(activeFile.path)
      loadCols(activeFile.path)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile?.path, activeFile?.capabilities.chart])

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

  // AI 生成图表时，整个面板显示专门交互图表界面（切换/缩放/导出）
  if (chartFiles && chartFiles.length > 0) {
    const activeChart = chartFiles[selectedChart] || chartFiles[0]
    return (
      <div className="flex h-full min-h-0 flex-col">
        {chartFiles.length > 1 && (
          <div className="mb-1.5 flex shrink-0 items-center gap-1.5 overflow-x-auto" aria-label="对话图表结果">
            {chartFiles.map((name, index) => (
              <button
                key={name}
                onClick={() => setSelectedChart(index)}
                className={`shrink-0 rounded-md border px-2.5 py-1 text-[11px] transition-colors ${selectedChart === index ? 'bg-white/10 text-[var(--accent)]' : 'text-[var(--muted)] hover:bg-white/5'}`}
                style={{ borderColor: 'var(--hairline)' }}
                title={name}
              >
                图表 {index + 1}
              </button>
            ))}
          </div>
        )}
        <div className="min-h-0 flex-1">
          <ChartFileCard key={activeChart} name={activeChart} chartTypes={chartTypes} />
        </div>
      </div>
    )
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
            {chartTypes.map((ct) => <SelectItem key={ct} value={ct}>{t(`chartTypes.${ct}`)}</SelectItem>)}
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
        <Button size="sm" onClick={render} disabled={!!activeFile && !activeFile.capabilities.chart} className="w-full">{t('panel.render')}</Button>
        {err && <p className="text-[11px] text-destructive">{err}</p>}
      </div>
      <div className="min-w-0 flex-1">
        {option ? (
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

function ReportTab({ activeFile }: { activeFile?: ActiveFile | null }) {
  const { t, lang } = useI18n()
  const [topic, setTopic] = useState(() => t('panel.reportTopic'))
  const untouched = useRef(true)
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (activeFile?.capabilities.report) {
      untouched.current = false
      setTopic(`请基于文件“${activeFile.path}”生成一份结构化研报，说明数据来源、核心发现、风险与建议。`)
    }
  }, [activeFile?.path, activeFile?.capabilities.report])
  useEffect(() => {
    if (untouched.current) setTopic(t('panel.reportTopic'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])
  const run = () => {
    setBusy(true); setResult('')
    const id = Date.now()
    const prepare = activeFile?.capabilities.report
      ? api.knowledge({ action: 'add', file_path: activeFile.path }).catch(() => undefined)
      : Promise.resolve()
    prepare
      .then(() => streamAsk(topic, (d) => setResult((prev) => prev + d)))
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

function ChainTab({ activeFile }: { activeFile?: ActiveFile | null }) {
  const { t } = useI18n()
  const [path, setPath] = useState(() => localStorage.getItem('ft_chain_path') || '')
  const [result, setResult] = useState('')
  useEffect(() => { if (activeFile?.capabilities.chain) setPath(activeFile.path) }, [activeFile?.path, activeFile?.capabilities.chain])
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

function StatsTab({ generatedResults, analysisTypes, activeFile }: { generatedResults?: StatisticalArtifact[]; analysisTypes: string[]; activeFile?: ActiveFile | null }) {
  const { t } = useI18n()
  const [filePath, setFilePath] = useState(() => localStorage.getItem('ft_stats_path') || '')
  const [analysis, setAnalysis] = useState('describe')
  const [extra, setExtra] = useState(() => localStorage.getItem('ft_stats_extra') || '')
  const [result, setResult] = useState('')
  const [selectedResult, setSelectedResult] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (activeFile?.capabilities.statistics) setFilePath(activeFile.path)
  }, [activeFile?.path, activeFile?.capabilities.statistics])

  const selectGeneratedResult = (index: number) => {
    const artifact = generatedResults?.[index]
    if (!artifact) return
    setSelectedResult(index)
    setResult(artifact.result)
    if (analysisTypes.includes(artifact.analysis)) setAnalysis(artifact.analysis)
    if (artifact.file_path) setFilePath(artifact.file_path)
  }

  useEffect(() => {
    if (generatedResults?.length) selectGeneratedResult(generatedResults.length - 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedResults])

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
    setBusy(true)
    api.analyze(body)
      .then((r) => setResult(r.text ?? ''))
      .catch((e) => setResult((e as Error).message))
      .finally(() => setBusy(false))
  }

  return (
    <div className="flex h-full gap-3">
      <div className="w-72 shrink-0 space-y-2">
        <Input value={filePath} onChange={(e) => { setFilePath(e.target.value); localStorage.setItem('ft_stats_path', e.target.value) }} placeholder={t('panel.filePath')}
          className="glass-input h-8 border-0 text-xs" />
        <Select value={analysis} onValueChange={setAnalysis}>
          <SelectTrigger className="glass-input h-8 w-full border-0 px-2 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {analysisTypes.map((a) => <SelectItem key={a} value={a}>{t(`statsTypes.${a}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={extra} onChange={(e) => { setExtra(e.target.value); localStorage.setItem('ft_stats_extra', e.target.value) }} placeholder={t('panel.paramsHint')}
          className="glass-input h-8 border-0 text-xs" />
        <Button size="sm" onClick={run} disabled={busy || (!!activeFile && !activeFile.capabilities.statistics)}>
          {busy ? t('panel.generating') : t('common.analyze')}
        </Button>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {!!generatedResults?.length && (
          <div className="mb-2 flex items-center gap-1.5 overflow-x-auto" aria-label="对话统计结果">
            {generatedResults.map((artifact, index) => (
              <button
                key={`${artifact.analysis}-${artifact.file_path}-${index}`}
                onClick={() => selectGeneratedResult(index)}
                className={`shrink-0 rounded-md border px-2.5 py-1 text-[11px] transition-colors ${selectedResult === index ? 'bg-white/10 text-[var(--accent)]' : 'text-[var(--muted)] hover:bg-white/5'}`}
                style={{ borderColor: 'var(--hairline)' }}
                title={artifact.file_path}
              >
                {t(`statsTypes.${artifact.analysis}`)} · {index + 1}
              </button>
            ))}
          </div>
        )}
        <ScrollArea className="min-h-0 flex-1">
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
    </div>
  )
}