/** 主题预设与配置类型 */

export interface ThemePreset {
  name: string
  primary: string
  secondary: string
}

export const PRESETS: ThemePreset[] = [
  { name: '深海', primary: '#5B9BFF', secondary: '#1F6FEB' },
  { name: '烈焰', primary: '#E05A5A', secondary: '#E68A4A' },
  { name: '熔金', primary: '#C9A84C', secondary: '#E68A4A' },
  { name: '极光', primary: '#3FB950', secondary: '#5B9BFF' },
  { name: '暗紫', primary: '#8957E5', secondary: '#5B9BFF' },
  { name: '自定义', primary: '#5B9BFF', secondary: '#C9A84C' },
]

export type ThemeMode = 'dark' | 'light' | 'auto'

export interface ThemeConfig {
  presetIndex: number
  customPrimary: string
  customSecondary: string
  flowSpeed: number   // 秒
  flowStrength: number // 0-100
  mode: ThemeMode
}

export const DEFAULT_THEME: ThemeConfig = {
  presetIndex: 0,
  customPrimary: '#5B9BFF',
  customSecondary: '#C9A84C',
  flowSpeed: 16,
  flowStrength: 8,
  mode: 'dark',
}

export const FLOW_COLORS = ['#5B9BFF', '#C9A84C', '#3FB950', '#E68A4A', '#8957E5']

/** 十六进制颜色 → "H S% L%" 三元组（tailwind hsl(var(--x)) 用） */
export function hexToHsl(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let s = 0
  let hue = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60
    else if (max === g) hue = ((b - r) / d + 2) * 60
    else hue = ((r - g) / d + 4) * 60
  }
  return `${Math.round(hue)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export function loadTheme(): ThemeConfig {
  try {
    const raw = localStorage.getItem('finterminal_theme')
    if (raw) return { ...DEFAULT_THEME, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return DEFAULT_THEME
}

export function saveTheme(cfg: ThemeConfig) {
  try {
    localStorage.setItem('finterminal_theme', JSON.stringify(cfg))
  } catch { /* ignore */ }
}

/** 根据模式与当前时间决定实际深浅 */
export function effectiveMode(mode: ThemeMode): 'dark' | 'light' {
  if (mode !== 'auto') return mode
  const h = new Date().getHours()
  return h >= 7 && h < 19 ? 'light' : 'dark'
}

export function currentColors(cfg: ThemeConfig) {
  const preset = PRESETS[cfg.presetIndex] ?? PRESETS[0]
  const isCustom = cfg.presetIndex === PRESETS.length - 1
  return {
    primary: isCustom ? cfg.customPrimary : preset.primary,
    secondary: isCustom ? cfg.customSecondary : preset.secondary,
  }
}
