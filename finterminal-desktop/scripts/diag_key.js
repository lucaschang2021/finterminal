/** 诊断：Electron 实际加载的页面内容 */
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

ipcMain.handle('backend:info', () => ({ port: 8000, apiBase: 'http://127.0.0.1:8000/api' }))

app.whenReady().then(async () => {
  const { session } = require('electron')
  await session.defaultSession.clearCache()
  await session.defaultSession.clearStorageData()
  const win = new BrowserWindow({
    width: 1440, height: 900, show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
  })
  await win.loadURL('http://127.0.0.1:5173')
  await new Promise((r) => setTimeout(r, 9000))
  const info = await win.webContents.executeJavaScript(`
    (() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const buttons = Array.from(document.querySelectorAll('button'));
      return {
        location: location.href,
        bodyHead: document.body.innerText.slice(0, 300),
        scriptSrc: Array.from(document.querySelectorAll('script')).map(s => s.src),
        inputs: inputs.map(i => ({ type: i.type, ph: i.placeholder, val: i.value })),
        buttons: buttons.map(b => b.textContent && b.textContent.trim()).filter(Boolean).slice(0, 15),
      };
    })()
  `)
  console.log(JSON.stringify(info, null, 2))
  // 运行时读取加载的 JS 内容，确认实际内容
  const jsContent = await win.webContents.executeJavaScript(`
    fetch(document.querySelector('script').src).then(r => r.text()).then(t => ({
      len: t.length,
      hasLogin: t.includes('请输入用户名'),
      hasKey: t.includes('settings/api-key'),
      hasRootNoLogin: t.includes('ROOT_MARKER_NO_LOGIN'),
      hasSplash: t.includes('按任意键'),
    }))
  `)
  console.log('运行时 JS 内容检查:', JSON.stringify(jsContent))
  // 主进程 fs 直接读同一文件
  const fs = require('fs')
  const p = path.join(__dirname, '..', 'dist', 'assets', 'index-BMCZSk4P.js')
  const buf = fs.readFileSync(p)
  const s = buf.toString('utf-8')
  console.log('主进程 fs 读取:', { len: buf.length, hasLogin: s.includes('请输入用户名'), hasSplash: s.includes('按任意键') })
  // 间隔 3 秒再读一次，检查文件是否在变
  await new Promise((r) => setTimeout(r, 3000))
  const buf2 = fs.readFileSync(p)
  console.log('3秒后 fs 读取:', { len: buf2.length, hasLogin: buf2.toString('utf-8').includes('请输入用户名') })
  app.exit(0)
})
