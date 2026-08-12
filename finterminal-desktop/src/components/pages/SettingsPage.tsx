import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/theme/ThemeContext'
import { PRESETS, type ThemeMode } from '@/theme/themes'
import { cn } from '@/lib/utils'

interface KeyStatus {
  configured: boolean
  source: string
  model: string
}

export default function SettingsPage() {
  const { config, update } = useTheme()
  const [model, setModel] = useState(localStorage.getItem('finterminal_model') || 'deepseek-v4-flash')
  const [modelSaved, setModelSaved] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null)
  const [keyBusy, setKeyBusy] = useState<'save' | 'clear' | null>(null)
  const [keyMsg, setKeyMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const refreshKeyStatus = () => {
    api.settingsApiKeyStatus().then((r) => setKeyStatus(r.data ?? null)).catch(() => setKeyStatus(null))
  }

  useEffect(() => {
    refreshKeyStatus()
  }, [])

  const saveKey = () => {
    const k = apiKey.trim()
    if (!k) {
      setKeyMsg({ ok: false, text: '请输入 API Key' })
      return
    }
    setKeyBusy('save')
    setKeyMsg(null)
    api.settingsApiKeySave(k)
      .then((r) => {
        setKeyMsg({ ok: true, text: r.text || '已保存' })
        setApiKey('')
        setShowKey(false)
        refreshKeyStatus()
      })
      .catch((e) => setKeyMsg({ ok: false, text: (e as Error).message }))
      .finally(() => setKeyBusy(null))
  }

  const clearKey = () => {
    if (!window.confirm('确定清除已保存的 API Key？')) return
    setKeyBusy('clear')
    setKeyMsg(null)
    api.settingsApiKeyDelete()
      .then((r) => {
        setKeyMsg({ ok: true, text: r.text || 'API Key 已清除' })
        refreshKeyStatus()
      })
      .catch((e) => setKeyMsg({ ok: false, text: (e as Error).message }))
      .finally(() => setKeyBusy(null))
  }

  const modes: { key: ThemeMode; label: string }[] = [
    { key: 'dark', label: '深色' },
    { key: 'light', label: '浅色' },
    { key: 'auto', label: '按时间自动' },
  ]

  return (
    <div className="p-5">
      <h2 className="page-title">设置</h2>
      <p className="page-sub mb-4">外观主题 · 模型配置 · 偏好</p>

      {/* 外观主题 */}
      <div className="liquid-glass d2-cut mb-4 p-4">
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
      <div className="liquid-glass d2-cut mb-4 p-4">
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
      <div className="liquid-glass d2-cut p-4">
        <div className="mb-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>模型配置</div>

        {/* API Key */}
        <div className="mb-4 rounded-lg border p-3" style={{ borderColor: 'var(--hairline)', background: 'rgba(255,255,255,0.025)' }}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--fg)' }}>API Key</span>
            {keyStatus ? (
              keyStatus.configured ? (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{ background: 'color-mix(in srgb, var(--ok) 15%, transparent)', color: 'var(--ok)' }}
                >
                  已配置（来源: {keyStatus.source}）
                </span>
              ) : (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{ background: 'rgba(128,128,128,0.14)', color: 'var(--muted)' }}
                >
                  未配置
                </span>
              )
            ) : (
              <span className="text-[11px]" style={{ color: 'var(--muted)' }}>读取中…</span>
            )}
            {keyStatus && !keyStatus.configured && (
              <span className="text-[11px]" style={{ color: 'var(--muted)' }}>配置后可使用 AI 对话 / 研报功能</span>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setKeyMsg(null) }}
                placeholder="sk-请输入你的 DeepSeek API Key"
                autoComplete="off"
                className="glass-input h-9 w-full rounded-md px-3 pr-9 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-[var(--muted)] hover:text-[var(--fg)]"
                title={showKey ? '隐藏' : '显示'}
              >
                {showKey ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
              </button>
            </div>
            <Button size="sm" onClick={saveKey} disabled={keyBusy !== null || !apiKey.trim()}>
              {keyBusy === 'save' ? '保存中…' : '保存'}
            </Button>
            <Button size="sm" variant="secondary" onClick={clearKey} disabled={keyBusy !== null || !keyStatus?.configured}>
              {keyBusy === 'clear' ? '清除中…' : '清除'}
            </Button>
          </div>

          {keyMsg && (
            <p className="mt-2 text-[11px]" style={{ color: keyMsg.ok ? 'var(--ok)' : 'var(--bad)' }}>{keyMsg.text}</p>
          )}

          <div className="mt-2 space-y-0.5 text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            <div>· Key 优先存储于 Windows 凭据管理器，仅保存在本机</div>
            <div>· 若已设置环境变量 DEEPSEEK_API_KEY，将以环境变量为准（优先级最高）</div>
            <div>· 未配置 Key 时，本地功能（文件 / 图表 / 分析 / 数据链 / 知识库）不受影响</div>
          </div>
        </div>

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
      </div>
    </div>
  )
}
