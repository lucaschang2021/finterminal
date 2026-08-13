import { useEffect, useState } from 'react'
import { api } from '../api'

const HOME = 'C:/Users/liuj/Desktop'

export default function Files({ onChart }) {
  const [path, setPath] = useState(HOME)
  const [keyword, setKeyword] = useState('')
  const [list, setList] = useState('')
  const [searchRes, setSearchRes] = useState('')
  const [selected, setSelected] = useState('')
  const [detect, setDetect] = useState('')
  const [err, setErr] = useState('')

  const load = (p) => {
    setErr('')
    api.files(p).then((r) => { setList(r.text); setSelected('') }).catch((e) => setErr(e.message))
  }
  useEffect(() => { load(HOME) }, [])

  const doSearch = () => {
    setErr('')
    api.search(keyword, path, true).then((r) => setSearchRes(r.text)).catch((e) => setErr(e.message))
  }

  const doDetect = (filePath) => {
    setErr('')
    api.detect(filePath).then((r) => setDetect(r.text)).catch((e) => setErr(e.message))
  }

  const lines = list.split('\n').filter(Boolean)

  return (
    <div>
      <h1 className="page-title">文件</h1>
      <p className="page-desc">浏览本地数据文件，选中后可去图表页可视化</p>

      <div className="card">
        <div className="row">
          <input className="input" value={path} onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(path)} placeholder="目录路径" />
          <button className="btn secondary" onClick={() => load(path)}>浏览</button>
          <input className="input" value={keyword} onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()} placeholder="搜索文件名关键词" />
          <button className="btn" onClick={doSearch}>搜索</button>
        </div>
        {err && <p className="error" style={{ marginTop: 10 }}>{err}</p>}
      </div>

      {searchRes && (
        <div className="card">
          <h3>搜索结果</h3>
          <div className="output" style={{ maxHeight: 200 }}>{searchRes}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <input className="input" value={selected} onChange={(e) => setSelected(e.target.value)} placeholder="粘贴要使用的文件完整路径" />
            <button className="btn" onClick={() => { onChart(selected); }}>去画图</button>
          </div>
        </div>
      )}

      <div className="grid2">
        <div className="card">
          <h3>{path}</h3>
          <ul className="file-list">
            {lines.map((ln, i) => {
              const isDir = ln.includes('（文件夹）') || ln.includes('(文件夹)') || ln.includes('文件夹')
              const name = ln.replace(/\s*（.*?）\s*$/, '').trim()
              return (
                <li key={i} className="file-item">
                  <span>{isDir ? '📂' : '📄'}</span>
                  <span>{name}</span>
                  {!isDir && (
                    <button className="btn secondary" onClick={() => onChart(`${path}/${name}`)}>画图</button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
        <div className="card">
          <h3>文件体检</h3>
          <div className="row">
            <input className="input" placeholder="输入文件完整路径，例如 C:/xxx/sales.csv"
              value={selected} onChange={(e) => setSelected(e.target.value)} />
            <button className="btn secondary" onClick={() => doDetect(selected)}>检测</button>
          </div>
          {detect && <div className="output" style={{ marginTop: 12 }}>{detect}</div>}
        </div>
      </div>
    </div>
  )
}
