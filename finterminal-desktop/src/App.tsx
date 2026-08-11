import { useState } from 'react'

import BottomPanel from './components/BottomPanel'
import ChatView from './components/ChatView'
import RightBoard from './components/RightBoard'
import SideNav, { type NavKey } from './components/SideNav'

export default function App() {
  const [activeTab, setActiveTab] = useState<NavKey>('chat')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SideNav active={activeTab} onSelect={setActiveTab} />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <ChatView />
        </div>
        <BottomPanel activeTab={activeTab} onTabChange={setActiveTab} />
      </main>
      <RightBoard />
    </div>
  )
}
