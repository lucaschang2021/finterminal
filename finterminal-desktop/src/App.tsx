import { useState } from 'react'

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

  return (
    <div className="relative flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* 全局底色暗流 */}
      <div className="flow-current pointer-events-none absolute inset-0" style={{ opacity: 0.7 }} />

      <SideNav active={view} onSelect={setView} />

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          {view === 'chat' && <ChatView />}
          {view === 'files' && <FilesPage />}
          {view === 'charts' && <ChartsPage onOpenDetail={(t) => { setChartType(t); setBottomOpen(true) }} />}
          {view === 'chain' && <ChainPage />}
          {view === 'knowledge' && <KnowledgePage />}
          {view === 'settings' && <SettingsPage />}
          {view === 'export' && <ExportPage />}
        </div>
        <BottomPanel open={bottomOpen} onOpenChange={setBottomOpen} chartType={chartType} />
      </main>

      <RightBoard />
    </div>
  )
}
