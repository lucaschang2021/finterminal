import { useEffect, useState } from 'react'

import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { stripEmoji } from '@/lib/utils'

export default function KnowledgePage() {
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [queryRes, setQueryRes] = useState('')
  const [docPath, setDocPath] = useState('')
  const [actionRes, setActionRes] = useState('')

  const refresh = () => {
    api.knowledge({ action: 'status' }).then((r) => setStatus(r.text ?? '')).catch(() => {})
  }
  useEffect(() => { refresh() }, [])

  const doQuery = () => {
    api.knowledgeQuery({ query_text: query, top_k: 5 }).then((r) => setQueryRes(r.text ?? '')).catch(() => {})
  }

  const doAction = (action: string) => {
    api.knowledge({ action, file_path: docPath || undefined }).then((r) => { setActionRes(r.text ?? ''); refresh() }).catch(() => {})
  }

  return (
    <div className="p-5">
      <h2 className="page-title">知识库</h2>
      <p className="page-sub mb-4">本地向量检索 + BM25 混合检索 · 引用溯源</p>

      <div className="liquid-glass d2-cut mb-4 p-4">
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>状态</div>
        <pre className="mono text-[11px]" style={{ color: 'var(--muted)' }}>{stripEmoji(status)}</pre>
      </div>

      <div className="liquid-glass d2-cut mb-4 p-4">
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>检索</div>
        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doQuery()}
            placeholder="查询内容，例如：茅台的估值" className="glass-input h-9 flex-1 border-0" />
          <Button size="sm" onClick={doQuery}>检索</Button>
        </div>
        {queryRes && <ScrollArea className="mt-3 h-44"><pre className="mono whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{stripEmoji(queryRes)}</pre></ScrollArea>}
      </div>

      <div className="liquid-glass d2-cut p-4">
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>文档管理</div>
        <div className="flex gap-2">
          <Input value={docPath} onChange={(e) => setDocPath(e.target.value)} placeholder="文件路径（txt/md/pdf/docx/csv/xlsx）"
            className="glass-input h-9 flex-1 border-0" />
          <Button size="sm" onClick={() => doAction('add')}>添加</Button>
          <Button size="sm" variant="secondary" onClick={() => doAction('clear')}>清空</Button>
        </div>
        {actionRes && <pre className="mono mt-3 whitespace-pre-wrap text-[11px]" style={{ color: 'var(--muted)' }}>{stripEmoji(actionRes)}</pre>}
      </div>
    </div>
  )
}
