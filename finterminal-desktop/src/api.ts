/**
 * 后端 API 客户端。
 * 开发模式走 vite 代理（/api → 127.0.0.1:8000）；
 * Electron 生产模式通过 preload 获取后端实际端口，用绝对地址调用。
 */

let apiBase = '/api'

export async function initApiBase(): Promise<void> {
  if (window.finterminal?.getBackendInfo) {
    try {
      const info = await window.finterminal.getBackendInfo()
      if (info?.apiBase) apiBase = info.apiBase
    } catch {
      // 保持默认 /api（浏览器开发模式）
    }
  }
}

export function base(): string {
  return apiBase
}

async function request<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(apiBase + url, options)
  const body = await res.json().catch(() => ({ ok: false, error: '响应解析失败' }))
  if (!res.ok || (body as { ok?: boolean }).ok === false) {
    throw new Error((body as { error?: string }).error || `请求失败 (${res.status})`)
  }
  return body as T
}

interface ApiResult<T = unknown> {
  ok: boolean
  data?: T
  text?: string
  error?: string
}

export const api = {
  health: () => request<ApiResult<{ service: string; tools: number; charts: string[] }>>('/health'),
  files: (path: string) => request<ApiResult>(`/files?path=${encodeURIComponent(path)}`),
  search: (keyword: string, directory: string, recursive = false) =>
    request<ApiResult>(`/search?keyword=${encodeURIComponent(keyword)}&directory=${encodeURIComponent(directory)}&recursive=${recursive}`),
  detect: (path: string) => request<ApiResult>(`/detect?path=${encodeURIComponent(path)}`),
  read: (path: string) => request<ApiResult>(`/read?path=${encodeURIComponent(path)}`),
  readApi: (code: string) => request<ApiResult>(`/read?source=api&path=${encodeURIComponent(code)}`),
  columns: (path: string) =>
    request<ApiResult<{ columns: string[]; numeric: string[] }>>(`/columns?path=${encodeURIComponent(path)}`),
  plotData: (params: Record<string, string>) =>
    request<ApiResult<{ chart_type: string; option: Record<string, unknown> }>>(`/plot/data?${new URLSearchParams(params)}`),
  plotSave: (params: Record<string, string>) =>
    request<ApiResult>(`/plot/save?${new URLSearchParams(params)}`),
  clean: (body: Record<string, unknown>) =>
    request<ApiResult>('/clean', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  analyze: (body: Record<string, unknown>) =>
    request<ApiResult>('/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  chain: (params: Record<string, string | number | boolean | undefined>) => {
    const q = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
    return request<ApiResult>(`/chain?${q}`)
  },
  ask: (query: string) =>
    request<ApiResult>('/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) }),
  knowledge: (body: Record<string, unknown>) =>
    request<ApiResult>('/knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  knowledgeQuery: (body: Record<string, unknown>) =>
    request<ApiResult>('/knowledge/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
}

/** 构造 charts/ 静态文件地址（PNG/HTML） */
export function fileUrl(name: string): string {
  return `${apiBase}/file?path=${encodeURIComponent(name)}`
}

/** SSE 流式对话：POST /ask/stream，按 delta 回调追加文本 */
export async function streamAsk(query: string, onDelta: (delta: string) => void): Promise<void> {
  const res = await fetch(`${apiBase}/ask/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok || !res.body) throw new Error(`流式请求失败 (${res.status})`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const frames = buf.split('\n\n')
    buf = frames.pop() ?? ''
    for (const frame of frames) {
      if (!frame.startsWith('data: ')) continue
      const payload = frame.slice(6).trim()
      if (payload === '[DONE]') return
      try {
        const obj = JSON.parse(payload) as { delta?: string; done?: boolean }
        if (obj.done) return
        if (obj.delta) onDelta(obj.delta)
      } catch { /* 忽略非 JSON 帧 */ }
    }
  }
}
