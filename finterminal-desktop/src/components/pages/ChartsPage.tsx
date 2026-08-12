import { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import {
  AudioLines, Boxes, ChartArea, ChartBar, ChartCandlestick, ChartColumnBig,
  ChartColumnIncreasing, ChartColumnStacked, ChartLine, ChartPie, ChartScatter, CircleDot,
  Cloud, Donut, Filter, Grid2x2, LayoutGrid, Mountain, Network, Radar, Rows,
  Ruler, Square, Target, TrendingUp, Waves, type LucideIcon,
} from 'lucide-react'

import { api } from '@/api'
import { cn } from '@/lib/utils'

const CHART_META: Record<string, { icon: LucideIcon; zh: string }> = {
  line: { icon: ChartLine, zh: '折线' },
  bar: { icon: ChartBar, zh: '柱状' },
  barh: { icon: Rows, zh: '水平柱状' },
  stacked_bar: { icon: ChartColumnStacked, zh: '堆叠柱状' },
  grouped_bar: { icon: ChartColumnBig, zh: '分组柱状' },
  scatter: { icon: ChartScatter, zh: '散点' },
  bubble: { icon: CircleDot, zh: '气泡' },
  pie: { icon: ChartPie, zh: '饼图' },
  donut: { icon: Donut, zh: '环形' },
  area: { icon: ChartArea, zh: '面积' },
  candlestick: { icon: ChartCandlestick, zh: 'K线' },
  box: { icon: Square, zh: '箱线' },
  violin: { icon: AudioLines, zh: '小提琴' },
  histogram: { icon: ChartColumnIncreasing, zh: '直方图' },
  heatmap: { icon: Grid2x2, zh: '热力图' },
  radar: { icon: Radar, zh: '雷达' },
  waterfall: { icon: Waves, zh: '瀑布' },
  funnel: { icon: Filter, zh: '漏斗' },
  step: { icon: TrendingUp, zh: '阶梯' },
  polar: { icon: Target, zh: '极坐标' },
  errorbar: { icon: Ruler, zh: '误差棒' },
  treemap: { icon: LayoutGrid, zh: '矩形树' },
  scatter3d: { icon: Boxes, zh: '3D散点' },
  surface: { icon: Mountain, zh: '3D曲面' },
  technical: { icon: ChartCandlestick, zh: '技术面' },
  wordcloud: { icon: Cloud, zh: '词云' },
  sankey: { icon: Network, zh: '桑基' },
}

export default function ChartsPage({ onOpenDetail }: { onOpenDetail: (chartType: string) => void }) {
  const [types, setTypes] = useState<string[]>([])
  const [path, setPath] = useState('')
  const [err, setErr] = useState('')
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

  useEffect(() => {
    api.health()
      .then((r) => setTypes(r.data?.charts ?? []))
      .catch((e) => setErr((e as Error).message))
  }, [])

  return (
    <div className="p-5">
      <h2 className="page-title">图表</h2>
      <p className="page-sub mb-4">24+ 种图表 · 点击缩略图在底部面板交互渲染</p>

      {err && <p className="mb-3 text-xs text-destructive">{err}</p>}

      <div ref={gridRef} className="grid grid-cols-4 gap-3 xl:grid-cols-6">
        {types.map((t) => {
          const meta = CHART_META[t] ?? { icon: ChartLine, zh: t }
          const Icon = meta.icon
          return (
            <button
              key={t}
              onClick={() => onOpenDetail(t)}
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
              <span className="text-xs font-medium">{meta.zh}</span>
              <span className="mono text-[10px]" style={{ color: 'var(--muted)' }}>{t}</span>
            </button>
          )
        })}
      </div>

      <div className="liquid-glass mt-4 p-4">
        <div className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>数据文件（可选，用于本地数据图表）</div>
        <input
          className="glass-input h-9 w-full rounded-md px-3 text-sm outline-none"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="C:/xxx/sales.csv（行情图可留空）"
        />
      </div>
    </div>
  )
}
