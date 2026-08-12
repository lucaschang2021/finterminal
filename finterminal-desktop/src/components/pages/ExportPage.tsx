import { useState } from 'react'

import { api, fileUrl } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { stripEmoji } from '@/lib/utils'

interface ExportGroup {
  title: string
  desc: string
  actions: { label: string; run: () => Promise<string> }[]
}

export default function ExportPage() {
  const [result, setResult] = useState('')
  const [path, setPath] = useState('')
  const [chartType, setChartType] = useState('line')
  const [busy, setBusy] = useState('')

  const groups: ExportGroup[] = [
    {
      title: '报告导出',
      desc: '统计分析报告 / 研报（PDF / Markdown）',
      actions: [
        {
          label: '生成 PDF 报告',
          run: async () => {
            if (!path) return '请先填写数据文件路径'
            const r = await api.analyze({ file_path: path, analysis: 'report', save: true, format: 'pdf', ai_comment: true })
            return r.text ?? ''
          },
        },
        {
          label: '生成 Markdown 报告',
          run: async () => {
            if (!path) return '请先填写数据文件路径'
            const r = await api.analyze({ file_path: path, analysis: 'report', save: true, format: 'md', ai_comment: true })
            return r.text ?? ''
          },
        },
      ],
    },
    {
      title: '图表导出',
      desc: 'PNG 静态图 / 交互式 HTML',
      actions: [
        {
          label: '保存 PNG 图表',
          run: async () => {
            if (!path) return '请先填写数据文件路径'
            const r = await api.plotSave({ chart_type: chartType, path })
            return r.text ?? ''
          },
        },
      ],
    },
    {
      title: '数据链证明',
      desc: '链状态 + 变更历史（JSON/文本）',
      actions: [
        {
          label: '导出链状态',
          run: async () => {
            const s = await api.chain({ action: 'status' })
            const h = await api.chain({ action: 'history' })
            return `${s.text ?? ''}\n\n${h.text ?? ''}`
          },
        },
      ],
    },
    {
      title: '知识库导出',
      desc: '文档列表与检索结果',
      actions: [
        {
          label: '导出文档清单',
          run: async () => {
            const r = await api.knowledge({ action: 'status' })
            return r.text ?? ''
          },
        },
      ],
    },
  ]

  const runAction = async (groupIdx: number, actionIdx: number) => {
    const a = groups[groupIdx].actions[actionIdx]
    setBusy(a.label); setResult('')
    try {
      setResult(await a.run())
    } catch (e) {
      setResult((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="p-5">
      <h2 className="page-title">导出</h2>
      <p className="page-sub mb-4">报告 · 图表 · 数据链证明 · 知识库</p>

      <div className="liquid-glass d2-cut mb-4 p-4">
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>参数</div>
        <div className="flex gap-2">
          <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="数据文件路径（报告/图表导出用）"
            className="glass-input h-9 flex-1 border-0" />
          <Input value={chartType} onChange={(e) => setChartType(e.target.value)} placeholder="图表类型 line"
            className="glass-input h-9 w-32 border-0" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {groups.map((g, gi) => (
          <div key={g.title} className="liquid-glass d2-cut p-4">
            <div className="mb-1 text-sm font-medium">{g.title}</div>
            <div className="mb-3 text-[11px]" style={{ color: 'var(--muted)' }}>{g.desc}</div>
            <div className="flex flex-wrap gap-2">
              {g.actions.map((a, ai) => (
                <Button key={a.label} size="sm" variant="secondary" onClick={() => runAction(gi, ai)} disabled={!!busy}>
                  {busy === a.label ? '导出中…' : a.label}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {result && (
        <div className="liquid-glass d2-cut mt-4 p-4">
          <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>导出结果</div>
          <pre className="mono max-h-72 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{stripEmoji(result)}</pre>
        </div>
      )}
    </div>
  )
}
