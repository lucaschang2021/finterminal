import { useEffect, useState } from 'react'

import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function ChainPage() {
  const [status, setStatus] = useState('')
  const [history, setHistory] = useState('')
  const [detail, setDetail] = useState('')
  const [path, setPath] = useState('')
  const [recordId, setRecordId] = useState('')
  const [verifyRes, setVerifyRes] = useState('')

  const refresh = () => {
    api.chain({ action: 'status' }).then((r) => setStatus(r.text ?? '')).catch(() => {})
    api.chain({ action: 'history' }).then((r) => setHistory(r.text ?? '')).catch(() => {})
  }
  useEffect(() => { refresh() }, [])

  const run = (action: string) => {
    const params: Record<string, string | undefined> = { action }
    if (path) params.path = path
    if (recordId) params.record_id = recordId
    api.chain(params).then((r) => {
      if (action === 'verify') setVerifyRes(r.text ?? '')
      else if (action === 'show') setDetail(r.text ?? '')
      else refresh()
    }).catch(() => {})
  }

  const exportReport = () => {
    setDetail(`数据链报告（本地导出）\n\n${status}\n\n${history}`)
  }

  return (
    <div className="p-5">
      <h2 className="mb-1 text-lg font-semibold">数据链</h2>
      <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>文件变更哈希链 · 快照校验 · 区块链基础</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="liquid-glass rounded-xl p-4" style={{ borderRadius: 14 }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>链状态</span>
            <Button size="sm" variant="ghost" onClick={refresh} className="h-6 px-2 text-xs">刷新</Button>
          </div>
          <pre className="mono max-h-44 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{status}</pre>
        </div>

        <div className="liquid-glass rounded-xl p-4" style={{ borderRadius: 14 }}>
          <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>操作</div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => run('snapshot')}>快照</Button>
            <Button size="sm" variant="secondary" onClick={() => run('verify')}>校验链</Button>
            <Button size="sm" variant="secondary" onClick={exportReport}>导出报告</Button>
          </div>
          <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="跟踪/快照路径（可选）"
            className="glass-input mt-3 h-8 border-0 text-xs" />
          <div className="mt-2 flex gap-2">
            <Input value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder="记录 ID（查看详情）"
              className="glass-input h-8 flex-1 border-0 text-xs" />
            <Button size="sm" variant="secondary" onClick={() => run('show')}>详情</Button>
          </div>
          {verifyRes && <pre className="mono mt-3 max-h-32 overflow-auto whitespace-pre-wrap text-[11px]" style={{ color: 'var(--muted)' }}>{verifyRes}</pre>}
        </div>
      </div>

      <div className="liquid-glass mt-4 rounded-xl p-4" style={{ borderRadius: 14 }}>
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>变更历史</div>
        <ScrollArea className="h-56">
          <pre className="mono whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{history}</pre>
        </ScrollArea>
        {detail && <pre className="mono mt-3 border-t pt-3 text-[11px] leading-relaxed" style={{ color: 'var(--fg)', borderColor: 'rgba(255,255,255,0.06)' }}>{detail}</pre>}
      </div>
    </div>
  )
}
