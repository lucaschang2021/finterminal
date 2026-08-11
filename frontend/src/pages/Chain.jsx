import { useState } from 'react'
import { api } from '../api'

const ACTIONS = [
  { key: 'status', label: '状态' },
  { key: 'snapshot', label: '快照' },
  { key: 'verify', label: '校验' },
  { key: 'history', label: '历史' },
  { key: 'track', label: '跟踪' },
  { key: 'untrack', label: '取消跟踪' },
  { key: 'show', label: '详情' },
  { key: 'cleanup', label: '清理' },
]

export default function Chain() {
  const [action, setAction] = useState('status')
  const [path, setPath] = useState('')
  const [recordId, setRecordId] = useState('')
  const [result, setResult] = useState('')
  const [err, setErr] = useState('')

  const run = () => {
    setErr(''); setResult('')
    const params = { action }
    if (path) params.path = path
    if (recordId) params.record_id = recordId
    if (action === 'verify') params.quick = false
    api.chain(params).then((r) => setResult(r.text)).catch((e) => setErr(e.message))
  }

  return (
    <div>
      <h1 className="page-title">数据链</h1>
      <p className="page-desc">文件变更历史 · SHA-256 哈希链 · 快照校验 · 区块链基础</p>

      <div className="card">
        <div className="row">
          <select className="select" value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTIONS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
          <input className="input" value={path} onChange={(e) => setPath(e.target.value)}
            placeholder="文件/目录路径（status 可留空）" />
          {action === 'show' && (
            <input className="input" value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder="记录 ID" />
          )}
          <button className="btn" onClick={run}>执行</button>
        </div>
        {err && <p className="error" style={{ marginTop: 10 }}>{err}</p>}
      </div>

      {result && (
        <div className="card">
          <h3>结果</h3>
          <div className="output">{result}</div>
        </div>
      )}
    </div>
  )
}
