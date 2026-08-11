import { useId } from 'react'

interface LogoProps {
  size?: number
  className?: string
  ringOpacity?: number
}

/** 品牌标识：圆滑双菱形嵌套，外菱形细边框，内菱形镂空，环形五色渐变 */
export default function Logo({ size = 64, className, ringOpacity = 0.9 }: LogoProps) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-label="FinTerminal">
      <defs>
        <linearGradient id={`ring-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5B9BFF" />
          <stop offset="25%" stopColor="#C9A84C" />
          <stop offset="50%" stopColor="#3FB950" />
          <stop offset="75%" stopColor="#E68A4A" />
          <stop offset="100%" stopColor="#8957E5" />
        </linearGradient>
        <linearGradient id={`ring-dim-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5B9BFF" stopOpacity="0.35" />
          <stop offset="25%" stopColor="#C9A84C" stopOpacity="0.35" />
          <stop offset="50%" stopColor="#3FB950" stopOpacity="0.35" />
          <stop offset="75%" stopColor="#E68A4A" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8957E5" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {/* 环形区域：外菱形填充，内菱形 evenodd 镂空 */}
      <path
        d="M50 2 L98 50 L50 98 L2 50 Z M50 24 L76 50 L50 76 L24 50 Z"
        fill={`url(#ring-${id})`}
        fillRule="evenodd"
        opacity={ringOpacity}
      />
      {/* 外菱形细边框 */}
      <path
        d="M50 2 L98 50 L50 98 L2 50 Z"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M50 2 L98 50 L50 98 L2 50 Z"
        fill="none"
        stroke={`url(#ring-dim-${id})`}
        strokeWidth="4"
        strokeLinejoin="round"
        opacity="0.6"
      />
    </svg>
  )
}
