import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/theme/ThemeContext'
import { PRESETS, type ThemeMode } from '@/theme/themes'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const { config, update } = useTheme()
  const [model, setModel] = useState(localStorage.getItem('finterminal_model') || 'deepseek-v4-flash')
  const [modelSaved, setModelSaved] = useState(false)

  const modes: { key: ThemeMode; label: string }[] = [
    { key: 'dark', label: '深色' },
    { key: 'light', label: '浅色' },
    { key: 'auto', label: '按时间自动' },
  ]

  return (
    <div className="p-5">
      <h2 className="mb-1 text-lg font-semibold">设置</h2>
      <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>外观主题 · 模型配置 · 偏好</p>

      {/* 外观主题 */}
      <div className="liquid-glass mb-4 rounded-xl p-4" style={{ borderRadius: 14 }}>
        <div className="mb-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>主题预设</div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {PRESETS.map((p, i) => (
            <button
              key={p.name}
              onClick={() => update({ presetIndex: i })}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl p-3 transition-all',
                config.presetIndex === i ? 'ring-2' : 'hover:bg-white/5',
              )}
              style={{ ['--tw-ring-color' as string]: p.primary }}
            >
              <span
                className="h-8 w-8 rounded-full"
                style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }}
              />
              <span className="text-[11px]">{p.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1 text-xs" style={{ color: 'var(--muted)' }}>自定义主色</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.customPrimary}
                onChange={(e) => { update({ customPrimary: e.target.value, presetIndex: PRESETS.length - 1 }) }}
                className="h-8 w-14 cursor-pointer rounded border-0 bg-transparent"
              />
              <span className="mono text-[11px]" style={{ color: 'var(--muted)' }}>{config.customPrimary}</span>
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs" style={{ color: 'var(--muted)' }}>自定义辅色</div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.customSecondary}
                onChange={(e) => { update({ customSecondary: e.target.value, presetIndex: PRESETS.length - 1 }) }}
                className="h-8 w-14 cursor-pointer rounded border-0 bg-transparent"
              />
              <span className="mono text-[11px]" style={{ color: 'var(--muted)' }}>{config.customSecondary}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-6">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span style={{ color: 'var(--muted)' }}>流动速度</span>
              <span className="mono">{config.flowSpeed}s</span>
            </div>
            <input
              type="range" min={6} max={30} value={config.flowSpeed}
              onChange={(e) => update({ flowSpeed: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span style={{ color: 'var(--muted)' }}>流动强度</span>
              <span className="mono">{config.flowStrength}%</span>
            </div>
            <input
              type="range" min={2} max={25} value={config.flowStrength}
              onChange={(e) => update({ flowStrength: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </div>
        </div>
      </div>

      {/* 深浅模式 */}
      <div className="liquid-glass mb-4 rounded-xl p-4" style={{ borderRadius: 14 }}>
        <div className="mb-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>显示模式</div>
        <div className="flex gap-2">
          {modes.map((m) => (
            <Button
              key={m.key}
              size="sm"
              variant={config.mode === m.key ? 'default' : 'secondary'}
              onClick={() => update({ mode: m.key })}
            >
              {m.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 模型配置 */}
      <div className="liquid-glass rounded-xl p-4" style={{ borderRadius: 14 }}>
        <div className="mb-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>模型配置</div>
        <div className="flex gap-2">
          <input
            className="glass-input h-9 flex-1 rounded-md px-3 text-sm outline-none"
            value={model}
            onChange={(e) => { setModel(e.target.value); setModelSaved(false) }}
            placeholder="DeepSeek 模型名"
          />
          <Button size="sm" onClick={() => { localStorage.setItem('finterminal_model', model); setModelSaved(true) }}>
            保存
          </Button>
        </div>
        {modelSaved && <p className="mt-2 text-[11px] text-emerald-400">已保存，重启应用后生效</p>}
        <p className="mt-2 text-[11px]" style={{ color: 'var(--muted)' }}>
          API Key 通过环境变量 DEEPSEEK_API_KEY 或 Windows 凭据管理器配置
        </p>
      </div>
    </div>
  )
}
