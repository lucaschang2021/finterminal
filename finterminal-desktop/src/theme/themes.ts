/** 主题预设与配置类型 */

export interface ThemePreset {
  nameKey: string
  primary: string
  secondary: string
}

export const PRESETS: ThemePreset[] = [
  { nameKey: 'presets.minimal', primary: '#EDEDED', secondary: '#A9B0BA' },
  { nameKey: 'presets.moon', primary: '#D5DAE1', secondary: '#98A0AC' },
  { nameKey: 'presets.graphite', primary: '#B9C0CA', secondary: '#8A93A0' },
  { nameKey: 'presets.ash', primary: '#A3ABB8', secondary: '#79828F' },
  { nameKey: 'presets.ink', primary: '#8C95A3', secondary: '#646C78' },
  { nameKey: 'presets.custom', primary: '#EDEDED', secondary: '#A9B0BA' },
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
  customPrimary: '#EDEDED',
  customSecondary: '#A9B0BA',
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

/** 判断颜色是否偏亮（决定前景文字用深色还是白色） */
export function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length < 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 150
}
