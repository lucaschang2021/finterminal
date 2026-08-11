import { useState } from 'react'
import { api } from '../api'

const SUGGESTIONS = [
  '查一下贵州茅台行情',
  '茅台的历史财报',
  '帮我看看这个',
  '写一份贵州茅台的研究报告',
]

export default function Ask() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async (text) => {
    const q = (text ?? input).trim()
    if (!q || busy) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: q }])
    setBusy(true)
    try {
      const r = await api.ask(q)
      setMessages((m) => [...m, { role: 'ai', text: r.text }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', text: `❌ ${e.message}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">对话</h1>
      <p className="page-desc">自然语言操作 FinTerminal：读文件、画图、分析、行情、知识库、研报</p>

      <div className="card">
        <div className="row">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="btn secondary" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="card chat-box">
        <div className="chat-history">
          {messages.length === 0 && (
            <p style={{ color: '#8b949e', fontSize: 13 }}>输入指令，例如「读取 C:/xxx/sales.csv」「画折线图」「查一下茅台行情」…</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>{m.text}</div>
          ))}
        </div>
        <div className="chat-input-row">
          <input className="input" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="输入指令…"
            disabled={busy} />
          <button className="btn" onClick={() => send()} disabled={busy}>{busy ? '思考中…' : '发送'}</button>
        </div>
      </div>
    </div>
  )
}
