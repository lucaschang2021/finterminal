const BASE = '/api'

async function request(url, options) {
  const res = await fetch(BASE + url, options)
  const body = await res.json().catch(() => ({ ok: false, error: '响应解析失败' }))
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `请求失败 (${res.status})`)
  }
  return body
}

export const api = {
  health: () => request('/health'),
  files: (path) => request(`/files?path=${encodeURIComponent(path)}`),
  search: (keyword, directory, recursive = false) =>
    request(`/search?keyword=${encodeURIComponent(keyword || '')}&directory=${encodeURIComponent(directory || '')}&recursive=${recursive}`),
  detect: (path) => request(`/detect?path=${encodeURIComponent(path)}`),
  read: (path) => request(`/read?path=${encodeURIComponent(path)}`),
  columns: (path) => request(`/columns?path=${encodeURIComponent(path)}`),
  plotData: (params) => request(`/plot/data?${new URLSearchParams(params)}`),
  plotSave: (params) => request(`/plot/save?${new URLSearchParams(params)}`),
  clean: (body) => request('/clean', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  analyze: (body) => request('/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  chain: (params) => request(`/chain?${new URLSearchParams(params)}`),
  ask: (query) => request('/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) }),
  knowledge: (body) => request('/knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  knowledgeQuery: (body) => request('/knowledge/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  charts: () => request('/charts'),
}
