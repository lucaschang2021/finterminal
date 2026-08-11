import {
  BarChart3,
  BookOpen,
  Bot,
  Database,
  FileText,
  FolderOpen,
  Menu,
  Network,
} from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

export type NavKey = 'chat' | 'chart' | 'files' | 'analysis' | 'chain' | 'knowledge' | 'report'

const ITEMS: { key: NavKey; label: string; icon: React.ReactNode }[] = [
  { key: 'chat', label: '对话', icon: <Bot className="h-4 w-4" /> },
  { key: 'chart', label: '图表', icon: <BarChart3 className="h-4 w-4" /> },
  { key: 'files', label: '文件', icon: <FolderOpen className="h-4 w-4" /> },
  { key: 'analysis', label: '统计分析', icon: <FileText className="h-4 w-4" /> },
  { key: 'chain', label: '数据链', icon: <Network className="h-4 w-4" /> },
  { key: 'knowledge', label: '知识库', icon: <BookOpen className="h-4 w-4" /> },
  { key: 'report', label: '研报', icon: <Database className="h-4 w-4" /> },
]

interface SideNavProps {
  active: NavKey
  onSelect: (key: NavKey) => void
}

export default function SideNav({ active, onSelect }: SideNavProps) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative z-40 shrink-0 border-r border-border bg-card/80 backdrop-blur"
      style={{ width: open ? 200 : 46 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex h-12 items-center justify-center border-b border-border">
        <Menu className="h-5 w-5 text-muted-foreground" />
      </div>
      <nav className="flex flex-col gap-1 p-2">
        {ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={cn(
              'flex h-9 items-center gap-3 rounded-md px-2 text-sm transition-colors',
              active === item.key
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            title={item.label}
          >
            <span className="shrink-0">{item.icon}</span>
            {open && <span className="whitespace-nowrap">{item.label}</span>}
          </button>
        ))}
      </nav>
      <div className={cn('absolute bottom-3 px-3 text-[10px] text-muted-foreground', open ? 'block' : 'hidden')}>
        FinTerminal v0.1 · 鼠标悬停展开
      </div>
    </div>
  )
}
