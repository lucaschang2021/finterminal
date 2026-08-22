import { useState } from 'react'
import { File, Folder } from 'lucide-react'

import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useI18n } from '@/i18n/LanguageContext'
import { stripEmoji } from '@/lib/utils'

/** 默认目录：当前用户桌面（避免把开发者的用户名路径写死给别人） */
function defaultHome(): string {
  const home = window.finterminal?.homeDir
  if (home) return home.replace(/\\/g, '/') + '/Desktop'
  // 开发模式（无 preload）回退系统公共目录，避免硬编码具体用户名
  return 'C:/Users/Public'
}
const HOME = defaultHome()

export default function FilesPage({ onFileSelected }: { onFileSelected?: (path: string) => void }) {
  const { t } = useI18n()
  const [path, setPath] = useState(() => localStorage.getItem('ft_files_path') || HOME)
  const [list, setList] = useState<string[]>([])
  const [keyword, setKeyword] = useState('')
  const [searchRes, setSearchRes] = useState('')
  const [detectTarget, setDetectTarget] = useState('')
  const [detectRes, setDetectRes] = useState('')
  const [err, setErr] = useState('')

  const load = (p?: string) => {
    const target = p ?? path
    if (p) setPath(p)
    setErr('')
    api.files(target)
      .then((r) => setList((r.text ?? '').split('\n').filter(Boolean)))
      .catch((e) => setErr((e as Error).message))
  }

  const search = () => {
    setErr('')
    api.search(keyword, path, true).then((r) => setSearchRes(r.text ?? '')).catch((e) => setErr((e as Error).message))
  }

  const detect = () => {
    if (detectTarget) onFileSelected?.(detectTarget)
    setErr('')
    api.detect(detectTarget).then((r) => setDetectRes(r.text ?? '')).catch((e) => setErr((e as Error).message))
  }

  const isDir = (ln: string) => ln.includes('文件夹')
  const name = (ln: string) => ln.replace(/\s*（.*?）\s*$/, '').trim()

  return (
    <div className="p-5">
      <h2 className="page-title">{t('files.title')}</h2>
      <p className="page-sub mb-4">{t('files.subtitle')}</p>

      <div className="liquid-glass d2-cut mb-4 p-4">
        <div className="flex gap-2">
          <Input value={path} onChange={(e) => { setPath(e.target.value); localStorage.setItem('ft_files_path', e.target.value) }}
            onKeyDown={(e) => e.key === 'Enter' && load()} placeholder={t('files.dirPath')}
            className="glass-input h-9 border-0" />
          <Button size="sm" variant="secondary" onClick={() => load()}>{t('common.browse')}</Button>
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()} placeholder={t('files.searchFilename')}
            className="glass-input h-9 w-56 border-0" />
          <Button size="sm" onClick={search}>{t('common.search')}</Button>
        </div>
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="liquid-glass d2-cut p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{path}</span>
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{t('files.items', { n: list.length })}</span>
          </div>
          <ScrollArea className="h-[420px]">
            <ul>
              {list.map((ln, i) => (
                <li key={i}>
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5"
                    onClick={() => isDir(ln) ? load(`${path}/${name(ln)}`) : setDetectTarget(`${path}/${name(ln)}`)}
                  >
                    <span className="flex items-center justify-center text-[var(--muted)]">
                      {isDir(ln) ? <Folder className="h-4 w-4" /> : <File className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{name(ln)}</span>
                    {!isDir(ln) && <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{t('files.clickCheck')}</span>}
                  </button>
                </li>
              ))}
              {list.length === 0 && <li className="px-2 py-4 text-xs" style={{ color: 'var(--muted)' }}>{t('files.emptyDir')}</li>}
            </ul>
          </ScrollArea>
        </div>

        <div className="space-y-4">
          <div className="liquid-glass d2-cut p-4">
            <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('files.searchTarget')}</div>
            <div className="flex gap-2">
              <Input value={detectTarget} onChange={(e) => setDetectTarget(e.target.value)} placeholder={t('files.fullPath')}
                className="glass-input h-9 flex-1 border-0" />
              <Button size="sm" variant="secondary" onClick={detect}>{t('files.check')}</Button>
            </div>
            {detectRes && <pre className="mono mt-3 max-h-44 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{stripEmoji(detectRes)}</pre>}
          </div>
          {searchRes && (
            <div className="liquid-glass d2-cut p-4">
              <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('files.searchResults')}</div>
              <pre className="mono max-h-52 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{stripEmoji(searchRes)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
