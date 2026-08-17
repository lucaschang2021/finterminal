import { useState } from 'react'

import { api, fileUrl } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/LanguageContext'
import { stripEmoji } from '@/lib/utils'

interface ExportGroup {
  title: string
  desc: string
  actions: { label: string; run: () => Promise<string> }[]
}

export default function ExportPage() {
  const { t } = useI18n()
  const [result, setResult] = useState('')
  const [path, setPath] = useState(() => localStorage.getItem('ft_export_path') || '')
  const [chartType, setChartType] = useState(() => localStorage.getItem('ft_export_chart') || 'line')
  const [busy, setBusy] = useState('')

  const groups: ExportGroup[] = [
    {
      title: t('export.reportExport'),
      desc: t('export.reportExportDesc'),
      actions: [
        {
          label: t('export.genPdf'),
          run: async () => {
            if (!path) return t('export.needPath')
            const r = await api.analyze({ file_path: path, analysis: 'report', save: true, format: 'pdf', ai_comment: true })
            return r.text ?? ''
          },
        },
        {
          label: t('export.genMd'),
          run: async () => {
            if (!path) return t('export.needPath')
            const r = await api.analyze({ file_path: path, analysis: 'report', save: true, format: 'md', ai_comment: true })
            return r.text ?? ''
          },
        },
      ],
    },
    {
      title: t('export.chartExport'),
      desc: t('export.chartExportDesc'),
      actions: [
        {
          label: t('export.savePng'),
          run: async () => {
            if (!path) return t('export.needPath')
            const r = await api.plotSave({ chart_type: chartType, path })
            return r.text ?? ''
          },
        },
      ],
    },
    {
      title: t('export.chainProof'),
      desc: t('export.chainProofDesc'),
      actions: [
        {
          label: t('export.exportChain'),
          run: async () => {
            const s = await api.chain({ action: 'status' })
            const h = await api.chain({ action: 'history' })
            return `${s.text ?? ''}\n\n${h.text ?? ''}`
          },
        },
      ],
    },
    {
      title: t('export.kbExport'),
      desc: t('export.kbExportDesc'),
      actions: [
        {
          label: t('export.exportDocs'),
          run: async () => {
            const r = await api.knowledge({ action: 'status' })
            return r.text ?? ''
          },
        },
      ],
    },
  ]

  const runAction = async (groupIdx: number, actionIdx: number) => {
    const a = groups[groupIdx].actions[actionIdx]
    setBusy(a.label); setResult('')
    try {
      setResult(await a.run())
    } catch (e) {
      setResult((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="p-5">
      <h2 className="page-title">{t('export.title')}</h2>
      <p className="page-sub mb-4">{t('export.subtitle')}</p>

      <div className="liquid-glass d2-cut mb-4 p-4">
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('export.params')}</div>
        <div className="flex gap-2">
          <Input value={path} onChange={(e) => { setPath(e.target.value); localStorage.setItem('ft_export_path', e.target.value) }} placeholder={t('export.dataPathPlaceholder')}
            className="glass-input h-9 flex-1 border-0" />
          <Input value={chartType} onChange={(e) => { setChartType(e.target.value); localStorage.setItem('ft_export_chart', e.target.value) }} placeholder={t('export.chartTypePlaceholder')}
            className="glass-input h-9 w-32 border-0" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {groups.map((g, gi) => (
          <div key={g.title} className="liquid-glass d2-cut p-4">
            <div className="mb-1 text-sm font-medium">{g.title}</div>
            <div className="mb-3 text-[11px]" style={{ color: 'var(--muted)' }}>{g.desc}</div>
            <div className="flex flex-wrap gap-2">
              {g.actions.map((a, ai) => (
                <Button key={a.label} size="sm" variant="secondary" onClick={() => runAction(gi, ai)} disabled={!!busy}>
                  {busy === a.label ? t('export.exporting') : a.label}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {result && (
        <div className="liquid-glass d2-cut mt-4 p-4">
          <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('export.exportResult')}</div>
          <pre className="mono max-h-72 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{stripEmoji(result)}</pre>
        </div>
      )}
    </div>
  )
}
