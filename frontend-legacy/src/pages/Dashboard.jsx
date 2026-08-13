import { useEffect, useState } from 'react'
import { api } from '../api'

export default function Dashboard({ onOpenChart }) {
  const [health, setHealth] = useState(null)
  const [charts, setCharts] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    api.health().then((r) => setHealth(r.data)).catch((e) => setErr(e.message))
    api.charts().then((r) => setCharts(r.data)).catch(() => {})
  }, [])

  return (
    <div>
      <h1 className="page-title">概览</h1>
      <p className="page-desc">FinTerminal 本地金融数据终端 · React + ECharts 前端</p>

      <div className="stat-grid">
        <div className="stat"><div className="label">服务状态</div>
          <div className="value">{health ? <span className="ok">● 在线</span> : <span className="error">● 离线</span>}</div></div>
        <div className="stat"><div className="label">工具数</div><div className="value">{health?.tools ?? '—'}</div></div>
        <div className="stat"><div className="label">图表类型</div><div className="value">{health?.charts?.length ?? '—'}</div></div>
        <div className="stat"><div className="label">已生成图表</div><div className="value">{charts.length}</div></div>
      </div>
      {err && <p className="error" style={{ marginTop: 12 }}>无法连接后端：{err}（请先运行 python -m uvicorn api_server:app --port 8000）</p>}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>最近图表</h3>
        {charts.length === 0 ? (
          <p style={{ color: '#8b949e', fontSize: 13 }}>暂无图表，去「文件」页选一个文件，或直接到「图表」页生成。</p>
        ) : (
          <div className="charts-grid">
            {charts.filter((c) => c.kind === 'png').slice(0, 8).map((c) => (
              <div key={c.name} className="chart-thumb">
                <img src={`/api/file?path=${encodeURIComponent(c.path)}`} alt={c.name} loading="lazy" />
                <div className="name">{c.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>快速开始</h3>
        <div className="row">
          <button className="btn secondary" onClick={() => onOpenChart(null)}>打开图表页</button>
          <span style={{ color: '#8b949e', fontSize: 13 }}>
            在「文件」页浏览数据文件，或在「对话」页用自然语言操作
          </span>
        </div>
      </div>
    </div>
  )
}
