import { BookOpen, LineChart, Network, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

import { api } from '@/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

function PanelCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default function RightBoard() {
  const [code, setCode] = useState('sh600519')
  const [quote, setQuote] = useState('')
  const [chain, setChain] = useState('')
  const [kb, setKb] = useState('')
  const [err, setErr] = useState('')

  const loadQuote = () => {
    setErr('')
    api.readApi(code).then((r) => setQuote(r.text ?? '')).catch((e) => setErr((e as Error).message))
  }
  const loadChain = () => {
    api.chain({ action: 'status' }).then((r) => setChain(r.text ?? '')).catch(() => {})
  }
  const loadKb = () => {
    api.knowledge({ action: 'status' }).then((r) => setKb(r.text ?? '')).catch(() => {})
  }

  useEffect(() => {
    loadQuote()
    loadChain()
    loadKb()
    const t = setInterval(loadChain, 30000)
    return () => clearInterval(t)
  }, [])

  return (
    <aside className="w-80 shrink-0 border-l border-border bg-card/40 p-3">
      <ScrollArea className="h-full">
        <div className="space-y-3">
          <PanelCard title="实时行情" icon={<LineChart className="h-4 w-4 text-primary" />}>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="股票代码" className="h-8 text-xs" />
              <Button size="sm" variant="secondary" onClick={loadQuote} className="h-8">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
            {quote && <pre className="mt-2 whitespace-pre-wrap rounded bg-background p-2 text-[11px] leading-relaxed text-foreground/85">{quote}</pre>}
          </PanelCard>

          <PanelCard title="数据链状态" icon={<Network className="h-4 w-4 text-primary" />}>
            <div className="flex items-center justify-between">
              <Badge variant="success">{chain.includes('✅') ? '完整' : '查看'}</Badge>
              <Button size="sm" variant="ghost" onClick={loadChain} className="h-6 px-2">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            {chain && <pre className="mt-2 whitespace-pre-wrap rounded bg-background p-2 text-[11px] leading-relaxed text-foreground/85">{chain}</pre>}
          </PanelCard>

          <PanelCard title="知识库状态" icon={<BookOpen className="h-4 w-4 text-primary" />}>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">RAG</Badge>
              <Button size="sm" variant="ghost" onClick={loadKb} className="h-6 px-2">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            {kb && <pre className="mt-2 whitespace-pre-wrap rounded bg-background p-2 text-[11px] leading-relaxed text-foreground/85">{kb}</pre>}
          </PanelCard>
        </div>
      </ScrollArea>
    </aside>
  )
}
