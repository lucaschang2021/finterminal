import { BookOpen, ChevronDown, ChevronUp, Database, FileText, FolderOpen, LineChart, Network } from 'lucide-react'
import { useEffect, useState } from 'react'

import { api } from '@/api'
import type { NavKey } from './SideNav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import EChart from './EChart'

const CHART_TYPES = ['line', 'bar', 'barh', 'area', 'stacked_bar', 'grouped_bar', 'scatter', 'pie', 'donut', 'box', 'histogram']

function TextOut({ text }: { text: string }) {
  return <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded bg-background p-3 text-xs leading-relaxed text-foreground/85">{text}</pre>
}

export default function BottomPanel({ activeTab, onTabChange }: { activeTab: NavKey; onTabChange: (k: NavKey) => void }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (activeTab !== 'chat') setOpen(true)
  }, [activeTab])

  const tab = activeTab === 'chat' ? 'chart' : activeTab

  return (
    <div className="shrink-0 border-t border-border bg-card/60">
      <div className="flex items-center gap-2 px-4 pt-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(!open)} className="h-7 gap-1 text-xs">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          工作区
        </Button>
        {open && (
          <TabsList className="h-7">
            <TabsTrigger value="chart" onClick={() => onTabChange('chart')} className="h-6 px-3 text-xs">图表</TabsTrigger>
            <TabsTrigger value="files" onClick={() => onTabChange('files')} className="h-6 px-3 text-xs">文件</TabsTrigger>
            <TabsTrigger value="analysis" onClick={() => onTabChange('analysis')} className="h-6 px-3 text-xs">统计分析</TabsTrigger>
            <TabsTrigger value="chain" onClick={() => onTabChange('chain')} className="h-6 px-3 text-xs">数据链</TabsTrigger>
            <TabsTrigger value="knowledge" onClick={() => onTabChange('knowledge')} className="h-6 px-3 text-xs">知识库</TabsTrigger>
            <TabsTrigger value="report" onClick={() => onTabChange('report')} className="h-6 px-3 text-xs">研报</TabsTrigger>
          </TabsList>
        )}
      </div>

      {open && (
        <div className="h-72 px-4 pb-3">
          <Tabs value={tab} onValueChange={(v) => onTabChange(v as NavKey)}>
            <TabsContent value="chart" className="mt-0 h-full">
              <ChartTab />
            </TabsContent>
            <TabsContent value="files" className="mt-0 h-full">
              <FilesTab />
            </TabsContent>
            <TabsContent value="analysis" className="mt-0 h-full">
              <AnalysisTab />
            </TabsContent>
            <TabsContent value="chain" className="mt-0 h-full">
              <ChainTab />
            </TabsContent>
            <TabsContent value="knowledge" className="mt-0 h-full">
              <KnowledgeTab />
            </TabsContent>
            <TabsContent value="report" className="mt-0 h-full">
              <ReportTab />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}

function ChartTab() {
  const [path, setPath] = useState('')
  const [chartType, setChartType] = useState('line')
  const [cols, setCols] = useState<{ columns: string[]; numeric: string[] }>({ columns: [], numeric: [] })
  const [xCol, setXCol] = useState('')
  const [yCol, setYCol] = useState('')
  const [option, setOption] = useState<Record<string, unknown> | null>(null)
  const [err, setErr] = useState('')

  const loadCols = (p: string) => {
    if (!p) return
    api.columns(p).then((r) => {
      const c = r.data ?? { columns: [], numeric: [] }
      setCols(c)
      setXCol(c.columns[0] ?? '')
      setYCol(c.numeric[0] ?? '')
    }).catch((e) => setErr((e as Error).message))
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
      <div className="w-72 shrink-0 space-y-2 pt-1">
        <Input value={path} onChange={(e) => setPath(e.target.value)} onBlur={() => loadCols(path)} placeholder="数据文件路径（CSV/Excel）" className="h-8 text-xs" />
        <div className="flex gap-2">
          <Select value={chartType} onValueChange={setChartType}>
            <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CHART_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={render}>渲染</Button>
        </div>
        {cols.columns.length > 0 && (
          <div className="space-y-2">
            <Select value={xCol} onValueChange={setXCol}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="X 轴" /></SelectTrigger>
              <SelectContent>
                {cols.columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={yCol} onValueChange={setYCol}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Y 轴" /></SelectTrigger>
              <SelectContent>
                {cols.numeric.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">列：{cols.columns.join(', ')}</p>
          </div>
        )}
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
      <div className="min-w-0 flex-1">
        {option ? (
          <EChart option={option} height="100%" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">配置参数后点击「渲染」</div>
        )}
      </div>
    </div>
  )
}

function FilesTab() {
  const [path, setPath] = useState('C:/Users/liuj/Desktop')
  const [keyword, setKeyword] = useState('')
  const [list, setList] = useState('')
  const [detect, setDetect] = useState('')
  const [err, setErr] = useState('')

  const load = () => {
    setErr('')
    api.files(path).then((r) => setList(r.text ?? '')).catch((e) => setErr((e as Error).message))
  }
  const search = () => {
    api.search(keyword, path, true).then((r) => setList(r.text ?? '')).catch((e) => setErr((e as Error).message))
  }
  useEffect(() => { load() }, [])

  return (
    <div className="flex h-full gap-3 pt-1">
      <div className="flex w-96 flex-col gap-2">
        <div className="flex gap-2">
          <Input value={path} onChange={(e) => setPath(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} className="h-8 text-xs" placeholder="目录" />
          <Button size="sm" variant="secondary" onClick={load}>浏览</Button>
        </div>
        <div className="flex gap-2">
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} className="h-8 text-xs" placeholder="搜索文件名关键词" />
          <Button size="sm" onClick={search}>搜索</Button>
        </div>
        <Input value={detect} onChange={(e) => setDetect(e.target.value)} className="h-8 text-xs" placeholder="粘贴文件路径做体检" />
        <Button size="sm" variant="secondary" onClick={() => api.detect(detect).then((r) => setList(r.text ?? '')).catch((e) => setErr((e as Error).message))}>检测</Button>
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
      <div className="min-w-0 flex-1">
        {list && <TextOut text={list} />}
      </div>
    </div>
  )
}

function AnalysisTab() {
  const [filePath, setFilePath] = useState('')
  const [analysis, setAnalysis] = useState('describe')
  const [extra, setExtra] = useState('')
  const [result, setResult] = useState('')
  const [err, setErr] = useState('')

  const run = () => {
    setErr('')
    const body: Record<string, unknown> = { file_path: filePath, analysis }
    if (extra) {
      if (['groupby', 'test'].includes(analysis)) body.group_column = extra
      if (['regression', 'vif'].includes(analysis)) body.x_columns = extra
      if (analysis === 'regression') body.y_column = (extra.split(',')[0] ?? '').trim()
      if (analysis === 'event') body.event_date = extra
      if (analysis === 'backtest') body.signal_column = extra
      body.value_columns = extra
    }
    api.analyze(body).then((r) => setResult(r.text ?? '')).catch((e) => setErr((e as Error).message))
  }

  return (
    <div className="flex h-full gap-3 pt-1">
      <div className="w-96 space-y-2">
        <Input value={filePath} onChange={(e) => setFilePath(e.target.value)} className="h-8 text-xs" placeholder="数据文件路径" />
        <Select value={analysis} onValueChange={setAnalysis}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['describe', 'correlation', 'groupby', 'regression', 'test', 'trend', 'vif', 'event', 'did', 'backtest', 'report'].map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={extra} onChange={(e) => setExtra(e.target.value)} className="h-8 text-xs" placeholder="参数（分组列/自变量/事件日期/信号列，逗号分隔）" />
        <Button size="sm" onClick={run}>分析</Button>
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
      <div className="min-w-0 flex-1">{result && <TextOut text={result} />}</div>
    </div>
  )
}

function ChainTab() {
  const [path, setPath] = useState('')
  const [result, setResult] = useState('')
  const actions: { key: string; label: string }[] = [
    { key: 'status', label: '状态' },
    { key: 'snapshot', label: '快照' },
    { key: 'verify', label: '校验' },
    { key: 'history', label: '历史' },
    { key: 'track', label: '跟踪' },
  ]
  const run = (action: string) => {
    api.chain({ action, path: path || undefined }).then((r) => setResult(r.text ?? '')).catch((e) => setResult(`❌ ${(e as Error).message}`))
  }
  return (
    <div className="flex h-full gap-3 pt-1">
      <div className="w-96 space-y-2">
        <Input value={path} onChange={(e) => setPath(e.target.value)} className="h-8 text-xs" placeholder="文件/目录路径（status 可留空）" />
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a.key} size="sm" variant="secondary" onClick={() => run(a.key)}>{a.label}</Button>
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1">{result && <TextOut text={result} />}</div>
    </div>
  )
}

function KnowledgeTab() {
  const [filePath, setFilePath] = useState('')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState('')
  const run = (action: string) => {
    if (action === 'query') {
      api.knowledgeQuery({ query_text: query, top_k: 5 }).then((r) => setResult(r.text ?? '')).catch((e) => setResult(`❌ ${(e as Error).message}`))
    } else {
      api.knowledge({ action, file_path: filePath || undefined }).then((r) => setResult(r.text ?? '')).catch((e) => setResult(`❌ ${(e as Error).message}`))
    }
  }
  return (
    <div className="flex h-full gap-3 pt-1">
      <div className="w-96 space-y-2">
        <Input value={filePath} onChange={(e) => setFilePath(e.target.value)} className="h-8 text-xs" placeholder="文件路径（txt/md/pdf/docx/csv/xlsx）" />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => run('add')}>添加文档</Button>
          <Button size="sm" variant="secondary" onClick={() => run('status')}>状态</Button>
        </div>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run('query')} className="h-8 text-xs" placeholder="检索：茅台的估值" />
        <Button size="sm" variant="secondary" onClick={() => run('query')}>检索</Button>
      </div>
      <div className="min-w-0 flex-1">{result && <TextOut text={result} />}</div>
    </div>
  )
}

function ReportTab() {
  const [topic, setTopic] = useState('写一份贵州茅台的研究报告')
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)
  const run = () => {
    setBusy(true)
    api.ask(topic).then((r) => setResult(r.text ?? '')).catch((e) => setResult(`❌ ${(e as Error).message}`)).finally(() => setBusy(false))
  }
  return (
    <div className="flex h-full gap-3 pt-1">
      <div className="w-96 space-y-2">
        <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} className="h-20 text-xs" placeholder="研报主题" />
        <Button size="sm" onClick={run} disabled={busy}>{busy ? '生成中…' : '生成研报'}</Button>
      </div>
      <div className="min-w-0 flex-1">{result && <TextOut text={result} />}</div>
    </div>
  )
}
