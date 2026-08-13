import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import {
  currentColors,
  effectiveMode,
  hexToHsl,
  isLightColor,
  loadTheme,
  saveTheme,
  type ThemeConfig,
} from './themes'

interface ThemeContextValue {
  config: ThemeConfig
  setConfig: (cfg: ThemeConfig) => void
  update: (patch: Partial<ThemeConfig>) => void
  mode: 'dark' | 'light'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ThemeConfig>(loadTheme)
  const [now, setNow] = useState(new Date())

  const mode = effectiveMode(config.mode)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    saveTheme(config)
    const colors = currentColors(config)
    const root = document.documentElement
    // 极致简约：主色统一为无彩度灰白（浅色模式用深灰保证对比度）
    const accent = mode === 'light' ? '#3C4043' : '#EDEDED'
    root.style.setProperty('--accent', accent)
    root.style.setProperty('--accent2', colors.secondary)
    root.style.setProperty('--primary', hexToHsl(accent))
    root.style.setProperty('--primary-foreground', isLightColor(accent) ? '0 0% 11%' : '0 0% 100%')
    root.style.setProperty('--ring', hexToHsl(accent))
    root.style.setProperty('--flow-speed', `${Math.max(4, config.flowSpeed)}s`)
    root.style.setProperty('--flow-strength', `${Math.max(2, Math.min(30, config.flowStrength))}%`)
    root.dataset.mode = mode
    // 深浅模式基础色
    if (mode === 'light') {
      root.style.setProperty('--bg', '#F2F4F7')
      root.style.setProperty('--bg-deep', '#E8EAED')
      root.style.setProperty('--fg', '#1A2029')
      root.style.setProperty('--muted', '#6B7280')
      root.style.setProperty('--glass-bg', 'rgba(255,255,255,0.45)')
      root.style.setProperty('--glass-border', 'rgba(15,23,42,0.12)')
      root.style.setProperty('--card-bg', 'rgba(255,255,255,0.55)')
      root.style.setProperty('--foreground', '220 15% 12%')
      root.style.setProperty('--muted-foreground', '215 12% 40%')
      root.style.setProperty('--background', '220 20% 97%')
      root.style.setProperty('--card-foreground', '220 15% 12%')
      root.style.setProperty('--popover-foreground', '220 15% 12%')
      root.style.setProperty('--secondary-foreground', '220 15% 15%')
      root.style.setProperty('--secondary', '214 20% 92%')
      root.style.setProperty('--accent-color', '0 0% 92%')
      root.style.setProperty('--accent-foreground', '220 15% 15%')
      root.style.setProperty('--muted', '#6B7280')
      root.style.setProperty('--border', '214 16% 86%')
      root.style.setProperty('--input', '214 16% 86%')
    } else {
      root.style.setProperty('--bg', '#212121')
      root.style.setProperty('--bg-deep', '#1A1A1A')
      root.style.setProperty('--fg', '#ECECF1')
      root.style.setProperty('--muted', '#9096A0')
      root.style.setProperty('--glass-bg', 'rgba(44,44,48,0.55)')
      root.style.setProperty('--glass-border', 'rgba(255,255,255,0.08)')
      root.style.setProperty('--card-bg', 'rgba(50,50,54,0.6)')
      root.style.setProperty('--foreground', '220 20% 95%')
      root.style.setProperty('--muted-foreground', '215 10% 60%')
      root.style.setProperty('--background', '216 28% 7%')
      root.style.setProperty('--card-foreground', '220 20% 95%')
      root.style.setProperty('--popover-foreground', '220 20% 95%')
      root.style.setProperty('--secondary-foreground', '220 20% 90%')
      root.style.setProperty('--secondary', '214 20% 18%')
      root.style.setProperty('--accent-color', '0 0% 20%')
      root.style.setProperty('--accent-foreground', '220 20% 95%')
      root.style.setProperty('--muted', '#9096A0')
      root.style.setProperty('--border', '214 20% 18%')
      root.style.setProperty('--input', '214 20% 18%')
    }
  }, [config, mode, now])

  // 深浅切换柔和过渡：切换瞬间加 class，让所有颜色属性平滑过渡
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('theme-switching')
    const t = window.setTimeout(() => root.classList.remove('theme-switching'), 650)
    return () => window.clearTimeout(t)
  }, [mode])

  return (
    <ThemeContext.Provider value={{
      config,
      setConfig,
      update: (patch) => setConfig((c) => ({ ...c, ...patch })),
      mode,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用')
  return ctx
}
