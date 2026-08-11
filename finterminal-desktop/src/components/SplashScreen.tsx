import { useEffect, useRef, useState } from 'react'

import Logo from './Logo'

const COLORS = ['#5B9BFF', '#C9A84C', '#3FB950', '#E68A4A', '#8957E5']

interface Particle {
  t: number          // 环上位置参数 [0,4)（4 条边）
  d: number          // 环带径向偏移比例 [0.22, 0.58]
  color: string
  alpha: number
  size: number
  // 飞溅/沉底状态
  x: number
  y: number
  vx: number
  vy: number
  state: 'ring' | 'splash' | 'pool'
}

/** 菱形轮廓上的点：t∈[0,4) 对应四条边，center 为 (0,0) */
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
    const R = () => Math.min(canvas.width, canvas.height) * 0.34

    const particles: Particle[] = []
    const N = 520
    for (let i = 0; i < N; i++) {
      particles.push({
        t: Math.random() * 4,
        d: 0.22 + Math.random() * 0.36,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: 0.1,
        size: 1.2 + Math.random() * 2.2,
        x: 0, y: 0, vx: 0, vy: 0,
        state: 'ring',
      })
    }

    const draw = (now: number) => {
      const elapsed = now - start
      const t = Math.min(elapsed / DURATION, 1)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 灰白磨砂底
      ctx.fillStyle = '#E8EAED'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const r = R()
      const cxx = cx()
      const cyy = cy()

      // 阶段参数
      const fadeIn = Math.min(Math.max((elapsed - 0) / 1000, 0), 1)
      const flow = Math.min(Math.max((elapsed - 1000) / 1500, 0), 1)
      const burst = Math.min(Math.max((elapsed - 2500) / 1000, 0), 1)
      const pool = Math.min(Math.max((elapsed - 3500) / 1500, 0), 1)
      const level = pool * canvas.height

      // 底部液面（3.5-5s 上涨）
      if (level > 0) {
        const grad = ctx.createLinearGradient(0, canvas.height - level, 0, canvas.height)
        grad.addColorStop(0, 'rgba(26,32,41,0.9)')
        grad.addColorStop(1, 'rgba(10,14,20,0.98)')
        ctx.fillStyle = grad
        ctx.fillRect(0, canvas.height - level, canvas.width, level)
        // 液面顶部彩色亮线
        ctx.fillStyle = 'rgba(91,155,255,0.5)'
        ctx.fillRect(0, canvas.height - level, canvas.width, 2)
      }

      // 环上粒子绕行 / 飞溅 / 沉底
      for (const p of particles) {
        if (p.state === 'ring') {
          const speed = 0.09 + flow * 0.22
          p.t += speed * (1 / 60) * (elapsed > 0 ? 1 : 1)
          const pt = diamondPoint(p.t, r)
          const inward = { x: -pt.x / (r || 1), y: -pt.y / (r || 1) }
          p.x = cxx + pt.x + inward.x * p.d * r
          p.y = cyy + pt.y + inward.y * p.d * r
          p.alpha = 0.12 + fadeIn * 0.2 + flow * 0.68

          if (burst > 0) {
            p.state = 'splash'
            const dirX = (p.x - cxx) / (r || 1)
            const dirY = (p.y - cyy) / (r || 1)
            const sp = (2.4 + Math.random() * 5) * r / 100
            p.vx = dirX * sp * (1 + burst)
            p.vy = dirY * sp * (1 + burst) - r * 0.004 * burst
          }
        } else if (p.state === 'splash') {
          p.vy += 0.22
          p.x += p.vx
          p.y += p.vy
          p.vx *= 0.985
          p.alpha *= 0.995
          if (p.y >= canvas.height - level || p.y > canvas.height) {
            p.state = 'pool'
            p.y = Math.min(p.y, canvas.height - level)
            p.x = Math.max(0, Math.min(canvas.width, p.x))
          }
        } else {
          // pool：停在液面上
          p.y = canvas.height - level + Math.random() * 0.5
        }

        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha))
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * (0.8 + flow * 0.6), 0, Math.PI * 2)
        ctx.fill()
      }

      // 磨砂玻璃效果：半透明遮罩 + 轻微噪点感
      ctx.globalAlpha = 0.10 + fadeIn * 0.05
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = 1

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
      {/* 磨砂玻璃上的品牌标识（DOM 层，淡入） */}
      <div className="splash-logo relative z-10 animate-[splash-logo-in_1s_ease-out_both]">
        <Logo size={150} ringOpacity={0.95} />
      </div>
      <style>{`
        @keyframes splash-logo-in {
          0% { opacity: 0; transform: scale(0.86); filter: brightness(0.5); }
          100% { opacity: 1; transform: scale(1); filter: brightness(1); }
        }
      `}</style>
    </div>
  )
}
