import { useEffect, useState } from 'react'
import { api } from '../api'

export default function Knowledge() {
  const [status, setStatus] = useState('')
  const [filePath, setFilePath] = useState('')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState('')
  const [err, setErr] = useState('')

  const refresh = () => {
    api.knowledge({ action: 'status' }).then((r) => setStatus(r.text)).catch((e) => setErr(e.message))
  }
  useEffect(() => { refresh() }, [])

  const add = () => {
    setErr(''); setResult('')
    api.knowledge({ action: 'add', file_path: filePath }).then((r) => { setResult(r.text); refresh() })
      .catch((e) => setErr(e.message))
  }

  const doQuery = () => {
    setErr(''); setResult('')
    api.knowledgeQuery({ query_text: query, top_k: 5 }).then((r) => setResult(r.text)).catch((e) => setErr(e.message))
  }

  const clear = () => {
    if (!window.confirm('确定清空整个知识库？')) return
    api.knowledge({ action: 'clear' }).then((r) => { setResult(r.text); refresh() }).catch((e) => setErr(e.message))
  }

  return (
    <div>
      <h1 className="page-title">知识库</h1>
      <p className="page-desc">本地向量检索 + BM25 混合检索 · 引用溯源</p>

      <div className="card">
        <h3>状态</h3>
        <div className="row">
          <button className="btn secondary" onClick={refresh}>刷新</button>
          {status && <div className="output" style={{ flex: 1, maxHeight: 80 }}>{status}</div>}
        </div>
      </div>

      <div className="card">
        <h3>添加文档</h3>
        <div className="row">
          <input className="input" value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="文件路径（txt/md/pdf/docx/csv/xlsx）" />
          <button className="btn" onClick={add}>添加到知识库</button>
          <button className="btn danger" onClick={clear}>清空</button>
        </div>
      </div>

      <div className="card">
        <h3>检索</h3>
        <div className="row">
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doQuery()} placeholder="查询内容，例如：茅台的估值" />
          <button className="btn" onClick={doQuery}>查询</button>
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
