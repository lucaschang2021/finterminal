import React from 'react'
import { createRoot } from 'react-dom/client'

import { initApiBase } from './api'
import { ThemeProvider } from './theme/ThemeContext'
import Root from './Root'
import './styles/globals.css'

async function bootstrap() {
  await initApiBase()
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider>
        <Root />
      </ThemeProvider>
    </React.StrictMode>,
  )
}

void bootstrap()
