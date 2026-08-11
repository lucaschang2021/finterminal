/**
 * 临时截图脚本：渲染应用并抓取启动动画/登录页/主界面截图。
 * 用法：electron scripts/screenshot.js
 */

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const OUT = path.join(__dirname, '..', 'shots')

ipcMain.handle('backend:info', () => ({
  port: 8000,
  apiBase: 'http://127.0.0.1:8000/api',
}))

async function shoot(win, name) {
  const image = await win.webContents.capturePage()
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, name), image.toPNG())
  console.log('saved', name)
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  await new Promise((r) => setTimeout(r, 2500))
  await shoot(win, '01-splash.png')

  await new Promise((r) => setTimeout(r, 3500))
  await shoot(win, '02-login.png')

  // 注册演示用户并进入主界面
  await win.webContents.executeJavaScript(`
    (() => {
      const users = JSON.parse(localStorage.getItem('finterminal_users') || '{}');
      users['demo'] = { passHash: 'h' + 5381, remember: true, createdAt: Date.now() };
      localStorage.setItem('finterminal_users', JSON.stringify(users));
      localStorage.setItem('finterminal_current_user', 'demo');
      location.reload();
      return true;
    })()
  `)
  await new Promise((r) => setTimeout(r, 4000))
  await shoot(win, '03-app.png')

  // 打开底部面板 + 图表页
  await win.webContents.executeJavaScript(`
    (() => {
      const nav = document.querySelectorAll('nav button');
      const charts = Array.from(nav).find(b => b.title === '图表');
      if (charts) charts.click();
      return true;
    })()
  `)
  await new Promise((r) => setTimeout(r, 1800))
  await shoot(win, '04-charts.png')

  // 点击第一个图表缩略图 → 展开底部面板（占位内容）
  await win.webContents.executeJavaScript(`
    (() => {
      const cards = document.querySelectorAll('button');
      const chart = Array.from(cards).find(b => b.textContent && b.textContent.includes('折线'));
      if (chart) chart.click();
      return true;
    })()
  `)
  await new Promise((r) => setTimeout(r, 2200))
  await shoot(win, '05-panel.png')

  app.quit()
})
