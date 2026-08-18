/// <reference types="vite/client" />

interface FinterminalBridge {
  getBackendInfo: () => Promise<{ port: number; apiBase: string; token: string | null }>
  saveChart: (fileName: string) => Promise<{ ok: boolean; path?: string; canceled?: boolean; error?: string }>
  platform: string
  homeDir: string
  versions: { electron: string; chrome: string; node: string }
}

interface Window {
  finterminal?: FinterminalBridge
}
