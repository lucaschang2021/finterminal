/// <reference types="vite/client" />

interface FinterminalBridge {
  getBackendInfo: () => Promise<{ port: number; apiBase: string; token: string | null }>
  platform: string
  homeDir: string
  versions: { electron: string; chrome: string; node: string }
}

interface Window {
  finterminal?: FinterminalBridge
}
