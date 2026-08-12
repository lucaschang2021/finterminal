import diamondUrl from '@/assets/diamond.svg'

interface LogoProps {
  size?: number
  className?: string
  /** 黑白模式：融入深色界面 */
  mono?: boolean
}

/** 品牌标识：透明底双菱形矢量（可选黑白模式融入深色界面） */
export default function Logo({ size = 64, className, mono }: LogoProps) {
  return (
    <img
      src={diamondUrl}
      alt="FinTerminal"
      width={size}
      height={size}
      className={className}
      style={{
        objectFit: 'contain',
        borderRadius: mono ? undefined : Math.round(size * 0.18),
        display: 'block',
        filter: mono ? 'grayscale(1) brightness(1.7) contrast(1.05)' : undefined,
      }}
      draggable={false}
    />
  )
}
