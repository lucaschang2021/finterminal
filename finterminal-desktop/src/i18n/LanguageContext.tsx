import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import { translate, type Lang } from './translations'

const LANG_KEY = 'finterminal_lang'

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  /** 取界面文案；支持 {var} 插值 */
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh'
    } catch {
      return 'zh'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch { /* ignore */ }
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  )

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n 必须在 LanguageProvider 内使用')
  return ctx
}
