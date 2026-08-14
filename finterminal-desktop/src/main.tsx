import React from 'react'
import { createRoot } from 'react-dom/client'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'

import { initApiBase } from './api'
import { LanguageProvider } from './i18n/LanguageContext'
import { ThemeProvider } from './theme/ThemeContext'
import Root from './Root'
import './styles/globals.css'

gsap.registerPlugin(useGSAP)

async function bootstrap() {
  await initApiBase()
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <LanguageProvider>
        <ThemeProvider>
          <Root />
        </ThemeProvider>
      </LanguageProvider>
    </React.StrictMode>,
  )
}

void bootstrap()
