import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/LanguageContext'
import { useTheme } from '@/theme/ThemeContext'
import { PRESETS, type ThemeMode } from '@/theme/themes'
import { cn } from '@/lib/utils'

interface KeyStatus {
  configured: boolean
  source: string
  model: string
}

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n()
  const { config, update } = useTheme()

  const [model, setModel] = useState('')
  const [modelBusy, setModelBusy] = useState(false)
  const [modelMsg, setModelMsg] = useState<{ ok: boolean; text: string } | null>(null)
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

  useEffect(() => {
    api.settingsModelStatus()
      .then((r) => setModel(r.data?.model || 'deepseek-v4-flash'))
      .catch(() => setModel('deepseek-v4-flash'))
  }, [])

  const saveKey = () => {
    const k = apiKey.trim()
    if (!k) {
      setKeyMsg({ ok: false, text: t('settings.needKey') })
      return
    }
    setKeyBusy('save')
    setKeyMsg(null)
    api.settingsApiKeySave(k)
      .then((r) => {
        setKeyMsg({ ok: true, text: r.text || t('settings.keySaved') })
        setApiKey('')
        setShowKey(false)
        refreshKeyStatus()
      })
      .catch((e) => setKeyMsg({ ok: false, text: (e as Error).message }))
      .finally(() => setKeyBusy(null))
  }

  const clearKey = () => {
    if (!window.confirm(t('settings.confirmClear'))) return
    setKeyBusy('clear')
    setKeyMsg(null)
    api.settingsApiKeyDelete()
      .then((r) => {
        setKeyMsg({ ok: true, text: r.text || t('settings.keyCleared') })
        refreshKeyStatus()
      })
      .catch((e) => setKeyMsg({ ok: false, text: (e as Error).message }))
      .finally(() => setKeyBusy(null))
  }


  const saveModel = () => {
    const name = model.trim()
    if (!name) {
      setModelMsg({ ok: false, text: '模型名不能为空' })
      return
    }
    setModelBusy(true)
    setModelMsg(null)
    api.settingsModelSave(name)
      .then((r) => setModelMsg({ ok: true, text: r.text || '已保存' }))
      .catch((e) => setModelMsg({ ok: false, text: (e as Error).message }))
      .finally(() => setModelBusy(false))
  }
  const modes: { key: ThemeMode; labelKey: string }[] = [
    { key: 'dark', labelKey: 'settings.dark' },
    { key: 'light', labelKey: 'settings.light' },
    { key: 'auto', labelKey: 'settings.auto' },
  ]

  return (
    <div className="p-5">
      <h2 className="page-title">{t('settings.title')}</h2>
      <p className="page-sub mb-4">{t('settings.subtitle')}</p>

      {/* 语言 / Language */}
      <div className="liquid-glass d2-cut mb-4 p-4">
        <div className="mb-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('settings.language')}</div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={lang === 'zh' ? 'default' : 'secondary'}
            onClick={() => setLang('zh')}
          >
            {t('settings.langZh')}
          </Button>
          <Button
            size="sm"
            variant={lang === 'en' ? 'default' : 'secondary'}
            onClick={() => setLang('en')}
          >
            {t('settings.langEn')}
          </Button>
        </div>
      </div>

      {/* 外观主题 */}
      <div className="liquid-glass d2-cut mb-4 p-4">
        <div className="mb-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('settings.themePresets')}</div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {PRESETS.map((p, i) => (
            <button
              key={p.nameKey}
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
              <span className="text-[11px]">{t(p.nameKey)}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1 text-xs" style={{ color: 'var(--muted)' }}>{t('settings.customPrimary')}</div>
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
            <div className="mb-1 text-xs" style={{ color: 'var(--muted)' }}>{t('settings.customSecondary')}</div>
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
              <span style={{ color: 'var(--muted)' }}>{t('settings.flowSpeed')}</span>
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
              <span style={{ color: 'var(--muted)' }}>{t('settings.flowStrength')}</span>
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
        <div className="mb-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('settings.displayMode')}</div>
        <div className="flex gap-2">
          {modes.map((m) => (
            <Button
              key={m.key}
              size="sm"
              variant={config.mode === m.key ? 'default' : 'secondary'}
              onClick={() => update({ mode: m.key })}
            >
              {t(m.labelKey)}
            </Button>
          ))}
        </div>
      </div>

      {/* 模型配置 */}
      <div className="liquid-glass d2-cut p-4">
        <div className="mb-3 text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('settings.modelConfig')}</div>

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
                  {t('settings.configured', { source: keyStatus.source })}
                </span>
              ) : (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{ background: 'rgba(128,128,128,0.14)', color: 'var(--muted)' }}
                >
                  {t('settings.notConfigured')}
                </span>
              )
            ) : (
              <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{t('settings.reading')}</span>
            )}
            {keyStatus && !keyStatus.configured && (
              <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{t('settings.keyHint')}</span>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setKeyMsg(null) }}
                placeholder={t('settings.keyPlaceholder')}
                autoComplete="off"
                className="glass-input h-9 w-full rounded-md px-3 pr-9 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-[var(--muted)] hover:text-[var(--fg)]"
                title={showKey ? t('settings.hide') : t('settings.show')}
              >
                {showKey ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
              </button>
            </div>
            <Button size="sm" onClick={saveKey} disabled={keyBusy !== null || !apiKey.trim()}>
              {keyBusy === 'save' ? t('common.saving') : t('common.save')}
            </Button>
            <Button size="sm" variant="secondary" onClick={clearKey} disabled={keyBusy !== null || !keyStatus?.configured}>
              {keyBusy === 'clear' ? t('common.clearing') : t('common.clear')}
            </Button>
          </div>

          {keyMsg && (
            <p className="mt-2 text-[11px]" style={{ color: keyMsg.ok ? 'var(--ok)' : 'var(--bad)' }}>{keyMsg.text}</p>
          )}

          <div className="mt-2 space-y-0.5 text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            <div>{t('settings.keyNote1')}</div>
            <div>{t('settings.keyNote2')}</div>
            <div>{t('settings.keyNote3')}</div>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            className="glass-input h-9 flex-1 rounded-md px-3 text-sm outline-none"
            value={model}
            onChange={(e) => { setModel(e.target.value); setModelMsg(null) }}
            placeholder={t('settings.modelName')}
          />
          <Button size="sm" onClick={saveModel} disabled={modelBusy || !model.trim()}>
            {modelBusy ? t('common.saving') : t('common.save')}
          </Button>
        </div>
        {modelMsg && (
          <p className="mt-2 text-[11px]" style={{ color: modelMsg.ok ? 'var(--ok)' : 'var(--bad)' }}>{modelMsg.text}</p>
        )}
      </div>
    </div>
  )
}
