import { Send, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { api } from '@/api'
import type { ChatMessage } from '@/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import Markdown from './Markdown'

const SUGGESTIONS = [
  '查一下贵州茅台行情',
  '茅台的历史财报',
  '画一张折线图',
  '写一份贵州茅台的研究报告',
  '检查一下数据链',
]

export default function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (raw?: string) => {
    const q = (raw ?? input).trim()
    if (!q || busy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: q, time: Date.now() }])
    setBusy(true)
    try {
      const r = await api.ask(q)
      setMessages((m) => [...m, { role: 'assistant', text: r.text ?? '', time: Date.now() }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: `❌ ${(e as Error).message}`, time: Date.now() }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">FinTerminal 对话</h2>
        <span className="text-xs text-muted-foreground">读文件 · 画图 · 分析 · 行情 · 研报</span>
      </header>

      <ScrollArea className="flex-1 min-h-0">
        <div className="mx-auto max-w-3xl px-5 py-5">
          {messages.length === 0 && (
            <div className="mb-8 rounded-xl border border-border bg-card/60 p-5">
              <div className="mb-3 text-base font-medium">试试这样问：</div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'mb-5 flex justify-end' : 'mb-5'}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground'
                    : 'max-w-[95%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3'
                }
              >
                {m.role === 'user' ? m.text : <Markdown text={m.text} />}
              </div>
            </div>
          ))}
          {busy && (
            <div className="mb-5 max-w-[95%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              思考中…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="输入指令，Enter 发送，Shift+Enter 换行"
            className="min-h-[44px] max-h-32 resize-none"
            disabled={busy}
          />
          <Button onClick={() => send()} disabled={busy} className="h-[44px] px-5">
            <Send className="h-4 w-4" />
            {busy ? '思考中' : '发送'}
          </Button>
        </div>
      </div>
    </div>
  )
}
