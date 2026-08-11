import { useState } from 'react'
import { api } from '../api'

const TYPES = ['describe', 'correlation', 'groupby', 'regression', 'test', 'trend',
  'vif', 'event', 'did', 'backtest', 'report']

export default function Analysis() {
  const [filePath, setFilePath] = useState('')
  const [analysis, setAnalysis] = useState('describe')
  const [groupCol, setGroupCol] = useState('')
  const [valueCols, setValueCols] = useState('')
  const [xCols, setXCols] = useState('')
  const [yCol, setYCol] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [signalCol, setSignalCol] = useState('')
  const [aiComment, setAiComment] = useState(false)
  const [save, setSave] = useState(false)
  const [result, setResult] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const run = () => {
    setErr(''); setLoading(true); setResult('')
    api.analyze({
      file_path: filePath, analysis,
      group_column: groupCol || null,
      value_columns: valueCols || null,
      x_columns: xCols || null,
      y_column: yCol || null,
      event_date: eventDate || null,
      signal_column: signalCol || null,
      ai_comment: aiComment,
      save,
    }).then((r) => setResult(r.text))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }

  return (
    <div>
      <h1 className="page-title">统计分析</h1>
      <p className="page-desc">describe / correlation / regression / 事件研究 / DID / 回测 / 自动报告</p>

      <div className="card">
        <div className="row">
          <input className="input" value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="数据文件路径" />
          <select className="select" value={analysis} onChange={(e) => setAnalysis(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn" onClick={run} disabled={loading}>{loading ? '分析中…' : '分析'}</button>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          {['groupby', 'test', 'event', 'did', 'report'].includes(analysis) && (
            <input className="input" value={groupCol} onChange={(e) => setGroupCol(e.target.value)} placeholder="分组列" />
          )}
          {['groupby', 'trend', 'test', 'report'].includes(analysis) && (
            <input className="input" value={valueCols} onChange={(e) => setValueCols(e.target.value)} placeholder="数值列（逗号分隔）" />
          )}
          {['regression', 'vif', 'report'].includes(analysis) && (
            <input className="input" value={xCols} onChange={(e) => setXCols(e.target.value)} placeholder="自变量列（逗号分隔）" />
          )}
          {['regression', 'report'].includes(analysis) && (
            <input className="input" value={yCol} onChange={(e) => setYCol(e.target.value)} placeholder="因变量列" />
          )}
          {['event', 'did'].includes(analysis) && (
            <input className="input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} placeholder="事件日期 2026-03-15" />
          )}
          {analysis === 'backtest' && (
            <input className="input" value={signalCol} onChange={(e) => setSignalCol(e.target.value)} placeholder="策略信号列" />
          )}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <label style={{ fontSize: 13, color: '#8b949e' }}>
            <input type="checkbox" checked={aiComment} onChange={(e) => setAiComment(e.target.checked)} /> AI 评论
          </label>
          <label style={{ fontSize: 13, color: '#8b949e' }}>
            <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> 保存报告
          </label>
          {err && <span className="error">{err}</span>}
        </div>
      </div>

      {result && (
        <div className="card">
          <h3>分析结果</h3>
          <div className="output">{result}</div>
        </div>
      )}
    </div>
  )
}
