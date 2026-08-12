import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Activity, LibraryBig, Waypoints } from 'lucide-react'

import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { stripEmoji } from '@/lib/utils'

const DATA_TOKEN = /([-+]?\d+(?:\.\d+)?(?:%|℃)?|正常|成功|已连接|在线|通过|就绪|完成|同步中|失败|错误|异常|离线|中断|拒绝|无法|不存在|缺失)/g
const GOOD_RE = /正常|成功|已连接|在线|通过|就绪|完成/
const BAD_RE = /失败|错误|异常|离线|中断|拒绝|无法|不存在|缺失/

/** 人性化数据文本：数字高亮、状态词着色、正文提亮 */
function DataText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div
      className="mono whitespace-pre-wrap text-[13px] leading-relaxed"
      style={{ color: 'color-mix(in srgb, var(--fg) 82%, transparent)' }}
    >
      {lines.map((line, i) => {
        const toks = line.split(DATA_TOKEN)
        return (
          <div key={i} className="min-h-[1.35em]">
            {toks.map((tok, j) => {
              if (!tok) return null
              if (GOOD_RE.test(tok)) {
                return <span key={j} className="font-semibold" style={{ color: 'var(--ok)' }}>{tok}</span>
              }
              if (BAD_RE.test(tok)) {
                return <span key={j} className="font-semibold" style={{ color: 'var(--bad)' }}>{tok}</span>
              }
              if (/^[-+]?\d/.test(tok)) {
                return <span key={j} className="font-semibold" style={{ color: 'var(--fg)' }}>{tok}</span>
              }
              return <span key={j}>{tok}</span>
            })}
          </div>
        )
      })}
    </div>
  )
}

function Panel({ title, icon, loading, children }: {
  title: string
  icon: ReactNode
  loading?: boolean
  children: ReactNode
}) {
  return (
    <div className="liquid-glass rb-panel p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{ background: 'rgba(255,255,255,0.055)', color: 'var(--muted)' }}
        >
          {icon}
        </span>
        <span className="text-[13px] font-semibold tracking-[0.04em]" style={{ color: 'var(--fg)' }}>{title}</span>
        {loading && <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'rgba(255,255,255,0.4)' }} />}
      </div>
      <div className="border-t pt-2.5" style={{ borderColor: 'var(--hairline)' }}>
        {children}
      </div>
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
  const boardRef = useRef<HTMLDivElement>(null)

  // 面板入场：依次从下方浮起
  useGSAP(() => {
    if (!ready) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set('.rb-panel', { clearProps: 'all' })
    })
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        '.rb-panel',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.09, clearProps: 'transform', overwrite: 'auto' },
      )
    })
    return () => mm.revert()
  }, { scope: boardRef, dependencies: [ready] })

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
      ref={boardRef}
      className="relative z-10 h-full w-[280px] shrink-0 overflow-hidden border-l p-3 transition-all duration-600"
      style={{
        borderColor: 'var(--hairline)',
        background: ready ? 'var(--glass-bg)' : 'transparent',
        opacity: ready ? 1 : 0.4,
      }}
    >
      <div className="rb-scroll h-full min-w-0 overflow-y-auto overflow-x-hidden pr-1">
        <div className="w-full min-w-0 space-y-2.5">
          <Panel title="实时行情" icon={<Activity className="h-4 w-4" strokeWidth={1.5} />} loading={loading}>
            <div className="flex w-full min-w-0 gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadQuote()}
                size={4}
                placeholder="股票代码" className="glass-input h-9 min-w-0 flex-1 border-0 text-[13px]"
                style={{ minWidth: 0 }} />
              <Button size="sm" variant="secondary" onClick={loadQuote} className="d2-cta h-9 shrink-0 whitespace-nowrap px-3 text-[13px]">查询</Button>
            </div>
            {quote && <div className="rb-scroll mt-1 max-h-44 overflow-y-auto pr-1"><DataText text={stripEmoji(quote)} /></div>}
          </Panel>

          <Panel title="数据链状态" icon={<Waypoints className="h-4 w-4" strokeWidth={1.5} />}>
            {chain && <div className="rb-scroll max-h-48 overflow-y-auto pr-1"><DataText text={stripEmoji(chain)} /></div>}
          </Panel>

          <Panel title="知识库状态" icon={<LibraryBig className="h-4 w-4" strokeWidth={1.5} />}>
            {kb && <div className="rb-scroll max-h-48 overflow-y-auto pr-1"><DataText text={stripEmoji(kb)} /></div>}
          </Panel>
        </div>
      </div>
    </aside>
  )
}
