import { useState } from 'react'

import {
  login,
  register,
  rememberedUsers,
  setCurrentUser,
  setRemember,
} from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/LanguageContext'
import Logo from './Logo'

export default function LoginPage({ onSuccess }: { onSuccess: (name: string) => void }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [remember, setRememberState] = useState(true)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [err, setErr] = useState('')
  const [users, setUsers] = useState(rememberedUsers())

  const submit = () => {
    setErr('')
    if (!name.trim() || !pw) {
      setErr(t('login.errRequired'))
      return
    }
    if (mode === 'login') {
      if (!login(name, pw)) {
        setErr(t('login.errBad'))
        return
      }
    } else {
      if (!register(name, pw)) {
        setErr(t('login.errExists'))
        return
      }
      setRemember(name, remember)
    }
    setRemember(name, remember)
    setCurrentUser(name.trim())
    onSuccess(name.trim())
  }

  const quickLogin = (u: string) => {
    setCurrentUser(u)
    onSuccess(u)
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-[#0A0E14]">
      {/* 蓝色暗流背景 */}
      <div className="flow-current" style={{ '--flow-strength': '14%' } as React.CSSProperties} />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 45% at 50% 8%, rgba(91,155,255,0.12) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 85% 90%, rgba(201,168,76,0.06) 0%, transparent 55%)',
        }}
      />

      {/* 磨砂玻璃登录卡 */}
      <div
        className="relative z-10 w-[380px] rounded-2xl p-8"
        style={{
          background: 'rgba(22,27,34,0.50)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
        }}
      >
        <div className="mb-6 flex flex-col items-center">
          <Logo size={64} />
          <h1 className="mt-3 text-xl font-semibold tracking-wide">FinTerminal</h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{t('login.subtitle')}</p>
        </div>

        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('login.username')}
            className="glass-input h-10 border-0 text-sm"
          />
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={t('login.password')}
            className="glass-input h-10 border-0 text-sm"
          />
        </div>

        {err && <p className="mt-3 text-xs text-destructive">{err}</p>}

        <Button onClick={submit} className="glow-btn mt-4 h-10 w-full text-sm">
          {mode === 'login' ? t('login.login') : t('login.register')}
        </Button>

        <label className="mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
          <Checkbox checked={remember} onCheckedChange={(v) => setRememberState(!!v)} />
          {t('login.rememberSub')}
        </label>

        <div className="mt-3 flex items-center justify-between text-xs">
          <button
            className="hover:underline"
            style={{ color: 'var(--muted)' }}
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr('') }}
          >
            {mode === 'login' ? t('login.registerNew') : t('login.backToLogin')}
          </button>
          <button className="hover:underline" style={{ color: 'var(--muted)' }} onClick={() => setErr(t('login.forgotHint'))}>
            {t('login.forgot')}
          </button>
        </div>

        {users.length > 0 && (
          <div className="mt-5 border-t pt-4" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <p className="mb-2 text-[11px]" style={{ color: 'var(--muted)' }}>{t('login.switchUser')}</p>
            <div className="flex flex-wrap gap-2">
              {users.map((u) => (
                <button
                  key={u}
                  onClick={() => quickLogin(u)}
                  className="rounded-full px-3 py-1 text-[11px] transition-colors hover:text-[var(--accent)]"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
