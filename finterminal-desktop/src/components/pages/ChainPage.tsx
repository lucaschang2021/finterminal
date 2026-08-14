import { useEffect, useState } from 'react'

import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useI18n } from '@/i18n/LanguageContext'
import { stripEmoji } from '@/lib/utils'

export default function ChainPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState('')
  const [history, setHistory] = useState('')
  const [detail, setDetail] = useState('')
  const [path, setPath] = useState('')
  const [recordId, setRecordId] = useState('')
  const [verifyRes, setVerifyRes] = useState('')

  const refresh = () => {
    api.chain({ action: 'status' }).then((r) => setStatus(r.text ?? '')).catch(() => {})
    api.chain({ action: 'history' }).then((r) => setHistory(r.text ?? '')).catch(() => {})
  }
  useEffect(() => { refresh() }, [])

  const run = (action: string) => {
    const params: Record<string, string | undefined> = { action }
    if (path) params.path = path
    if (recordId) params.record_id = recordId
    api.chain(params).then((r) => {
      if (action === 'verify') setVerifyRes(r.text ?? '')
      else if (action === 'show') setDetail(r.text ?? '')
      else refresh()
    }).catch(() => {})
  }

  const exportReport = () => {
    setDetail(`${t('chain.reportTitle')}\n\n${status}\n\n${history}`)
  }

  return (
    <div className="p-5">
      <h2 className="page-title">{t('chain.title')}</h2>
      <p className="page-sub mb-4">{t('chain.subtitle')}</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="liquid-glass d2-cut p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('chain.status')}</span>
            <Button size="sm" variant="ghost" onClick={refresh} className="h-6 px-2 text-xs">{t('common.refresh')}</Button>
          </div>
          <pre className="mono max-h-44 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{stripEmoji(status)}</pre>
        </div>

        <div className="liquid-glass d2-cut p-4">
          <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('chain.operations')}</div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => run('snapshot')}>{t('chain.snapshot')}</Button>
            <Button size="sm" variant="secondary" onClick={() => run('verify')}>{t('chain.verify')}</Button>
            <Button size="sm" variant="secondary" onClick={exportReport}>{t('chain.exportReport')}</Button>
          </div>
          <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder={t('chain.trackPath')}
            className="glass-input mt-3 h-8 border-0 text-xs" />
          <div className="mt-2 flex gap-2">
            <Input value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder={t('chain.recordId')}
              className="glass-input h-8 flex-1 border-0 text-xs" />
            <Button size="sm" variant="secondary" onClick={() => run('show')}>{t('common.detail')}</Button>
          </div>
          {verifyRes && <pre className="mono mt-3 max-h-32 overflow-auto whitespace-pre-wrap text-[11px]" style={{ color: 'var(--muted)' }}>{stripEmoji(verifyRes)}</pre>}
        </div>
      </div>

      <div className="liquid-glass d2-cut mt-4 p-4">
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('chain.history')}</div>
        <ScrollArea className="h-56">
          <pre className="mono whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{stripEmoji(history)}</pre>
        </ScrollArea>
        {detail && <pre className="mono mt-3 border-t pt-3 text-[11px] leading-relaxed" style={{ color: 'var(--fg)', borderColor: 'var(--hairline)' }}>{stripEmoji(detail)}</pre>}
      </div>
    </div>
  )
}
