import { Pin, TriangleAlert } from 'lucide-react'

import { fileUrl } from '@/api'
import { stripEmoji } from '@/lib/utils'

/**
 * 轻量 Markdown 渲染：
 * - 标题 / 列表 / 代码块 / 表格（简单）/ 段落 / 加粗
 * - 图表内联：识别 "✅ 图表已保存: .../charts/xxx.png" 与 "交互图表: .../xxx.html"
 * - 来源标注（📌 来源 / ⚠️ 风险提示）高亮
 */

function extractPngs(text: string): string[] {
  const out: string[] = []
  const re = /\bcharts[\\/][A-Za-z0-9_\-]+\.png/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const name = m[0].split(/[\\/]/).pop()!
    if (!out.includes(name)) out.push(name)
  }
  return out
}

function renderLine(line: string, key: number) {
  const t = line.trim()
  if (!t) return null
  if (t.startsWith('### ')) return <h4 key={key} className="mt-3 mb-1 font-semibold">{t.slice(4)}</h4>
  if (t.startsWith('## ')) return <h3 key={key} className="mt-4 mb-1 text-lg font-semibold">{t.slice(3)}</h3>
  if (t.startsWith('# ')) return <h2 key={key} className="mt-4 mb-2 text-xl font-bold">{t.slice(2)}</h2>
  if (/^[-*] /.test(t)) return <div key={key} className="pl-4 flex gap-2"><span>•</span><span>{renderInline(t.slice(2))}</span></div>
  if (t.startsWith('```')) return null
  if (t.startsWith('|') && t.endsWith('|')) {
    const cells = t.slice(1, -1).split('|').map((c) => c.trim())
    if (cells.every((c) => /^:?-+:?$/.test(c))) return null
    return (
      <div key={key} className="flex gap-3 border-b border-border py-0.5 text-[13px]">
        {cells.map((c, i) => <span key={i} className="min-w-10">{renderInline(c)}</span>)}
      </div>
    )
  }
  if (t.startsWith('📌') || t.startsWith('⚠️')) {
    const risk = t.startsWith('⚠️')
    const Icon = risk ? TriangleAlert : Pin
    return (
      <div
        key={key}
        className={`mt-2 flex items-start gap-2 rounded px-3 py-2 text-[12px] ${risk ? 'bg-amber-500/10 text-amber-300' : 'bg-sky-500/10 text-sky-300'}`}
      >
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        <span>{renderInline(t.replace(/^[📌⚠️]\s*/, ''))}</span>
      </div>
    )
  }
  return <p key={key} className="leading-relaxed">{renderInline(t)}</p>
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
      : <span key={i}>{stripEmoji(p)}</span>,
  )
}

export default function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const pngs = extractPngs(text)
  return (
    <div className="text-sm text-foreground/90">
      {lines.map((ln, i) => renderLine(ln, i))}
      {pngs.length > 0 && (
        <div className="mt-3 space-y-2">
          {pngs.map((name) => (
            <div key={name} className="rounded-lg border border-border overflow-hidden bg-background/50">
              <img src={fileUrl(name)} alt={name} className="w-full" />
              <div className="px-3 py-1.5 text-[11px] text-muted-foreground">{name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
