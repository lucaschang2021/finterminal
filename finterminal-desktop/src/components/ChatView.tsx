import { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Clock3, LoaderCircle, MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react'

import { streamAsk, type GeneratedArtifacts } from '@/api'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useI18n } from '@/i18n/LanguageContext'
import type { ChatMessage } from '@/types'
import Markdown from './Markdown'

const SUGGESTION_KEYS = [
  'chat.suggest1',
  'chat.suggest2',
  'chat.suggest3',
  'chat.suggest4',
  'chat.suggest5',
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

function makeThread(title: string): ChatThread {
  const now = Date.now()
  return { id: newId(), title, createdAt: now, updatedAt: now, messages: [] }
}

function relativeTime(ts: number, t: (key: string, vars?: Record<string, string | number>) => string, lang: string): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return t('chat.justNow')
  if (diff < 3_600_000) return t('chat.minutesAgo', { n: Math.floor(diff / 60_000) })
  if (diff < 86_400_000) return t('chat.hoursAgo', { n: Math.floor(diff / 3_600_000) })
  return new Date(ts).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN', { month: '2-digit', day: '2-digit' })
}

export default function ChatView({ onArtifactsGenerated, onFileReferenced }: { onArtifactsGenerated?: (artifacts: GeneratedArtifacts) => void; onFileReferenced?: (path: string) => void }) {
  const { t, lang } = useI18n()
  const [threads, setThreads] = useState<ChatThread[]>(loadThreads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ threadId: string; messageTime: number; stage: string; tool?: string; elapsed: number } | null>(null)
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
      const th = makeThread(t('chat.new'))
      setThreads([th])
      setActiveId(th.id)
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

  // 解析 AI 回复中生成的图表文件（charts/ 下的 png / html）
  const extractChartFiles = (text: string): string[] => {
    const re = /\bcharts[\\/]([A-Za-z0-9_\-]+\.(?:png|html))/gi
    const out: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const name = m[1]
      if (!out.includes(name)) out.push(name)
    }
    const pngFiles = out.filter((name) => name.toLowerCase().endsWith('.png'))
    return pngFiles.length > 0 ? pngFiles : out
  }
  const lastArtifactsKeyRef = useRef('')
  const hydratedThreadsRef = useRef(new Set<string>())

  // 恢复旧对话时，SSE 成果帧不会重放；从已保存的最终回复重建面板成果。
  useEffect(() => {
    if (!activeThread || busy || hydratedThreadsRef.current.has(activeThread.id)) return
    hydratedThreadsRef.current.add(activeThread.id)
    const latest = [...activeThread.messages].reverse().find((message) => message.role === 'assistant' && message.text.trim())
    if (!latest || !onArtifactsGenerated) return
    const charts = extractChartFiles(latest.text)
    if (!charts.length) return
    onArtifactsGenerated({
      charts,
      statistics: [{ analysis: 'describe', file_path: '', result: latest.text }],
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, busy])

  const patchThread = (id: string, fn: (t: ChatThread) => ChatThread) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? fn(t) : t)))
  }

  const createThread = () => {
    const th = makeThread(t('chat.new'))
    setThreads((prev) => [th, ...prev])
    setActiveId(th.id)
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
    const next = threads.filter((tr) => tr.id !== id)
    if (next.length === 0) {
      const th = makeThread(t('chat.new'))
      setThreads([th])
      setActiveId(th.id)
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
      const title = renameText.trim() || t('chat.new')
      patchThread(renameId, (t) => ({ ...t, title, updatedAt: Date.now() }))
    }
    setRenameId(null)
  }

  const send = async (raw?: string) => {
    const q = (raw ?? input).trim()
    if (!q || busy || !activeThread) return
    // 用户在对话中引用本地数据文件时，同步到下边框工作台。
    const referencedFile = q.match(/(?:[A-Za-z]:[\\/][^\r\n"']+|[^\s"']+\.(?:csv|tsv|xlsx|xls|json|parquet|pdf|docx?|md|txt))/i)?.[0]
    if (referencedFile) onFileReferenced?.(referencedFile.trim())
    setInput('')
    // 最近上下文足以维持多轮语义，也能显著减少每次请求的提示词体积。
    const history = activeThread.messages
      .filter((m) => m.text)
      .slice(-10)
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
    const id = Date.now()
    const threadId = activeThread.id
    const title = activeThread.title === t('chat.new') ? q.slice(0, 18) : activeThread.title
    const userMsg: ChatMessage = { role: 'user', text: q, time: id }
    const asstMsg: ChatMessage = { role: 'assistant', text: '', time: id + 1 }
    patchThread(threadId, (t) => ({
      ...t,
      title,
      updatedAt: Date.now(),
      messages: [...t.messages, userMsg, asstMsg],
    }))
    setBusy(true)
    setProgress({ threadId, messageTime: id + 1, stage: 'accepted', elapsed: 0 })
    try {
      let acc = ''
      let hasArtifacts = false
      await streamAsk(q, (delta) => {
        acc += delta
        setThreads((prev) => prev.map((t) => {
          if (t.id !== threadId) return t
          const msgs = t.messages.map((m) => (m.time === id + 1 ? { ...m, text: acc } : m))
          return { ...t, messages: msgs }
        }))
        // 兼容旧后端：从文本路径中识别图表；新版后端会另发结构化成果帧。
        if (onArtifactsGenerated) {
          const charts = extractChartFiles(acc)
          const key = `${charts.join('|')}::`
          if (charts.length > 0 && key !== lastArtifactsKeyRef.current) {
            lastArtifactsKeyRef.current = key
            onArtifactsGenerated({ charts, statistics: [] })
          }
        }
      }, 45000, history, (status) => {
        setProgress({ threadId, messageTime: id + 1, ...status })
      }, (artifacts) => {
        hasArtifacts = artifacts.charts.length > 0 || artifacts.statistics.length > 0
        const key = artifacts.charts.join('|') + '::' + artifacts.statistics.map((item) => [item.analysis, item.file_path, item.result.length].join(':')).join('|')
        if (onArtifactsGenerated && key !== lastArtifactsKeyRef.current) {
          lastArtifactsKeyRef.current = key
          onArtifactsGenerated(artifacts)
        }
      })

      // 逐帧更新之外再做一次最终提交，避免父面板展开/React 批处理导致空回复残留。
      const finalText = acc.trim() || (
        hasArtifacts
          ? t('chat.resultsReady')
          : t('chat.noResponse')
      )
      patchThread(threadId, (thread) => ({
        ...thread,
        updatedAt: Date.now(),
        messages: thread.messages.map((message) => (
          message.time === id + 1 ? { ...message, text: finalText } : message
        )),
      }))
    } catch (e) {
      const err = (e as Error).message
      setThreads((prev) => prev.map((t) => {
        if (t.id !== threadId) return t
        const msgs = t.messages.map((m) => (m.time === id + 1 ? { ...m, text: err } : m))
        return { ...t, messages: msgs }
      }))
    } finally {
      setBusy(false)
      setProgress(null)
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
            {t('chat.new')}
          </button>
        </div>
        <div className="rb-scroll min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {[...threads].sort((a, b) => b.updatedAt - a.updatedAt).map((th) => {
            const isActive = th.id === activeThread?.id
            const isRenaming = renameId === th.id
            const isConfirming = confirmDeleteId === th.id
            return (
              <div
                key={th.id}
                className={`d2-thread group ${isActive ? 'active' : ''}`}
                onClick={() => switchThread(th.id)}
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
                      {th.title}
                    </span>
                  )}
                  {!isRenaming && (
                    <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] hover:text-[var(--accent)]"
                        onClick={(e) => { e.stopPropagation(); startRename(th) }}
                        title={t('chat.rename')}
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </button>
                      <button
                        className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] hover:text-[var(--down)]"
                        onClick={(e) => { e.stopPropagation(); deleteThread(th.id) }}
                        title={isConfirming ? t('chat.confirmDelete') : t('chat.delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                      </button>
                    </span>
                  )}
                </div>
                {!isRenaming && (
                  <div className="mt-1 flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--muted)' }}>
                    <MessageSquare className="h-3 w-3" strokeWidth={1.5} />
                    <span>{th.messages.length > 0 ? t('chat.rounds', { n: Math.ceil(th.messages.length / 2) }) : t('chat.empty')}</span>
                    <span className="ml-auto">{relativeTime(th.updatedAt, t, lang)}</span>
                  </div>
                )}
                {isConfirming && (
                  <div className="mt-1 text-[10px]" style={{ color: 'var(--down)' }}>{t('chat.confirmDelete')}</div>
                )}
              </div>
            )
          })}
        </div>
      </aside>

      {/* 对话主体 */}
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-5 py-3" style={{ borderColor: 'var(--hairline)' }}>
          <span className="text-sm font-semibold">{t('chat.title')}</span>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('chat.headerSub')}</span>
          {activeThread && (
            <span className="ml-auto max-w-[260px] truncate text-xs" style={{ color: 'var(--muted)' }}>
              {activeThread.title}
            </span>
          )}
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <div className="relative h-full">
            <div className="mx-auto max-w-5xl px-6 py-5">
              {messages.length === 0 && (
                <div className="liquid-glass suggestions-card mb-8 p-5">
                  <div className="mb-3 text-sm font-medium">{t('chat.tryAsking')}</div>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTION_KEYS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(t(s))}
                        className="d2-chip px-3 py-1.5 text-xs"
                        style={{ color: 'var(--muted)' }}
                      >
                        {t(s)}
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
                        {m.text ? <Markdown text={m.text} /> : progress?.messageTime === m.time ? (
                          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }} role="status" aria-live="polite">
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            <span>
                              {progress.stage === 'tool'
                                ? t('chat.usingTool', { tool: progress.tool || t('chat.localTool') })
                                : progress.stage === 'finalizing'
                                  ? t('chat.finalizing')
                                  : progress.stage === 'routing'
                                    ? t('chat.routing')
                                    : t('chat.thinking')}
                            </span>
                            <span className="inline-flex items-center gap-1 tabular-nums opacity-70">
                              <Clock3 className="h-3 w-3" aria-hidden="true" />
                              {progress.elapsed.toFixed(1)}s
                            </span>
                          </div>
                        ) : <span style={{ color: 'var(--muted)' }}>{t('chat.noResponse')}</span>}
                        {m.text && (
                          <div className="source-tag mt-2 border-t pt-1.5" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                            {t('chat.sourceTag')}
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
          <div className="composer-wrap relative mx-auto max-w-5xl overflow-hidden rounded-2xl" style={{ borderRadius: 18 }}>
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
                placeholder={t('chat.placeholder')}
                rows={1}
                maxLength={4000}
                disabled={busy}
                className="max-h-24 w-full resize-none bg-transparent px-4 py-2 text-sm outline-none placeholder:text-[var(--muted)]"
                style={{ color: 'var(--fg)' }}
              />
              <div className="flex items-center justify-end px-2 pb-1.5">
                <Button size="sm" onClick={() => send()} disabled={busy} className="d2-cta h-8 px-4 text-xs">
                  {busy ? t('chat.sending') : t('chat.send')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
