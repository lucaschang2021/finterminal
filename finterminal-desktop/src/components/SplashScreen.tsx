import { useEffect, useMemo, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Check } from 'lucide-react'

import diamondUrl from '@/assets/diamond.svg'
import {
  login,
  register,
  rememberedUsers,
  setCurrentUser,
  setRemember,
} from '@/lib/auth'
import { useI18n } from '@/i18n/LanguageContext'
import { FLOW_PAL, interpR, R_IN_WIDE, R_OUT48, R_OUT_CLIP } from './splash/splashData'
import './SplashScreen.css'

const DESIGN_W = 1440
const DESIGN_H = 900
const LOAD_SEC = 2.7
const COVER_SEC = 0.5
const LOGIN_AT_MS = 3800
const EMERGE_DONE_AT = LOAD_SEC + 1.02 // 色块逐层浮现完成时间

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const smooth = (v: number) => v * v * (3 - 2 * v)

interface Stroke {
  x1: number
  y1: number
  x2: number
  y2: number
  colorIdx: number
  shade: number
  w: number
  delayTier: number
  op: number
}

interface Group {
  color: string
  width: number
  op: number
  delayTier: number
  path: Path2D
  strokes: Stroke[]
}

const SHADE_F: Record<number, [number, number, number]> = {
  0: [0.8, 0.8, 0.8],
  1: [0.95, 0.95, 0.95],
  2: [1.12, 1.12, 1.12],
}

const FLOW_HEX = ['#2868A4', '#329BAE', '#5BB884', '#ABA766', '#FBA049', '#EB5844', '#7B2480', '#3D239F']

function hexRgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

/** 按 (色, 明暗, 浮现层) 预分组并缓存基础路径 */
function buildGroups(strokes: Stroke[]): Group[] {
  const map = new Map<number, Group>()
  for (const st of strokes) {
    const key = (st.colorIdx * 3 + st.shade) * 10 + st.delayTier
    let g = map.get(key)
    if (!g) {
      const [r, gg, b] = hexRgb(FLOW_HEX[st.colorIdx])
      const sf = SHADE_F[st.shade]
      g = {
        color: `rgb(${Math.round(r * sf[0])},${Math.round(gg * sf[1])},${Math.round(b * sf[2])})`,
        width: st.w,
        op: st.op,
        delayTier: st.delayTier,
        path: new Path2D(),
        strokes: [],
      }
      map.set(key, g)
    }
    g.path.moveTo(st.x1, st.y1)
    g.path.lineTo(st.x2, st.y2)
    g.strokes.push(st)
    if (st.w > g.width) g.width = st.w
    if (st.op > g.op) g.op = st.op
  }
  return [...map.values()]
}

/** 生成梵高色块笔触（设计空间 1440x900） */
function buildStrokes(): Stroke[] {
  const strokes: Stroke[] = []
  const pal = ['#2868A4', '#329BAE', '#5BB884', '#ABA766', '#FBA049', '#EB5844', '#7B2480', '#3D239F']
  const palIdx = (x: number, y: number) => {
    const v = x * 0.021 + y * 0.017 + Math.sin(x * 0.05) * 1.8 + Math.sin(y * 0.035) * 1.6
    return ((Math.floor(v) % 8) + 8) % 8
  }
  const delayOf = (x: number, y: number) => {
    const d = Math.hypot(x - DESIGN_W / 2, y - DESIGN_H * 0.49) / (DESIGN_H * 0.62)
    const delay = 0.18 + d * 0.9 + Math.abs(Math.sin(x * 3.7 + y * 5.3)) * 0.32
    return Math.min(9, Math.floor(delay / 0.14))
  }
  const add = (x: number, y: number, a: number, len: number, w: number, colorIdx: number, shade: number, op: number) => {
    const dx = Math.cos(a) * len / 2
    const dy = Math.sin(a) * len / 2
    strokes.push({
      x1: x - dx,
      y1: y - dy,
      x2: x + dx,
      y2: y + dy,
      colorIdx,
      shade,
      w,
      delayTier: delayOf(x, y),
      op,
    })
  }
  // 第一层：宽软笔触（油画底色）
  for (let y = 18; y <= DESIGN_H; y += 30) {
    for (let x = 12; x <= DESIGN_W; x += 30) {
      const h1 = Math.sin(x * 7.31 + y * 11.17)
      const a = Math.PI / 2 + 0.3 * Math.sin(x * 0.02 + y * 0.016 + h1 * 2)
      const len = 46 + 30 * Math.sin(x * 0.043 + y * 0.037) + 8 * h1
      const w = 15 + 9 * Math.abs(Math.sin(x * 0.09 + y * 0.07))
      const shade = Math.abs(Math.sin(x * 0.17 + y * 0.11)) < 0.5 ? 0 : 1
      add(x, y, a, len, w, palIdx(x, y), shade, 0.62)
    }
  }
  // 第二层：细密肌理笔触（impasto）
  for (let y = 12; y <= DESIGN_H; y += 17) {
    for (let x = 6; x <= DESIGN_W; x += 18) {
      const h2 = Math.sin(x * 5.9 + y * 9.3)
      const a = Math.PI / 2 + 0.24 * Math.sin(x * 0.028 + y * 0.022 + h2)
      const len = 30 + 24 * Math.sin(x * 0.058 + y * 0.047)
      const w = 8 + 7 * Math.abs(Math.sin(x * 0.13 + y * 0.1))
      const shade = Math.abs(Math.sin(x * 0.2 + y * 0.13)) < 0.5 ? 0 : 2
      add(x, y, a, len, w, palIdx(x, y), shade, 0.8)
    }
  }
  // 第三层：稀疏提亮高光
  for (let i = 0; i < 100; i++) {
    const x = (i * 241) % DESIGN_W
    const y = 20 + ((i * 131) % (DESIGN_H - 40))
    const a = Math.PI / 2 + Math.sin(i * 2.7) * 0.5
    const len = 18 + (i % 5) * 5
    add(x, y, a, len, 4.5, palIdx(x, y), 2, 0.52)
  }
  return strokes
}

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const { t } = useI18n()
  const [stage, setStage] = useState<'idle' | 'loading' | 'login'>('idle')
  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [remember, setRememberState] = useState(true)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [err, setErr] = useState('')
  const [users, setUsers] = useState<string[]>(() => rememberedUsers())

  const startRef = useRef(0)
  const stageRef = useRef(stage)
  stageRef.current = stage
  const doneRef = useRef(false)
  const ringRef = useRef<HTMLCanvasElement>(null)
  // 环流相位：连续累加，跨 idle→loading 不跳变（旋转平滑变缓再加速）
  const phaseRef = useRef(0)
  const prevTimeRef = useRef(0)
  const blocksRef = useRef<HTMLCanvasElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const blocksReady = useRef(false)
  // GSAP 驱动的流动/呼吸/凸起状态
  const flowRef = useRef({ x: 0, y: 0, scale: 1 })
  const bumpRef = useRef({ x: -1e5, y: -1e5 })
  const bumpActiveRef = useRef(false)
  const bumpQuickRef = useRef<{ qx: (v: number) => void; qy: (v: number) => void } | null>(null)
  const flowWaveRef = useRef(0)
  const strokes = useMemo(buildStrokes, [])
  const groups = useMemo(() => buildGroups(strokes), [strokes])
  // 凸起重绘用的色桶样式（色+明暗 → 颜色/线宽）
  const bucketStyles = useMemo(() => {
    const map = new Map<number, { color: string; width: number }>()
    for (const st of strokes) {
      const key = st.colorIdx * 3 + st.shade
      let b = map.get(key)
      if (!b) {
        const [r, gg, bb] = hexRgb(FLOW_HEX[st.colorIdx])
        const sf = SHADE_F[st.shade]
        b = {
          color: `rgb(${Math.round(r * sf[0])},${Math.round(gg * sf[1])},${Math.round(bb * sf[2])})`,
          width: st.w,
        }
        map.set(key, b)
      }
      if (st.w > b.width) b.width = st.w
    }
    return map
  }, [strokes])
  // 呼吸光晕预渲染（静态渐变，每帧只贴图）
  const glowCanvas = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = DESIGN_W
    cv.height = DESIGN_H
    const ctx = cv.getContext('2d')
    if (ctx) {
      const spots: Array<[number, number, number, string]> = [
        [0.24, 0.62, 0.46, 'rgba(40,104,164,0.5)'],
        [0.74, 0.68, 0.4, 'rgba(50,155,174,0.45)'],
        [0.5, 0.86, 0.38, 'rgba(251,160,73,0.42)'],
        [0.12, 0.82, 0.44, 'rgba(123,36,128,0.48)'],
        [0.88, 0.36, 0.42, 'rgba(61,35,159,0.46)'],
      ]
      for (const [fx, fy, fr, col] of spots) {
        const gr = ctx.createRadialGradient(fx * DESIGN_W, fy * DESIGN_H, 10, fx * DESIGN_W, fy * DESIGN_H, fr * DESIGN_H)
        gr.addColorStop(0, col)
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = gr
        ctx.fillRect(0, 0, DESIGN_W, DESIGN_H)
      }
    }
    return cv
  }, [])
  // 色块铺满后的离屏缓存（稳态只贴图）
  const blocksOff = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = DESIGN_W
    cv.height = DESIGN_H
    return cv
  }, [])
  // 每层色块预渲染为独立离屏图（浮现期只贴图，零笔触重建）
  const tierOffs = useMemo(() => {
    const arr: HTMLCanvasElement[] = []
    for (let tier = 0; tier < 10; tier++) {
      const cv = document.createElement('canvas')
      cv.width = DESIGN_W
      cv.height = DESIGN_H
      const ctx = cv.getContext('2d')
      if (ctx) {
        ctx.lineCap = 'butt'
        for (const g of groups) {
          if (g.delayTier !== tier) continue
          ctx.globalAlpha = 1
          ctx.strokeStyle = g.color
          ctx.lineWidth = g.width
          ctx.stroke(g.path)
        }
        ctx.globalAlpha = 1
      }
      arr.push(cv)
    }
    return arr
  }, [groups])
  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  // 菱形流光裁剪（实测外轮廓 → clip-path 多边形）
  const shimmerClip = useMemo(() => {
    const pts: string[] = []
    const TWO_PI = Math.PI * 2
    for (let i = 0; i < 48; i++) {
      const th = (i / 48) * TWO_PI
      const r = interpR(th, R_OUT_CLIP)
      const x = ((r * Math.cos(th) + 387) / 774) * 100
      const y = ((r * Math.sin(th) + 401.6) / 803.2) * 100
      pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`)
    }
    return `polygon(${pts.join(',')})`
  }, [])

  const finish = () => {
    if (!doneRef.current) {
      doneRef.current = true
      onDone()
    }
  }

  // 任意键启动
  useEffect(() => {
    const startIfIdle = () => {
      if (stageRef.current === 'idle') {
        startRef.current = performance.now()
        setStage('loading')
      }
    }
    const onKey = () => startIfIdle()
    const onPointer = () => startIfIdle()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    window.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [])

  // 鼠标（凸起）
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const bx = (e.clientX / window.innerWidth) * DESIGN_W
      const by = (e.clientY / window.innerHeight) * DESIGN_H
      bumpActiveRef.current = true
      if (bumpQuickRef.current) {
        bumpQuickRef.current.qx(bx)
        bumpQuickRef.current.qy(by)
      } else {
        bumpRef.current.x = bx
        bumpRef.current.y = by
      }
    }
    const onLeave = () => {
      bumpActiveRef.current = false
    }
    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  gsap.registerPlugin(useGSAP)

  // GSAP：色块呼吸/漂移 + 菱形流光 + 凸起平滑跟手
  useGSAP(
    () => {
      if (reduced) return
      gsap.to(flowRef.current, { scale: 1.02, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1 })
      gsap.to(flowRef.current, { x: 9, duration: 8, ease: 'sine.inOut', yoyo: true, repeat: -1 })
      gsap.to(flowRef.current, { y: 5, duration: 11, ease: 'sine.inOut', yoyo: true, repeat: -1 })
      bumpQuickRef.current = {
        qx: gsap.quickTo(bumpRef.current, 'x', { duration: 0.25, ease: 'power2.out' }),
        qy: gsap.quickTo(bumpRef.current, 'y', { duration: 0.25, ease: 'power2.out' }),
      }
    },
    { dependencies: [reduced] },
  )

  // GSAP：登录卡高级入场
  useGSAP(
    () => {
      if (stage === 'login' && cardRef.current && !reduced) {
        gsap.fromTo(
          cardRef.current,
          { opacity: 0, y: 18, scale: 0.96 },
          { opacity: 1, y: 0, scale: 1, duration: 0.85, ease: 'back.out(1.4)' },
        )
      }
    },
    { dependencies: [stage, reduced] },
  )

  // 加载完成 → 每次都必须经过登录卡（保留用户名 + 密码表单）
  useEffect(() => {
    if (stage !== 'loading') return
    const timer = window.setTimeout(() => {
      setStage('login')
    }, LOGIN_AT_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // 动效降级
  useEffect(() => {
    if (reduced) {
      setStage('login')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 主渲染循环：空闲时只跑慢速环流（菱形灵动），加载/登录跑完整绘制
  useEffect(() => {
    if (reduced) return
    let raf = 0
    prevTimeRef.current = performance.now()
    const loop = () => {
      const now = performance.now()
      const dt = Math.min(0.05, Math.max(0, (now - prevTimeRef.current) / 1000))
      prevTimeRef.current = now
      if (stageRef.current === 'idle') {
        phaseRef.current += 0.5 * dt
        drawRing(0.72, phaseRef.current)
      } else {
        const t = Math.max(0, (now - startRef.current) / 1000)
        const ringP = clamp01(t / LOAD_SEC)
        const coverP = clamp01((t - LOAD_SEC) / COVER_SEC)
        // 按键后先微微变缓（0.5 → 0.4 圈/秒），再二次加速至 5 圈/秒
        const rate = 0.4 + 4.6 * ringP * ringP
        phaseRef.current += rate * dt
        draw(t, phaseRef.current)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  function draw(t: number, phase: number) {
    const ringP = clamp01(t / LOAD_SEC)
    const coverP = clamp01((t - LOAD_SEC) / COVER_SEC)
    drawRing((0.72 + 0.08 * ringP) * (1 - coverP), phase)
    drawBlocks(t, coverP)
  }

  function drawRing(alpha: number, phase: number) {
    const cv = ringRef.current
    if (!cv) return
    const wrap = cv.parentElement
    if (!wrap) return
    const dpr = window.devicePixelRatio || 1
    const rect = cv.getBoundingClientRect()
    const w = rect.width || wrap.clientWidth || 300
    const h = rect.height || wrap.clientHeight || 311
    const cw = Math.round(w * dpr)
    const ch = Math.round(h * dpr)
    if (cv.width !== cw) cv.width = cw
    if (cv.height !== ch) cv.height = ch
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr * (w / 774), 0, 0, dpr * (h / 803.2), (dpr * w) / 2, (dpr * h) / 2)
    ctx.clearRect(-400, -415, 800, 830)
    if (alpha <= 0.01) return
    ctx.globalAlpha = alpha
    // 单个 evenodd 环带填充 + 旋转锥形渐变：整体连续，任何角度都不可能缺色
    const TWO_PI = Math.PI * 2
    const outer = new Path2D()
    const inner = new Path2D()
    for (let i = 0; i <= 96; i++) {
      const th = (i / 96) * TWO_PI
      const ro = interpR(th, R_OUT48)
      const ri = interpR(th, R_IN_WIDE)
      const xo = ro * Math.cos(th)
      const yo = ro * Math.sin(th)
      const xi = ri * Math.cos(th)
      const yi = ri * Math.sin(th)
      if (i === 0) {
        outer.moveTo(xo, yo)
        inner.moveTo(xi, yi)
      } else {
        outer.lineTo(xo, yo)
        inner.lineTo(xi, yi)
      }
    }
    outer.closePath()
    inner.closePath()
    const ring = new Path2D()
    ring.addPath(outer)
    ring.addPath(inner)
    // phase 以"圈"为单位：每圈 = 2π 弧度，颜色沿环逆时针流动
    const grad = ctx.createConicGradient(-phase * Math.PI * 2, 0, 0)
    FLOW_PAL.forEach((c, i) => grad.addColorStop(i / 8, c))
    grad.addColorStop(1, FLOW_PAL[0])
    ctx.fillStyle = grad
    ctx.fill(ring, 'evenodd')
    ctx.globalAlpha = 1
  }

  function renderBlocksOffscreen() {
    const octx = blocksOff.getContext('2d')
    if (!octx) return
    octx.clearRect(0, 0, DESIGN_W, DESIGN_H)
    octx.lineCap = 'butt'
    for (const g of groups) {
      octx.globalAlpha = 1
      octx.strokeStyle = g.color
      octx.lineWidth = g.width
      octx.stroke(g.path)
    }
    octx.globalAlpha = 1
    blocksReady.current = true
  }

  function drawBlocks(t: number, coverP: number) {
    const cv = blocksRef.current
    if (!cv) return
    const dpr = 1 // 色块画布固定 1x，显著降低绘制成本
    const w = window.innerWidth
    const h = window.innerHeight
    const cw = Math.round(w * dpr)
    const ch = Math.round(h * dpr)
    if (cv.width !== cw) cv.width = cw
    if (cv.height !== ch) cv.height = ch
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const sx = (dpr * w) / DESIGN_W
    const sy = (dpr * h) / DESIGN_H
    flowWaveRef.current = t * 2.0
    ctx.setTransform(sx, 0, 0, sy, 0, 0)
    ctx.clearRect(0, 0, DESIGN_W, DESIGN_H)

    if (coverP > 0.01) {
      // 鼠标凸起（GSAP 平滑跟手）
      const bumpActive = bumpActiveRef.current && coverP > 0.05
      const bx = bumpActive ? bumpRef.current.x : -1e5
      const by = bumpActive ? bumpRef.current.y : -1e5
      const R = 150
      const R2 = R * R
      const push = coverP * 34

      const flowTierStart = LOAD_SEC
      // 色块呼吸/漂移（GSAP 驱动）
      const f = flowRef.current
      ctx.save()
      ctx.translate(DESIGN_W / 2 + f.x, DESIGN_H / 2 + f.y)
      ctx.scale(f.scale, f.scale)
      ctx.translate(-DESIGN_W / 2, -DESIGN_H / 2)
      if (!blocksReady.current) {
        // 浮现期：逐层贴预渲染离屏图（零笔触重建）
        for (let tier = 0; tier < 10; tier++) {
          const tierOpacity =
            coverP * smooth(clamp01((t - flowTierStart - tier * 0.08) / 0.3))
          if (tierOpacity <= 0.01) continue
          ctx.globalAlpha = tierOpacity
          ctx.drawImage(tierOffs[tier], 0, 0, DESIGN_W, DESIGN_H)
        }
        ctx.globalAlpha = 1
        // 铺满后一次性缓存离屏图
        if (!blocksReady.current && coverP >= 0.98 && t >= EMERGE_DONE_AT) {
          renderBlocksOffscreen()
        }
      } else if (bumpActive) {
        // 稳态 + 凸起：液态波浪底图 → 擦除凸起区 → 局部重绘位移笔触
        const W0 = DESIGN_W
        const H0 = DESIGN_H
        const band = 18
        const wave = flowWaveRef.current
        for (let y = 0; y < H0; y += band) {
          const off = Math.sin(y * 0.018 + wave) * 9
          ctx.drawImage(blocksOff, 0, y, W0, band, off, y, W0, band)
        }
        const localOff = Math.sin(by * 0.018 + wave) * 9
        const ex = bx + localOff
        ctx.globalCompositeOperation = 'destination-out'
        const er = ctx.createRadialGradient(ex, by, 6, ex, by, R * 1.25)
        er.addColorStop(0, 'rgba(0,0,0,0.95)')
        er.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = er
        ctx.beginPath()
        ctx.arc(ex, by, R * 1.25, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
        ctx.save()
        ctx.beginPath()
        ctx.arc(ex, by, R * 1.18, 0, Math.PI * 2)
        ctx.clip()
        ctx.translate(localOff, 0)
        ctx.lineCap = 'butt'
        const overlay = new Map<number, Path2D>()
        for (const st of strokes) {
          const mx = (st.x1 + st.x2) / 2
          const my = (st.y1 + st.y2) / 2
          const dx = mx - ex
          const dy = my - by
          const d2 = dx * dx + dy * dy
          if (d2 >= R2) continue
          const f = 1 - d2 / R2
          const pp = f * f * push
          const d = Math.sqrt(d2) || 1
          const ox = (dx / d) * pp
          const oy = (dy / d) * pp
          const key = st.colorIdx * 3 + st.shade
          let p = overlay.get(key)
          if (!p) {
            p = new Path2D()
            overlay.set(key, p)
          }
          p.moveTo(st.x1 + ox, st.y1 + oy)
          p.lineTo(st.x2 + ox, st.y2 + oy)
        }
        for (const [key, p] of overlay) {
          const b = bucketStyles.get(key)
          if (!b) continue
          ctx.globalAlpha = 1
          ctx.strokeStyle = b.color
          ctx.lineWidth = b.width
          ctx.stroke(p)
        }
        ctx.restore()
        ctx.globalAlpha = 1
      } else {
        // 稳态：液态流动——条带波浪位移（成本低，流动感真实）
        const W0 = DESIGN_W
        const H0 = DESIGN_H
        const band = 18
        const wave = flowWaveRef.current
        for (let y = 0; y < H0; y += band) {
          const off = Math.sin(y * 0.018 + wave) * 9
          ctx.drawImage(blocksOff, 0, y, W0, band, off, y, W0, band)
        }
      }
      ctx.restore()
      ctx.setTransform(sx, 0, 0, sy, 0, 0)
    }

    // 光晕呼吸：只在色块铺满后淡入（加载阶段不干扰菱形）
    const breathe = 0.68 + 0.32 * Math.sin(t * 2.4)
    const glowIn = smooth(clamp01((coverP - 0.18) / 0.5))
    const glowAlpha = breathe * glowIn * (0.35 + 0.65 * coverP)
    if (glowAlpha > 0.01) {
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = glowAlpha
      ctx.drawImage(glowCanvas, 0, 0, DESIGN_W, DESIGN_H)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }
  }

  const submit = () => {
    setErr('')
    if (!name.trim() || !pw) {
      setErr(t('login.errRequired'))
      return
    }
    if (mode === 'login') {
      if (!login(name, pw)) {
        setErr(t('login.errBad'))
        return
      }
    } else {
      if (!register(name, pw)) {
        setErr(t('login.errExists'))
        return
      }
      setRemember(name, remember)
    }
    setRemember(name, remember)
    setCurrentUser(name.trim())
    finish()
  }

  const quickLogin = (u: string) => {
    setCurrentUser(u)
    finish()
  }

  return (
    <div className={`splash${stage === 'idle' ? '' : ' is-hidden'}`}>
      <div className="splash-bg" />
      <div className="splash-breath" />
      <div className="splash-diamond" id="splash-diamond" style={{ clipPath: shimmerClip }}>
        <img src={diamondUrl} alt="FinTerminal" draggable={false} />
        <canvas ref={ringRef} />
      </div>
      <div className="splash-brand">
        <h1>Finterminal</h1>
      </div>
      <div className="splash-hint">{t('login.pressAnyKey')}</div>
      <canvas ref={blocksRef} className="splash-blocks" />

      <div className={`splash-login${stage === 'login' ? ' show' : ''}`}>
        <div className="card" ref={cardRef}>
          <img className="logo" src={diamondUrl} alt="FinTerminal" draggable={false} />
          <div className="title">FinTerminal</div>
          <div className="sub">{t('login.subtitle')}</div>
          <div className="field">
            <label>{t('login.username')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('login.usernamePlaceholder')}
            />
          </div>
          <div className="field">
            <label>{t('login.password')}</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={t('login.passwordPlaceholder')}
            />
          </div>
          <div className="err">{err}</div>
          <button className="btn" onClick={submit}>
            {mode === 'login' ? t('login.login') : t('login.register')}
          </button>
          {users.length > 0 && (
            <div className="chips">
              {users.map((u) => (
                <button key={u} className="chip" onClick={() => quickLogin(u)}>
                  {u}
                </button>
              ))}
            </div>
          )}
          <div className="foot">
            <span
              className="remember"
              onClick={() => setRememberState(!remember)}
            >
              <span className={`box${remember ? ' on' : ''}`}>
                {remember && <Check className="h-3 w-3" strokeWidth={3} style={{ color: '#0A0E14' }} />}
              </span>
              {t('login.remember')}
            </span>
            <span className="links">
              <span
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login')
                  setErr('')
                }}
              >
                {mode === 'login' ? t('login.registerNew2') : t('login.backToLogin')}
              </span>
              <span
                onClick={() => setErr(t('login.forgotHint'))}
              >
                {t('login.forgot')}
              </span>
            </span>
          </div>
          <div className="hair" />
          <div className="ver">FinTerminal v0.1.0</div>
        </div>
      </div>
    </div>
  )
}
