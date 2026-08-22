import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import {
  AudioLines, Boxes, ChartArea, ChartBar, ChartCandlestick, ChartColumnBig,
  ChartColumnIncreasing, ChartColumnStacked, ChartLine, ChartPie, ChartScatter, CircleDot,
  Cloud, Donut, Filter, Grid2x2, LayoutGrid, Mountain, Network, Radar, Rows,
  Ruler, Square, Target, TrendingUp, Waves, type LucideIcon,
} from 'lucide-react'

import { useI18n } from '@/i18n/LanguageContext'
import { useCapabilities } from '@/lib/capabilities'
import { cn } from '@/lib/utils'

const CHART_META: Record<string, { icon: LucideIcon; labelKey: string }> = {
  line: { icon: ChartLine, labelKey: 'chartTypes.line' },
  bar: { icon: ChartBar, labelKey: 'chartTypes.bar' },
  barh: { icon: Rows, labelKey: 'chartTypes.barh' },
  stacked_bar: { icon: ChartColumnStacked, labelKey: 'chartTypes.stacked_bar' },
  grouped_bar: { icon: ChartColumnBig, labelKey: 'chartTypes.grouped_bar' },
  scatter: { icon: ChartScatter, labelKey: 'chartTypes.scatter' },
  bubble: { icon: CircleDot, labelKey: 'chartTypes.bubble' },
  pie: { icon: ChartPie, labelKey: 'chartTypes.pie' },
  donut: { icon: Donut, labelKey: 'chartTypes.donut' },
  area: { icon: ChartArea, labelKey: 'chartTypes.area' },
  candlestick: { icon: ChartCandlestick, labelKey: 'chartTypes.candlestick' },
  box: { icon: Square, labelKey: 'chartTypes.box' },
  violin: { icon: AudioLines, labelKey: 'chartTypes.violin' },
  histogram: { icon: ChartColumnIncreasing, labelKey: 'chartTypes.histogram' },
  heatmap: { icon: Grid2x2, labelKey: 'chartTypes.heatmap' },
  radar: { icon: Radar, labelKey: 'chartTypes.radar' },
  waterfall: { icon: Waves, labelKey: 'chartTypes.waterfall' },
  funnel: { icon: Filter, labelKey: 'chartTypes.funnel' },
  step: { icon: TrendingUp, labelKey: 'chartTypes.step' },
  polar: { icon: Target, labelKey: 'chartTypes.polar' },
  errorbar: { icon: Ruler, labelKey: 'chartTypes.errorbar' },
  treemap: { icon: LayoutGrid, labelKey: 'chartTypes.treemap' },
  scatter3d: { icon: Boxes, labelKey: 'chartTypes.scatter3d' },
  surface: { icon: Mountain, labelKey: 'chartTypes.surface' },
  technical: { icon: ChartCandlestick, labelKey: 'chartTypes.technical' },
  wordcloud: { icon: Cloud, labelKey: 'chartTypes.wordcloud' },
  sankey: { icon: Network, labelKey: 'chartTypes.sankey' },
}

export default function ChartsPage({ onOpenDetail }: { onOpenDetail: (chartType: string) => void }) {
  const { t } = useI18n()
  const { chartTypes: types, error: err } = useCapabilities()
  const [path, setPath] = useState('')
  const gridRef = useRef<HTMLDivElement>(null)

  // 卡片网格：中心向外涟漪式入场
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set('.chart-card', { clearProps: 'all' })
    })
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        '.chart-card',
        { opacity: 0, y: 26, scale: 0.96 },
        {
          opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'expo.out',
          stagger: { each: 0.035, grid: 'auto', from: 'center', ease: 'power2.out' },
          clearProps: 'transform', overwrite: 'auto',
        },
      )
    })
    return () => mm.revert()
  }, { scope: gridRef, dependencies: [types.length] })


  return (
    <div className="p-5">
      <h2 className="page-title">{t('charts.title')}</h2>
      <p className="page-sub mb-4">{t('charts.subtitle')}</p>

      {err && <p className="mb-3 text-xs text-destructive">{err}</p>}

      <div ref={gridRef} className="grid grid-cols-4 gap-3 xl:grid-cols-6">
        {types.map((ct) => {
          const meta = CHART_META[ct] ?? { icon: ChartLine, labelKey: ct }
          const Icon = meta.icon
          return (
            <button
              key={ct}
              onClick={() => onOpenDetail(ct)}
              className={cn(
                'liquid-glass chart-card group flex flex-col items-center gap-2 p-4',
              )}
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
                style={{ color: 'var(--accent)' }}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={1.5} />
              </span>
              <span className="text-xs font-medium">{t(meta.labelKey)}</span>
              <span className="mono text-[10px]" style={{ color: 'var(--muted)' }}>{ct}</span>
            </button>
          )
        })}
      </div>

      <div className="liquid-glass mt-4 p-4">
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('charts.dataFile')}</div>
        <input
          className="glass-input h-9 w-full rounded-md px-3 text-sm outline-none"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder={t('charts.dataFilePlaceholder')}
        />
      </div>
    </div>
  )
}
