/**
 * 后端 API 客户端。
 * 开发模式走 vite 代理（/api → 127.0.0.1:8000）；
 * Electron 生产模式通过 preload 获取后端实际端口，用绝对地址调用。
 */

let apiBase = '/api'
let apiToken = ''

export async function initApiBase(): Promise<void> {
  if (window.finterminal?.getBackendInfo) {
    try {
      const info = await window.finterminal.getBackendInfo()
      if (info?.apiBase) apiBase = info.apiBase
      if (info?.token) apiToken = info.token
    } catch {
      // 保持默认 /api（浏览器开发模式）
    }
  }
}

export function base(): string {
  return apiBase
}

/** 附加 API Token 鉴权头（Electron 生产模式后端启用 FIN_API_TOKEN 时） */
function authHeaders(options?: RequestInit): RequestInit {
  if (!apiToken) return options ?? {}
  const headers = new Headers(options?.headers)
  headers.set('Authorization', `Bearer ${apiToken}`)
  return { ...options, headers }
}

async function request<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(apiBase + url, authHeaders(options))
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
  readApi: (code: string, fresh = true) =>
    request<ApiResult>(`/read?source=api&fresh=${fresh ? 1 : 0}&path=${encodeURIComponent(code)}`),
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
  ask: (query: string, history?: { role: string; content: string }[]) =>
    request<ApiResult>('/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, history }) }),
  settingsApiKeyStatus: () =>
    request<ApiResult<{ configured: boolean; source: string; model: string }>>('/settings/api-key/status'),
  settingsApiKeySave: (apiKey: string) =>
    request<ApiResult<{ configured: boolean }>>('/settings/api-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    }),
  settingsApiKeyDelete: () =>
    request<ApiResult<{ configured: boolean }>>('/settings/api-key', { method: 'DELETE' }),
  settingsModelStatus: () =>
    request<ApiResult<{ model: string; source: string }>>('/settings/model'),
  settingsModelSave: (model: string) =>
    request<ApiResult<{ model: string }>>('/settings/model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    }),
  knowledge: (body: Record<string, unknown>) =>
    request<ApiResult>('/knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  knowledgeQuery: (body: Record<string, unknown>) =>
    request<ApiResult>('/knowledge/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
}

/** 构造 charts/ 静态文件地址（PNG/HTML/JSON），自动附带 API Token（生产模式鉴权必需） */
export function fileUrl(name: string): string {
  const q = new URLSearchParams({ path: name })
  if (apiToken) q.set('token', apiToken)
  return `${apiBase}/file?${q.toString()}`
}

export interface StreamStatus {
  stage: 'accepted' | 'routing' | 'thinking' | 'tool' | 'tool_complete' | 'synthesizing' | 'finalizing' | string
  tool?: string
  round?: number
  elapsed: number
}

export interface StatisticalArtifact {
  analysis: string
  file_path: string
  result: string
}

export interface GeneratedArtifacts {
  charts: string[]
  statistics: StatisticalArtifact[]
}

/** SSE 对话：按 delta 追加文本，并通过回调提供阶段状态和结构化成果。 */
export async function streamAsk(
  query: string,
  onDelta: (delta: string) => void,
  timeoutMs = 45000,
  history?: { role: string; content: string }[],
  onStatus?: (status: StreamStatus) => void,
  onArtifacts?: (artifacts: GeneratedArtifacts) => void,
): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiToken) headers.Authorization = `Bearer ${apiToken}`
    const res = await fetch(`${apiBase}/ask/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, history }),
      signal: controller.signal,
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
          const obj = JSON.parse(payload) as {
            delta?: string
            done?: boolean
            status?: Omit<StreamStatus, 'elapsed'>
            artifacts?: GeneratedArtifacts
            elapsed?: number
          }
          if (obj.delta) onDelta(obj.delta)
          if (obj.status && onStatus) onStatus({ ...obj.status, elapsed: obj.elapsed ?? 0 })
          if (obj.artifacts && onArtifacts) {
            const statistics = (obj.artifacts.statistics || []).map((item) => (
              typeof item === 'string'
                ? { analysis: 'describe', file_path: '', result: item }
                : item
            ))
            onArtifacts({ charts: obj.artifacts.charts || [], statistics })
          }
          if (obj.done) return
        } catch { /* 忽略非 JSON 帧 */ }
      }
    }
    if (buf.trim()) throw new Error('流式响应意外结束，请重试')
    throw new Error('服务未返回完成信号，请重试')
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('请求超时（' + Math.round(timeoutMs / 1000) + ' 秒未完成），请检查网络或稍后重试')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}
