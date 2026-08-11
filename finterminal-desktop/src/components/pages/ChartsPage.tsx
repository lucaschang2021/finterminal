import { useEffect, useState } from 'react'

import { api } from '@/api'
import { cn } from '@/lib/utils'

const CHART_META: Record<string, { icon: string; zh: string }> = {
  line: { icon: '〰️', zh: '折线' },
  bar: { icon: '📊', zh: '柱状' },
  barh: { icon: '📉', zh: '水平柱状' },
  stacked_bar: { icon: '🧱', zh: '堆叠柱状' },
  grouped_bar: { icon: '📶', zh: '分组柱状' },
  scatter: { icon: '✨', zh: '散点' },
  bubble: { icon: '🫧', zh: '气泡' },
  pie: { icon: '🥧', zh: '饼图' },
  donut: { icon: '🍩', zh: '环形' },
  area: { icon: '🌊', zh: '面积' },
  candlestick: { icon: '🕯️', zh: 'K线' },
  box: { icon: '📦', zh: '箱线' },
  violin: { icon: '🎻', zh: '小提琴' },
  histogram: { icon: '🏔️', zh: '直方图' },
  heatmap: { icon: '🔥', zh: '热力图' },
  radar: { icon: '🕸️', zh: '雷达' },
  waterfall: { icon: '💧', zh: '瀑布' },
  funnel: { icon: '🔻', zh: '漏斗' },
  step: { icon: '🪜', zh: '阶梯' },
  polar: { icon: '🎯', zh: '极坐标' },
  errorbar: { icon: '📏', zh: '误差棒' },
  treemap: { icon: '🗺️', zh: '矩形树' },
  scatter3d: { icon: '🧊', zh: '3D散点' },
  surface: { icon: '🏄', zh: '3D曲面' },
  technical: { icon: '📈', zh: '技术面' },
  wordcloud: { icon: '☁️', zh: '词云' },
  sankey: { icon: '🔀', zh: '桑基' },
}

export default function ChartsPage({ onOpenDetail }: { onOpenDetail: (chartType: string) => void }) {
  const [types, setTypes] = useState<string[]>([])
  const [path, setPath] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    api.health()
      .then((r) => setTypes(r.data?.charts ?? []))
      .catch((e) => setErr((e as Error).message))
  }, [])

  return (
    <div className="p-5">
      <h2 className="mb-1 text-lg font-semibold">图表</h2>
      <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>24+ 种图表 · 点击缩略图在底部面板交互渲染</p>

      {err && <p className="mb-3 text-xs text-destructive">{err}</p>}

      <div className="grid grid-cols-4 gap-3 xl:grid-cols-6">
        {types.map((t) => {
          const meta = CHART_META[t] ?? { icon: '📈', zh: t }
          return (
            <button
              key={t}
              onClick={() => onOpenDetail(t)}
              className={cn(
                'liquid-glass group flex flex-col items-center gap-2 rounded-xl p-4 transition-all hover:-translate-y-0.5',
              )}
              style={{ borderRadius: 14 }}
            >
              <span className="text-2xl transition-transform group-hover:scale-110">{meta.icon}</span>
              <span className="text-xs font-medium">{meta.zh}</span>
              <span className="mono text-[10px]" style={{ color: 'var(--muted)' }}>{t}</span>
            </button>
          )
        })}
      </div>

      <div className="liquid-glass mt-4 rounded-xl p-4" style={{ borderRadius: 14 }}>
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
