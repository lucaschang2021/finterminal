import { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react'

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

interface ChatThread {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

const THREADS_KEY = 'finterminal_threads'

function loadThreads(): ChatThread[] {
  try {
    const raw = JSON.parse(localStorage.getItem(THREADS_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function newId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function makeThread(): ChatThread {
  const now = Date.now()
  return { id: newId(), title: '新对话', createdAt: now, updatedAt: now, messages: [] }
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return new Date(ts).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export default function ChatView() {
  const [threads, setThreads] = useState<ChatThread[]>(loadThreads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const prevMsgLen = useRef(0)
  const prevActive = useRef<string | null>(null)
  const booted = useRef(false)

  const activeThread = threads.find((t) => t.id === activeId) ?? threads[0] ?? null
  const messages = activeThread?.messages ?? []

  // 首次进入：确保至少有一个对话，并选中最近更新的
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    if (threads.length === 0) {
      const t = makeThread()
      setThreads([t])
      setActiveId(t.id)
    } else {
      setActiveId([...threads].sort((a, b) => b.updatedAt - a.updatedAt)[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 切换对话 / 新消息：滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeId, messages.length])

  // 持久化对话
  useEffect(() => {
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads))
  }, [threads])

  // 删除确认自动复位
  useEffect(() => {
    if (!confirmDeleteId) return
    const t = window.setTimeout(() => setConfirmDeleteId(null), 2600)
    return () => window.clearTimeout(t)
  }, [confirmDeleteId])

  // 消息入场：新消息依次淡入上浮（切对话不重放历史，流式不重复动画）
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: reduce)', () => {})
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const items = gsap.utils.toArray<HTMLElement>(chatRef.current?.querySelectorAll('.chat-msg-enter') ?? [])
      if (prevActive.current !== activeId) {
        prevActive.current = activeId
        prevMsgLen.current = items.length
        return
      }
      const fresh = items.slice(prevMsgLen.current)
      prevMsgLen.current = items.length
      fresh.forEach((el, i) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 16, scale: 0.985 },
          { opacity: 1, y: 0, scale: 1, duration: 0.5, delay: i * 0.07, ease: 'power3.out', clearProps: 'transform' },
        )
      })
    })
    return () => mm.revert()
  }, { scope: chatRef, dependencies: [activeId, messages.length] })

  // 建议卡片入场
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: reduce)', () => {})
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.suggestions-card', { opacity: 0, y: 18, duration: 0.55, ease: 'expo.out' })
    })
    return () => mm.revert()
  }, { scope: chatRef, dependencies: [activeId, messages.length] })

  const patchThread = (id: string, fn: (t: ChatThread) => ChatThread) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? fn(t) : t)))
  }

  const createThread = () => {
    const t = makeThread()
    setThreads((prev) => [t, ...prev])
    setActiveId(t.id)
    setRenameId(null)
    setConfirmDeleteId(null)
  }

  const switchThread = (id: string) => {
    if (id === activeId) return
    setActiveId(id)
    setRenameId(null)
    setConfirmDeleteId(null)
  }

  const deleteThread = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }
    const next = threads.filter((t) => t.id !== id)
    if (next.length === 0) {
      const t = makeThread()
      setThreads([t])
      setActiveId(t.id)
    } else {
      setThreads(next)
      if (id === activeId) {
        setActiveId([...next].sort((a, b) => b.updatedAt - a.updatedAt)[0].id)
      }
    }
    setConfirmDeleteId(null)
  }

  const startRename = (t: ChatThread) => {
    setRenameId(t.id)
    setRenameText(t.title)
  }

  const commitRename = () => {
    if (renameId) {
      const title = renameText.trim() || '新对话'
      patchThread(renameId, (t) => ({ ...t, title, updatedAt: Date.now() }))
    }
    setRenameId(null)
  }

  const send = async (raw?: string) => {
    const q = (raw ?? input).trim()
    if (!q || busy || !activeThread) return
    setInput('')
    const id = Date.now()
    const threadId = activeThread.id
    const title = activeThread.title === '新对话' ? q.slice(0, 18) : activeThread.title
    const userMsg: ChatMessage = { role: 'user', text: q, time: id }
    const asstMsg: ChatMessage = { role: 'assistant', text: '', time: id + 1 }
    patchThread(threadId, (t) => ({
      ...t,
      title,
      updatedAt: Date.now(),
      messages: [...t.messages, userMsg, asstMsg],
    }))
    setBusy(true)
    try {
      let acc = ''
      await streamAsk(q, (delta) => {
        acc += delta
        setThreads((prev) => prev.map((t) => {
          if (t.id !== threadId) return t
          const msgs = t.messages.map((m, i) => (i === t.messages.length - 1 ? { ...m, text: acc } : m))
          return { ...t, messages: msgs }
        }))
      })
    } catch (e) {
      const err = (e as Error).message
      setThreads((prev) => prev.map((t) => {
        if (t.id !== threadId) return t
        const msgs = t.messages.map((m, i) => (i === t.messages.length - 1 ? { ...m, text: err } : m))
        return { ...t, messages: msgs }
      }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={chatRef} className="flex h-full min-h-0">
      {/* 对话列表（Codex 式多对话） */}
      <aside
        className="flex w-[236px] shrink-0 flex-col border-r"
        style={{ borderColor: 'var(--hairline)', background: 'var(--rail-bg)' }}
      >
        <div className="border-b p-3" style={{ borderColor: 'var(--hairline)' }}>
          <button
            className="d2-cta flex h-9 w-full items-center justify-center gap-2 text-xs font-semibold tracking-[0.14em]"
            onClick={createThread}
          >
            <Plus className="h-4 w-4" strokeWidth={1.8} />
            新对话
          </button>
        </div>
        <div className="rb-scroll min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {[...threads].sort((a, b) => b.updatedAt - a.updatedAt).map((t) => {
            const isActive = t.id === activeThread?.id
            const isRenaming = renameId === t.id
            const isConfirming = confirmDeleteId === t.id
            return (
              <div
                key={t.id}
                className={`d2-thread group ${isActive ? 'active' : ''}`}
                onClick={() => switchThread(t.id)}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setRenameId(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                      style={{ color: 'var(--fg)', borderBottom: '1px solid rgba(255,255,255,0.4)' }}
                    />
                  ) : (
                    <span
                      className="truncate text-xs font-medium"
                      style={{ color: isActive ? 'var(--fg)' : 'var(--muted)' }}
                    >
                      {t.title}
                    </span>
                  )}
                  {!isRenaming && (
                    <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] hover:text-[var(--accent)]"
                        onClick={(e) => { e.stopPropagation(); startRename(t) }}
                        title="重命名"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </button>
                      <button
                        className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] hover:text-[var(--down)]"
                        onClick={(e) => { e.stopPropagation(); deleteThread(t.id) }}
                        title={isConfirming ? '再次点击确认删除' : '删除对话'}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </button>
                    </span>
                  )}
                </div>
                {!isRenaming && (
                  <div className="mt-1 flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--muted)' }}>
                    <MessageSquare className="h-3 w-3" strokeWidth={1.5} />
                    <span>{t.messages.length > 0 ? `${Math.ceil(t.messages.length / 2)} 轮` : '空对话'}</span>
                    <span className="ml-auto">{relativeTime(t.updatedAt)}</span>
                  </div>
                )}
                {isConfirming && (
                  <div className="mt-1 text-[10px]" style={{ color: 'var(--down)' }}>再次点击垃圾桶确认删除</div>
                )}
              </div>
            )
          })}
        </div>
      </aside>

      {/* 对话主体 */}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-5 py-3" style={{ borderColor: 'var(--hairline)' }}>
          <span className="text-sm font-semibold">FinTerminal 对话</span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>流式输出 · 本地金融数据终端</span>
          {activeThread && (
            <span className="ml-auto max-w-[260px] truncate text-xs" style={{ color: 'var(--muted)' }}>
              {activeThread.title}
            </span>
          )}
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="relative h-full">
            <div className="mx-auto max-w-3xl px-5 py-5">
              {messages.length === 0 && (
                <div className="liquid-glass suggestions-card mb-8 p-5">
                  <div className="mb-3 text-sm font-medium">试试这样问：</div>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="d2-chip px-3 py-1.5 text-xs"
                        style={{ color: 'var(--muted)' }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.time} className={`chat-msg-enter ${m.role === 'user' ? 'mb-5 flex justify-end' : 'mb-5'}`}>
                  <div
                    className={
                      m.role === 'user'
                    ? 'glass-bubble-user max-w-[85%] px-4 py-2.5 text-sm'
                    : 'glass-bubble-ai max-w-[95%] px-4 py-3'
                }
              >
                    {m.role === 'user' ? m.text : (
                      <>
                        {m.text ? <Markdown text={m.text} /> : <span style={{ color: 'var(--muted)' }}>思考中…</span>}
                        {m.text && (
                          <div className="source-tag mt-2 border-t pt-1.5" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                            FinTerminal · 数据来源已标注 · AI 结论请人工复核
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>
        </ScrollArea>

        {/* 打字框：液态玻璃 */}
        <div className="border-t px-4 py-2.5" style={{ borderColor: 'var(--hairline)' }}>
          <div className="composer-wrap relative mx-auto max-w-3xl overflow-hidden rounded-2xl" style={{ borderRadius: 18 }}>
            <div
              className="composer-glass relative overflow-hidden"
              style={{
                borderRadius: 18,
              }}
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
                rows={1}
                maxLength={4000}
                disabled={busy}
                className="max-h-24 w-full resize-none bg-transparent px-4 py-2 text-sm outline-none placeholder:text-[var(--muted)]"
                style={{ color: 'var(--fg)' }}
              />
              <div className="flex items-center justify-end px-2 pb-1.5">
                <Button size="sm" onClick={() => send()} disabled={busy} className="d2-cta h-8 px-4 text-xs">
                  {busy ? '生成中…' : '发送'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
