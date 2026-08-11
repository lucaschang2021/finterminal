import { useEffect, useRef, useState } from 'react'

import { streamAsk } from '@/api'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ChatMessage } from '@/types'
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
    const id = Date.now()
    setMessages((m) => [...m, { role: 'user', text: q, time: id }])
    setMessages((m) => [...m, { role: 'assistant', text: '', time: id + 1 }])
    setBusy(true)
    try {
      let acc = ''
      await streamAsk(q, (delta) => {
        acc += delta
        setMessages((m) => m.map((msg, i) => (i === m.length - 1 ? { ...msg, text: acc } : msg)))
      })
    } catch (e) {
      setMessages((m) => m.map((msg, i) => (i === m.length - 1 ? { ...msg, text: `❌ ${(e as Error).message}` } : msg)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b px-5 py-3" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <span className="text-sm font-semibold">FinTerminal 对话</span>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>流式输出 · 本地金融数据终端</span>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl px-5 py-5">
          {messages.length === 0 && (
            <div className="liquid-glass mb-8 rounded-2xl p-5" style={{ borderRadius: 18 }}>
              <div className="mb-3 text-sm font-medium">试试这样问：</div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:text-[var(--accent)]"
                    style={{ borderColor: 'rgba(255,255,255,0.1)', color: 'var(--muted)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={m.time} className={m.role === 'user' ? 'mb-5 flex justify-end' : 'mb-5'}>
              <div
                className={
                  m.role === 'user'
                    ? 'glass-bubble-user max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm'
                    : 'glass-bubble-ai max-w-[95%] rounded-2xl rounded-bl-sm px-4 py-3'
                }
                style={{ border: '0.5px solid rgba(255,255,255,0.05)' }}
              >
                {m.role === 'user' ? m.text : (
                  <>
                    {m.text ? <Markdown text={m.text} /> : <span style={{ color: 'var(--muted)' }}>思考中…</span>}
                    {m.text && (
                      <div className="source-tag mt-2 border-t pt-1.5" style={{ borderColor: 'rgba(201,168,76,0.18)' }}>
                        📌 FinTerminal · 数据来源已标注 · AI 结论请人工复核
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* 打字框：五彩流光在磨砂玻璃下涌动 */}
      <div className="border-t p-4" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="composer-wrap relative mx-auto max-w-3xl overflow-hidden rounded-2xl" style={{ borderRadius: 18 }}>
          <div className="composer-flow" />
          <div
            className="relative"
            style={{ background: 'rgba(22,27,34,0.55)', backdropFilter: 'blur(16px) saturate(1.3)', WebkitBackdropFilter: 'blur(16px) saturate(1.3)' }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="输入指令，Enter 发送，Ctrl+Enter 换行"
              rows={2}
              disabled={busy}
              className="w-full resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[var(--muted)]"
              style={{ color: 'var(--fg)' }}
            />
            <div className="flex items-center justify-end px-3 pb-2">
              <Button size="sm" onClick={() => send()} disabled={busy} className="glow-btn h-8">
                {busy ? '生成中…' : '发送'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
