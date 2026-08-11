import React from 'react'
import { createRoot } from 'react-dom/client'

import { initApiBase } from './api'
import App from './App'
import './styles/globals.css'

async function bootstrap() {
  await initApiBase()
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void bootstrap()
