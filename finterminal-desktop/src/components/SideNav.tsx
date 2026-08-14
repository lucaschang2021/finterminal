import { useState } from 'react'
import {
  BarChart3,
  BrainCircuit,
  FileText,
  FolderOpen,
  Link2,
  Menu,
  MessageSquare,
  Network,
  Settings,
  Upload,
} from 'lucide-react'

import Logo from './Logo'
import { useI18n } from '@/i18n/LanguageContext'
import { cn } from '@/lib/utils'

export type ViewKey = 'chat' | 'files' | 'charts' | 'chain' | 'knowledge' | 'settings' | 'export'

const ITEMS: { key: ViewKey; labelKey: string; icon: React.ReactNode }[] = [
  { key: 'files', labelKey: 'nav.files', icon: <FolderOpen className="h-[18px] w-[18px]" /> },
  { key: 'charts', labelKey: 'nav.charts', icon: <BarChart3 className="h-[18px] w-[18px]" /> },
  { key: 'chain', labelKey: 'nav.chain', icon: <Link2 className="h-[18px] w-[18px]" /> },
  { key: 'knowledge', labelKey: 'nav.knowledge', icon: <BrainCircuit className="h-[18px] w-[18px]" /> },
  { key: 'settings', labelKey: 'nav.settings', icon: <Settings className="h-[18px] w-[18px]" /> },
  { key: 'export', labelKey: 'nav.export', icon: <Upload className="h-[18px] w-[18px]" /> },
]

const LABEL_STYLE: React.CSSProperties = {
  whiteSpace: 'nowrap',
  transition: 'opacity 0.25s ease 0.12s, transform 0.25s ease 0.12s',
}

export default function SideNav({ active, onSelect }: { active: ViewKey; onSelect: (k: ViewKey) => void }) {
  const [open, setOpen] = useState(false)
  const { t } = useI18n()

  return (
    <div
      className="relative z-40 h-full shrink-0 border-r"
      style={{
        width: open ? 240 : 46,
        borderColor: 'var(--hairline)',
        background: open ? 'var(--rail-bg)' : 'transparent',
        transition:
          'width 0.5s cubic-bezier(0.32, 0.72, 0.32, 1), background 0.3s ease',
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="relative flex h-14 items-center border-b px-3" style={{ borderColor: 'var(--hairline)' }}>
        <button
          className="flex items-center gap-2"
          onClick={() => onSelect('chat')}
          title={t('nav.chat')}
        >
          <span className="flex h-6 w-6 items-center justify-center text-[var(--muted)]">
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span
            className="flex items-center gap-2 text-sm font-semibold"
            style={{
              ...LABEL_STYLE,
              opacity: open ? 1 : 0,
              transform: open ? 'translateX(0)' : 'translateX(-8px)',
            }}
          >
            <Logo size={22} mono />
            FinTerminal
          </span>
        </button>
      </div>

      <nav className="d2-nav relative flex flex-col gap-1 p-2 pt-3">
        <button
          className={cn(
            'flex h-10 items-center gap-3 px-2 text-sm',
            active === 'chat' ? 'active' : 'text-[var(--muted)]',
          )}
          onClick={() => onSelect('chat')}
          title={t('nav.chat')}
        >
          <span className="flex w-6 items-center justify-center text-[var(--muted)]">
            <MessageSquare className="h-[18px] w-[18px]" />
          </span>
          <span className="font-medium" style={{ ...LABEL_STYLE, opacity: open ? 1 : 0, transform: open ? 'translateX(0)' : 'translateX(-8px)' }}>
            {t('nav.chat')}
          </span>
        </button>
        {ITEMS.map((item) => (
          <button
            key={item.key}
            className={cn(
              'flex h-10 items-center gap-3 px-2 text-sm',
              active === item.key ? 'active' : 'text-[var(--muted)]',
            )}
            onClick={() => onSelect(item.key)}
            title={t(item.labelKey)}
          >
            <span className="flex w-6 items-center justify-center">{item.icon}</span>
            <span className="font-medium" style={{ ...LABEL_STYLE, opacity: open ? 1 : 0, transform: open ? 'translateX(0)' : 'translateX(-8px)' }}>
              {t(item.labelKey)}
            </span>
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
