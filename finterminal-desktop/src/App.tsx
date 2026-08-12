import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

import BottomPanel from './components/BottomPanel'
import ChatView from './components/ChatView'
import RightBoard from './components/RightBoard'
import SideNav, { type ViewKey } from './components/SideNav'
import ChainPage from './components/pages/ChainPage'
import ChartsPage from './components/pages/ChartsPage'
import ExportPage from './components/pages/ExportPage'
import FilesPage from './components/pages/FilesPage'
import KnowledgePage from './components/pages/KnowledgePage'
import SettingsPage from './components/pages/SettingsPage'

export default function App() {
  const [view, setView] = useState<ViewKey>('chat')
  const [bottomOpen, setBottomOpen] = useState(false)
  const [chartType, setChartType] = useState<string>()
  const rootRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  // 页面切换：淡入 + 轻微上浮 + 极细缩放（命运2 界面切换节奏）
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(pageRef.current, { clearProps: 'all' })
    })
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        pageRef.current,
        { opacity: 0, y: 16, scale: 0.997 },
        { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'expo.out', overwrite: 'auto', clearProps: 'transform' },
      )
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [view] })

  // 全局按钮按压微交互：按下 0.96，抬起弹性回弹
  useGSAP(() => {
    const el = rootRef.current
    if (!el) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: reduce)', () => {})
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const onDown = (e: PointerEvent) => {
        const target = (e.target as HTMLElement).closest('button')
        if (!target || (target as HTMLButtonElement).disabled) return
        gsap.to(target, { scale: 0.96, duration: 0.12, ease: 'power2.out', overwrite: 'auto' })
      }
      const onUp = (e: PointerEvent) => {
        const target = (e.target as HTMLElement).closest('button')
        if (!target) return
        gsap.to(target, { scale: 1, duration: 0.42, ease: 'back.out(2.5)', overwrite: 'auto', clearProps: 'transform' })
      }
      el.addEventListener('pointerdown', onDown)
      el.addEventListener('pointerup', onUp)
      el.addEventListener('pointercancel', onUp)
      return () => {
        el.removeEventListener('pointerdown', onDown)
        el.removeEventListener('pointerup', onUp)
        el.removeEventListener('pointercancel', onUp)
      }
    })
    return () => mm.revert()
  }, { scope: rootRef })

  return (
    <div ref={rootRef} className="relative flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <SideNav active={view} onSelect={setView} />

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">
          <div ref={pageRef} className="h-full overflow-y-auto overflow-x-hidden">
            {view === 'chat' && <ChatView />}
            {view === 'files' && <FilesPage />}
            {view === 'charts' && <ChartsPage onOpenDetail={(t) => { setChartType(t); setBottomOpen(true) }} />}
            {view === 'chain' && <ChainPage />}
            {view === 'knowledge' && <KnowledgePage />}
            {view === 'settings' && <SettingsPage />}
            {view === 'export' && <ExportPage />}
          </div>
        </div>
        <BottomPanel open={bottomOpen} onOpenChange={setBottomOpen} chartType={chartType} />
      </main>

      <RightBoard />
    </div>
  )
}
