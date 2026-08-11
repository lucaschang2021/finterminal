import { useEffect, useState } from 'react'

import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

function Panel({ title, icon, loading, children }: {
  title: string
  icon: string
  loading?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="liquid-glass rounded-xl p-3" style={{ borderRadius: 14 }}>
      <div className="mb-2 flex items-center gap-2 text-xs font-medium">
        <span>{icon}</span>
        <span>{title}</span>
        {loading && <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />}
      </div>
      {children}
    </div>
  )
}

export default function RightBoard() {
  const [code, setCode] = useState('sh600519')
  const [quote, setQuote] = useState('')
  const [chain, setChain] = useState('')
  const [kb, setKb] = useState('')
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadQuote = () => {
    setLoading(true)
    api.readApi(code).then((r) => setQuote(r.text ?? '')).catch(() => setQuote('行情获取失败（可能离线）')).finally(() => setLoading(false))
  }
  const loadChain = () => api.chain({ action: 'status' }).then((r) => setChain(r.text ?? '')).catch(() => setChain('数据链读取失败'))
  const loadKb = () => api.knowledge({ action: 'status' }).then((r) => setKb(r.text ?? '')).catch(() => setKb('知识库读取失败'))

  useEffect(() => {
    loadQuote()
    loadChain()
    loadKb()
    const t = setInterval(loadChain, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (quote || chain || kb) {
      const t = setTimeout(() => setReady(true), 120)
      return () => clearTimeout(t)
    }
  }, [quote, chain, kb])

  return (
    <aside
      className="relative h-full w-[280px] shrink-0 overflow-hidden border-l p-3 transition-all duration-600"
      style={{
        borderColor: 'rgba(255,255,255,0.05)',
        background: ready ? 'rgba(22,27,34,0.50)' : 'transparent',
        backdropFilter: ready ? 'blur(20px) saturate(1.4)' : 'none',
        WebkitBackdropFilter: ready ? 'blur(20px) saturate(1.4)' : 'none',
        opacity: ready ? 1 : 0.4,
      }}
    >
      <div className="flow-current gold" style={{ '--flow-strength': '6%' } as React.CSSProperties} />
      <ScrollArea className="relative h-full">
        <div className="space-y-3">
          <Panel title="实时行情" icon="📈" loading={loading}>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadQuote()}
                placeholder="股票代码" className="glass-input h-7 border-0 text-[11px]" />
              <Button size="sm" variant="secondary" onClick={loadQuote} className="h-7 px-2 text-[11px]">查询</Button>
            </div>
            {quote && <pre className="mono mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed" style={{ color: 'var(--muted)' }}>{quote}</pre>}
          </Panel>

          <Panel title="数据链状态" icon="⛓️">
            {chain && <pre className="mono mt-1 max-h-44 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed" style={{ color: 'var(--muted)' }}>{chain}</pre>}
          </Panel>

          <Panel title="知识库状态" icon="🧠">
            {kb && <pre className="mono mt-1 max-h-44 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed" style={{ color: 'var(--muted)' }}>{kb}</pre>}
          </Panel>
        </div>
      </ScrollArea>
    </aside>
  )
}
