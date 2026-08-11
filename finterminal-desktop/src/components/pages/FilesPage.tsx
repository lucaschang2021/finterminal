import { useState } from 'react'

import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

const HOME = 'C:/Users/liuj/Desktop'

export default function FilesPage() {
  const [path, setPath] = useState(HOME)
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
    setErr('')
    api.detect(detectTarget).then((r) => setDetectRes(r.text ?? '')).catch((e) => setErr((e as Error).message))
  }

  const isDir = (ln: string) => ln.includes('文件夹')
  const name = (ln: string) => ln.replace(/\s*（.*?）\s*$/, '').trim()

  return (
    <div className="p-5">
      <h2 className="mb-1 text-lg font-semibold">文件</h2>
      <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>目录浏览 · 搜索 · 文件体检</p>

      <div className="liquid-glass mb-4 rounded-xl p-4" style={{ borderRadius: 14 }}>
        <div className="flex gap-2">
          <Input value={path} onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="目录路径"
            className="glass-input h-9 border-0" />
          <Button size="sm" variant="secondary" onClick={() => load()}>浏览</Button>
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="搜索文件名"
            className="glass-input h-9 w-56 border-0" />
          <Button size="sm" onClick={search}>搜索</Button>
        </div>
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="liquid-glass rounded-xl p-4" style={{ borderRadius: 14 }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{path}</span>
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{list.length} 项</span>
          </div>
          <ScrollArea className="h-[420px]">
            <ul>
              {list.map((ln, i) => (
                <li key={i}>
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5"
                    onClick={() => isDir(ln) ? load(`${path}/${name(ln)}`) : setDetectTarget(`${path}/${name(ln)}`)}
                  >
                    <span>{isDir(ln) ? '📂' : '📄'}</span>
                    <span className="min-w-0 flex-1 truncate">{name(ln)}</span>
                    {!isDir(ln) && <span className="text-[10px]" style={{ color: 'var(--muted)' }}>点击体检</span>}
                  </button>
                </li>
              ))}
              {list.length === 0 && <li className="px-2 py-4 text-xs" style={{ color: 'var(--muted)' }}>目录为空或未加载</li>}
            </ul>
          </ScrollArea>
        </div>

        <div className="space-y-4">
          <div className="liquid-glass rounded-xl p-4" style={{ borderRadius: 14 }}>
            <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>搜索 / 体检目标</div>
            <div className="flex gap-2">
              <Input value={detectTarget} onChange={(e) => setDetectTarget(e.target.value)} placeholder="文件完整路径"
                className="glass-input h-9 flex-1 border-0" />
              <Button size="sm" variant="secondary" onClick={detect}>体检</Button>
            </div>
            {detectRes && <pre className="mono mt-3 max-h-44 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{detectRes}</pre>}
          </div>
          {searchRes && (
            <div className="liquid-glass rounded-xl p-4" style={{ borderRadius: 14 }}>
              <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>搜索结果</div>
              <pre className="mono max-h-52 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{searchRes}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
