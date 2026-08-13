/** 诊断登录页交互 */
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

ipcMain.handle('backend:info', () => ({ port: 8000, apiBase: 'http://127.0.0.1:8000/api' }))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440, height: 900, show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
  })
  await win.loadURL('http://127.0.0.1:5173')
  await wait(8000)

  const dump = () => win.webContents.executeJavaScript(`
    (() => ({
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean),
      inputs: Array.from(document.querySelectorAll('input')).map(i => ({ ph: i.placeholder, val: i.value })),
    }))()
  `)
  console.log('初始:', JSON.stringify(await dump()))

  await win.webContents.executeJavaScript(`
    (() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.includes('注册新账户')); if (b) b.click(); return !!b; })()
  `)
  await wait(600)
  console.log('点击注册后:', JSON.stringify(await dump()))

  await win.webContents.executeJavaScript(`
    (() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const ins = Array.from(document.querySelectorAll('input'));
      const u = ins.find(x => (x.placeholder || '').includes('用户名'));
      const p = ins.find(x => (x.placeholder || '').includes('密码'));
      setter.call(u, 'demoit'); u.dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(p, 'demoit123'); p.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()
  `)
  await wait(600)
  console.log('输入后:', JSON.stringify(await dump()))

  await win.webContents.executeJavaScript(`
    (() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent && x.textContent.trim().includes('注 册')); if (b) b.click(); return !!b; })()
  `)
  await wait(2500)
  console.log('提交后 body:', (await win.webContents.executeJavaScript('document.body.innerText.slice(0, 150)')).replace(/\n/g, ' '))

  // 尝试点击 demo 快速登录按钮
  await win.webContents.executeJavaScript(`
    (() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent && x.textContent.trim() === 'demo'); if (b) b.click(); return !!b; })()
  `)
  await wait(2500)
  console.log('点 demo 后 body:', (await win.webContents.executeJavaScript('document.body.innerText.slice(0, 180)')).replace(/\n/g, ' '))
  app.exit(0)
})
