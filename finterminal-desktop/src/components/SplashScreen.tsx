import { useEffect, useRef, useState } from 'react'

import Logo from './Logo'

const COLORS: [number, number, number][] = [
  [91, 155, 255],   // 蓝
  [201, 168, 76],   // 金
  [63, 185, 80],    // 绿
  [230, 138, 74],   // 橙/红
  [137, 87, 229],   // 紫
]

function mix(c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ]
}

function paletteColor(pos: number): [number, number, number] {
  const p = ((pos % 1) + 1) % 1
  const seg = p * (COLORS.length - 1)
  const i = Math.min(Math.floor(seg), COLORS.length - 2)
  return mix(COLORS[i], COLORS[i + 1], seg - i)
}

/** 菱形轮廓上的点：t∈[0,4) 对应四条边，center (0,0)，R 为顶点半径 */
function diamondPoint(t: number, R: number): { x: number; y: number } {
  const seg = Math.floor(t) % 4
  const f = t - Math.floor(t)
  const corners = [
    { x: 0, y: -R },
    { x: R, y: 0 },
    { x: 0, y: R },
    { x: -R, y: 0 },
  ]
  const a = corners[seg]
  const b = corners[(seg + 1) % 4]
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fadeOut, setFadeOut] = useState(false)
  const doneRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    const start = performance.now()
    const DURATION = 5000

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const cx = () => canvas.width / 2
    const cy = () => canvas.height / 2
    const R = () => Math.min(canvas.width, canvas.height) * 0.3
    const N = 72 // 环上色段数

    // 流淌流线（12 条，从环上不同位置向外）
    const streams = Array.from({ length: 14 }, (_, i) => ({
      t0: i / 14,
      seed: i * 0.73,
      width: 5 + (i % 5) * 3,
    }))

    const draw = (now: number) => {
      const elapsed = now - start
      const t = Math.min(elapsed / DURATION, 1)
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      // 灰白磨砂底
      ctx.fillStyle = '#E8EAED'
      ctx.fillRect(0, 0, W, H)

      const r = R()
      const cxx = cx()
      const cyy = cy()

      // 阶段
      const fadeIn = Math.min(Math.max(elapsed / 1000, 0), 1)
      const flow = Math.min(Math.max((elapsed - 1000) / 1500, 0), 1)
      const pour = Math.min(Math.max((elapsed - 2500) / 1000, 0), 1)
      const pool = Math.min(Math.max((elapsed - 3500) / 1500, 0), 1)
      const level = pool * H
      const rot = elapsed / 2600 // 顺时针流动相位

      // === 彩色影子（磨砂上的色斑，flow 阶段出现） ===
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + rot * 0.6
        const [cr, cg, cb] = COLORS[i]
        const x = cxx + Math.cos(ang) * r * 1.25
        const y = cyy + Math.sin(ang) * r * 1.25
        const grd = ctx.createRadialGradient(x, y, 4, x, y, r * 0.8)
        grd.addColorStop(0, `rgba(${cr},${cg},${cb},${0.10 + flow * 0.12})`)
        grd.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grd
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
      }

      // === 双菱形环形流体（连续色带顺时针流动） ===
      const ringAlpha = 0.16 + fadeIn * 0.25 + flow * 0.55
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (let i = 0; i < N; i++) {
        const ta = (i / N) * 4
        const tb = ((i + 1.4) / N) * 4
        const pa = diamondPoint(ta + rot * 0.18, r)
        const pb = diamondPoint(tb + rot * 0.18, r)
        const color = paletteColor(i / N + rot * 0.12)
        ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${ringAlpha})`
        ctx.lineWidth = 7 + flow * 5
        ctx.beginPath()
        ctx.moveTo(cxx + pa.x, cyy + pa.y)
        ctx.lineTo(cxx + pb.x, cyy + pb.y)
        ctx.stroke()
      }
      // 内菱形淡描边
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + flow * 0.15})`
      ctx.lineWidth = 1.5
      const ipts = [0, 1, 2, 3, 4].map((s) => diamondPoint(s, r * 0.55))
      ctx.beginPath()
      ipts.forEach((p, i) => i === 0 ? ctx.moveTo(cxx + p.x, cyy + p.y) : ctx.lineTo(cxx + p.x, cyy + p.y))
      ctx.closePath()
      ctx.stroke()
      ctx.restore()

      // === 向外流淌（连续流体，2.5-3.5s） ===
      if (pour > 0) {
        ctx.save()
        ctx.lineCap = 'round'
        for (const st of streams) {
          const base = st.t0 * 4
          const pa = diamondPoint(base, r)
          const dirX = pa.x / (r || 1)
          const dirY = pa.y / (r || 1)
          const grow = Math.min(pour * (1.1 + Math.sin(st.seed * 3 + elapsed / 300) * 0.3), 1.2)
          const len = r * 1.6 * grow
          const bend = Math.sin(st.seed * 5 + elapsed / 180) * 14 // 轻微弯曲
          const color = paletteColor(st.t0 + rot * 0.12)
          const alpha = 0.22 + pour * 0.45
          // 流线：从环边缘向外，多段，宽度渐变
          const segs = 10
          for (let s = 0; s < segs; s++) {
            const f0 = s / segs
            const f1 = (s + 1) / segs
            const x0 = cxx + dirX * (r + len * f0) + bend * f0
            const y0 = cyy + dirY * (r + len * f0) + 30 * f0 * f0 + bend * f0 * 0.5
            const x1 = cxx + dirX * (r + len * f1) + bend * f1
            const y1 = cyy + dirY * (r + len * f1) + 30 * f1 * f1 + bend * f1 * 0.5
            ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha * (1 - f0 * 0.7)})`
            ctx.lineWidth = Math.max(1, st.width * (1 - f0 * 0.65))
            ctx.beginPath()
            ctx.moveTo(x0, y0)
            ctx.lineTo(x1, y1)
            ctx.stroke()
          }
        }
        ctx.restore()
      }

      // === 底部液体上涨（3.5-5s） ===
      if (level > 0) {
        const baseY = H - level
        // 液面主体
        const grad = ctx.createLinearGradient(0, baseY, 0, H)
        grad.addColorStop(0, 'rgba(30,36,46,0.92)')
        grad.addColorStop(0.35, 'rgba(18,22,30,0.96)')
        grad.addColorStop(1, 'rgba(8,11,16,0.99)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.moveTo(0, H)
        ctx.lineTo(0, baseY)
        // 波纹顶
        for (let x = 0; x <= W; x += 8) {
          const wave = Math.sin(x / 60 + elapsed / 200) * 5 * (1 - pool * 0.5)
          ctx.lineTo(x, baseY + wave)
        }
        ctx.lineTo(W, H)
        ctx.closePath()
        ctx.fill()
        // 液面彩色暗流
        for (let i = 0; i < 5; i++) {
          const [cr, cg, cb] = COLORS[i]
          const x0 = (i / 5) * W + Math.sin(elapsed / 500 + i) * 60
          const grd2 = ctx.createRadialGradient(x0, baseY + level * 0.5, 10, x0, baseY + level * 0.5, level * 0.7)
          grd2.addColorStop(0, `rgba(${cr},${cg},${cb},${0.10 + pool * 0.10})`)
          grd2.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = grd2
          ctx.fillRect(x0 - level, baseY, level * 2, level)
        }
        // 液面亮线
        ctx.fillStyle = `rgba(120,160,230,${0.25 + pool * 0.2})`
        ctx.fillRect(0, baseY - 1, W, 2)
      }

      // === 磨砂玻璃叠加 ===
      ctx.fillStyle = `rgba(255,255,255,${0.10 + fadeIn * 0.04})`
      ctx.fillRect(0, 0, W, H)

      if (elapsed >= DURATION && !doneRef.current) {
        doneRef.current = true
        setFadeOut(true)
        setTimeout(onDone, 700)
        cancelAnimationFrame(raf)
        return
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-700"
      style={{ opacity: fadeOut ? 0 : 1, background: '#E8EAED' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* 磨砂玻璃上的品牌标识（DOM 层淡入） */}
      <div className="relative z-10 animate-[splash-logo-in_1s_ease-out_both]">
        <Logo size={150} />
      </div>
      <style>{`
        @keyframes splash-logo-in {
          0% { opacity: 0; transform: scale(0.86); filter: brightness(0.55) saturate(0.4); }
          60% { filter: brightness(0.8) saturate(0.7); }
          100% { opacity: 1; transform: scale(1); filter: brightness(1) saturate(1); }
        }
      `}</style>
    </div>
  )
}
