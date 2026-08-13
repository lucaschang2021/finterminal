import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Files from './pages/Files'
import ChartPage from './pages/ChartPage'
import Analysis from './pages/Analysis'
import Chain from './pages/Chain'
import Knowledge from './pages/Knowledge'
import Ask from './pages/Ask'

const NAV = [
  { key: 'dashboard', label: '概览', icon: '▦' },
  { key: 'files', label: '文件', icon: '📁' },
  { key: 'chart', label: '图表', icon: '📈' },
  { key: 'analysis', label: '分析', icon: '🧮' },
  { key: 'chain', label: '数据链', icon: '🔗' },
  { key: 'knowledge', label: '知识库', icon: '📚' },
  { key: 'ask', label: '对话', icon: '💬' },
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [selectedFile, setSelectedFile] = useState(null)

  const goChart = (filePath) => {
    setSelectedFile(filePath)
    setPage('chart')
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Fin<span>Terminal</span></div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.key}
              className={page === item.key ? 'nav-item active' : 'nav-item'}
              onClick={() => setPage(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">React + ECharts</div>
      </aside>
      <main className="content">
        {page === 'dashboard' && <Dashboard onOpenChart={goChart} />}
        {page === 'files' && <Files onChart={goChart} />}
        {page === 'chart' && <ChartPage initialPath={selectedFile} />}
        {page === 'analysis' && <Analysis />}
        {page === 'chain' && <Chain />}
        {page === 'knowledge' && <Knowledge />}
        {page === 'ask' && <Ask />}
      </main>
    </div>
  )
}
