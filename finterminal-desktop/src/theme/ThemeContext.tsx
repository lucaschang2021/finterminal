import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import {
  currentColors,
  effectiveMode,
  hexToHsl,
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
    root.style.setProperty('--accent', colors.primary)
    root.style.setProperty('--accent2', colors.secondary)
    root.style.setProperty('--primary', hexToHsl(colors.primary))
    root.style.setProperty('--ring', hexToHsl(colors.primary))
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
      root.style.setProperty('--glass-border', 'rgba(255,255,255,0.7)')
      root.style.setProperty('--card-bg', 'rgba(255,255,255,0.55)')
    } else {
      root.style.setProperty('--bg', '#0A0E14')
      root.style.setProperty('--bg-deep', '#070A0F')
      root.style.setProperty('--fg', '#EAEDF2')
      root.style.setProperty('--muted', '#7A8290')
      root.style.setProperty('--glass-bg', 'rgba(22,27,34,0.45)')
      root.style.setProperty('--glass-border', 'rgba(255,255,255,0.06)')
      root.style.setProperty('--card-bg', 'rgba(22,27,34,0.55)')
    }
  }, [config, mode, now])

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
