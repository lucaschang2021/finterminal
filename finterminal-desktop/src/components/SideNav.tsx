import { useState } from 'react'
import {
  BarChart3,
  BrainCircuit,
  FileText,
  FolderOpen,
  Link2,
  MessageSquare,
  Network,
  Settings,
  Upload,
} from 'lucide-react'

import Logo from './Logo'
import { cn } from '@/lib/utils'

export type ViewKey = 'chat' | 'files' | 'charts' | 'chain' | 'knowledge' | 'settings' | 'export'

const ITEMS: { key: ViewKey; label: string; icon: React.ReactNode }[] = [
  { key: 'files', label: '文件', icon: <FolderOpen className="h-[18px] w-[18px]" /> },
  { key: 'charts', label: '图表', icon: <BarChart3 className="h-[18px] w-[18px]" /> },
  { key: 'chain', label: '数据链', icon: <Link2 className="h-[18px] w-[18px]" /> },
  { key: 'knowledge', label: '知识库', icon: <BrainCircuit className="h-[18px] w-[18px]" /> },
  { key: 'settings', label: '设置', icon: <Settings className="h-[18px] w-[18px]" /> },
  { key: 'export', label: '导出', icon: <Upload className="h-[18px] w-[18px]" /> },
]

export default function SideNav({ active, onSelect }: { active: ViewKey; onSelect: (k: ViewKey) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="relative z-40 h-full shrink-0 border-r transition-all duration-500"
      style={{
        width: open ? 240 : 46,
        borderColor: 'rgba(255,255,255,0.06)',
        background: open ? 'rgba(22,27,34,0.50)' : 'transparent',
        backdropFilter: open ? 'blur(24px) saturate(1.4)' : 'none',
        WebkitBackdropFilter: open ? 'blur(24px) saturate(1.4)' : 'none',
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* 极淡蓝暗流 */}
      {open && <div className="flow-current" style={{ '--flow-strength': '4%', '--flow-speed': '16s' } as React.CSSProperties} />}

      <div className="relative flex h-14 items-center border-b px-3" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <button
          className="flex items-center gap-2"
          onClick={() => onSelect('chat')}
          title="对话"
        >
          <span className="flex h-6 w-6 items-center justify-center text-lg leading-none text-[var(--muted)]">≡</span>
          {open && (
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Logo size={22} />
              FinTerminal
            </span>
          )}
        </button>
      </div>

      <nav className="relative flex flex-col gap-1 p-2 pt-3">
        <button
          className={cn(
            'flex h-10 items-center gap-3 rounded-lg px-2 text-sm transition-colors',
            active === 'chat' ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--fg)]',
          )}
          onClick={() => onSelect('chat')}
          title="对话"
        >
          <span className="flex w-6 items-center justify-center text-[var(--muted)]">
            <MessageSquare className="h-[18px] w-[18px]" />
          </span>
          {open && <span className="whitespace-nowrap">对话</span>}
        </button>
        {ITEMS.map((item) => (
          <button
            key={item.key}
            className={cn(
              'flex h-10 items-center gap-3 rounded-lg px-2 text-sm transition-colors',
              active === item.key
                ? 'bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]'
                : 'text-[var(--muted)] hover:bg-white/5 hover:text-[var(--fg)]',
            )}
            onClick={() => onSelect(item.key)}
            title={item.label}
          >
            <span className="flex w-6 items-center justify-center">{item.icon}</span>
            {open && <span className="whitespace-nowrap">{item.label}</span>}
          </button>
        ))}
      </nav>

      {open && (
        <div className="absolute bottom-4 left-0 right-0 px-4 text-[10px] text-[var(--muted)]">
          FinTerminal v0.2
        </div>
      )}
    </div>
  )
}
