/** 诊断：设置页 API Key 输入框与保存按钮状态 */
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

ipcMain.handle('backend:info', () => ({ port: 8000, apiBase: 'http://127.0.0.1:8000/api' }))

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440, height: 900, show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
  })
  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  await new Promise((r) => setTimeout(r, 9000)) // 启动动画 + 主界面
  await win.webContents.executeJavaScript(`
    (() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.title === '设置'); if (b) b.click(); })()
  `)
  await new Promise((r) => setTimeout(r, 1500))
  const info = await win.webContents.executeJavaScript(`
    (() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const buttons = Array.from(document.querySelectorAll('button'));
      return {
        inputs: inputs.map(i => ({ type: i.type, ph: i.placeholder, val: i.value })),
        saves: buttons.filter(b => b.textContent && b.textContent.trim().includes('保存')).map(b => ({ text: b.textContent.trim(), disabled: b.disabled })),
      };
    })()
  `)
  console.log(JSON.stringify(info, null, 2))
  app.exit(0)
})
