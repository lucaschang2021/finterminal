import logoUrl from '@/assets/logo.jpg'

interface LogoProps {
  size?: number
  className?: string
}

/** 品牌标识：直接使用设计稿提供的双菱形图标文件 */
export default function Logo({ size = 64, className }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt="FinTerminal"
      width={size}
      height={size}
      className={className}
      style={{
        objectFit: 'contain',
        borderRadius: Math.round(size * 0.18),
        display: 'block',
      }}
      draggable={false}
    />
  )
}
