/// <reference types="vite/client" />

interface FinterminalBridge {
  getBackendInfo: () => Promise<{ port: number; apiBase: string }>
  platform: string
  versions: { electron: string; chrome: string; node: string }
}

interface Window {
  finterminal?: FinterminalBridge
}
