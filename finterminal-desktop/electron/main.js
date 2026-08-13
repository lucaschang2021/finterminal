/**
 * FinTerminal Electron 主进程
 *
 * 职责：
 * 1. 启动 Python 后端子进程（api_server.py，优先打包后的 finterminal-backend.exe）
 * 2. 创建窗口并加载前端（开发模式加载 Vite dev server，生产加载 dist/index.html）
 * 3. 退出时确保 Python 子进程被正确终止
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron')
const { spawn, execFile } = require('child_process')
const path = require('path')
const net = require('net')
const http = require('http')

const DEFAULT_PORT = 8000
let backendProc = null
let backendPort = DEFAULT_PORT
let mainWindow = null

function log(...args) {
  console.log('[FinTerminal]', ...args)
}

/** 探测可用的 Python 解释器（Windows 商店占位符不可用，需真实解释器） */
function findPython() {
  const candidates = [
    process.env.FIN_PYTHON,
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python313', 'python.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
    'C:/Python313/python.exe',
    'C:/Python312/python.exe',
    path.join(process.env.USERPROFILE || '', 'anaconda3', 'python.exe'),
    path.join(process.env.USERPROFILE || '', 'miniconda3', 'python.exe'),
  ].filter(Boolean)
  const fs = require('fs')
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c
    } catch { /* ignore */ }
  }
  return 'python'
}

/** 找一个空闲端口（从 start 开始探测） */
function findFreePort(start) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > start + 20) return reject(new Error('没有可用端口'))
      const server = net.createServer()
      server.once('error', () => { server.close(); tryPort(port + 1) })
      server.once('listening', () => {
        server.close(() => resolve(port))
      })
      server.listen(port, '127.0.0.1')
    }
    tryPort(start)
  })
}

/** 等待后端 /api/health 就绪（最长 120s：400MB onefile 冷启动 + 杀软扫描可能较慢） */
function waitBackendReady(port, timeoutMs = 120000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    let lastLog = 0
    const probe = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 1500 }, (res) => {
        res.resume()
        if (res.statusCode === 200) return resolve()
        retry()
      })
      req.on('error', retry)
      req.on('timeout', () => { req.destroy(); retry() })
    }
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        return reject(new Error(
          `后端启动超时（超过 ${Math.round(timeoutMs / 1000)} 秒）\n` +
          '可能原因：\n' +
          '1. 首次启动需解压约 400MB 后端并加载依赖，杀毒软件扫描时会明显变慢\n' +
          '2. 存在残留的后端进程占用了端口（可关闭所有 FinTerminal 进程后重试）\n' +
          '3. 磁盘或内存资源紧张\n' +
          '请稍后重试；若持续超时，联系开发者查看后端日志。'
        ))
      }
      if (Date.now() - lastLog > 5000) {
        log(`后端启动中… ${Math.round((Date.now() - started) / 1000)}s`)
        lastLog = Date.now()
      }
      setTimeout(probe, 800)
    }
    probe()
  })
}

/** 在 Windows 上递归终止进程树（pyinstaller onefile 会派生子进程） */
function killProcessTree(pid) {
  if (!pid) return
  try {
    if (process.platform === 'win32') {
      execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, () => {})
    } else {
      process.kill(pid, 'SIGTERM')
    }
  } catch (e) {
    log('终止后端进程失败:', e.message)
  }
}

/**
 * 优雅关闭后端：先请求 /api/shutdown，让 PyInstaller onefile 正常结束并清理
 * _MEI* 临时解压目录；等待数秒后若仍未退出，再强杀兜底。
 */
function shutdownBackendGracefully() {
  const proc = backendProc
  if (!proc || !proc.pid) return
  const port = backendPort
  const http = require('http')
  const req = http.request(
    { host: '127.0.0.1', port, path: '/api/shutdown', method: 'POST', timeout: 3000 },
    (res) => { res.resume() }
  )
  req.on('error', () => {})
  req.on('timeout', () => { req.destroy() })
  req.end()
  // 等待后端自行退出（清理 _MEI*），最长 6 秒，超时强杀
  const deadline = Date.now() + 6000
  const timer = setInterval(() => {
    const exited = proc.exitCode !== null || proc.killed
    if (exited || Date.now() > deadline) {
      clearInterval(timer)
      if (!exited) killProcessTree(proc.pid)
    }
  }, 300)
}

/** 启动时兜底清理 Temp 下残留的 PyInstaller/便携版解压目录（_MEI* / 3H*） */
function cleanupTempExtractions() {
  try {
    const fs = require('fs')
    const os = require('os')
    const tmp = fs.realpathSync(os.tmpdir())
    const now = Date.now()
    for (const name of fs.readdirSync(tmp)) {
      if (!/^(_MEI|3H)/.test(name)) continue
      const full = path.join(tmp, name)
      let st = null
      try { st = fs.statSync(full) } catch { continue }
      if (!st.isDirectory()) continue
      // 只清理超过 1 小时的目录，避免误删正在运行的其他实例
      if (now - st.mtimeMs > 3600 * 1000) {
        fs.rmSync(full, { recursive: true, force: true })
        log('清理残留解压目录:', full)
      }
    }
  } catch (e) {
    log('清理残留解压目录失败:', e.message)
  }
}

/** 启动 Python 后端子进程 */
async function startBackend() {
  const pythonDir = app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '..', 'python')
  // 开发模式也优先使用已打包的后端 exe（避免依赖 PATH 中的 Python）
  const backendExe = app.isPackaged
    ? path.join(pythonDir, 'finterminal-backend.exe')
    : path.join(__dirname, '..', 'build', 'backend', 'finterminal-backend.exe')

  try {
    backendPort = await findFreePort(DEFAULT_PORT)
  } catch (e) {
    backendPort = DEFAULT_PORT
  }

  const isDev = !app.isPackaged
  const spawnOpts = {
    cwd: pythonDir,
    windowsHide: true,
    env: { ...process.env, FIN_BACKEND_PORT: String(backendPort) },
    stdio: isDev ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  }

  if (require('fs').existsSync(backendExe)) {
    // 生产：pyinstaller 打包的后端可执行文件
    backendProc = spawn(backendExe, ['--port', String(backendPort)], spawnOpts)
    log('启动打包后端:', backendExe, '端口', backendPort)
  } else if (isDev) {
    // 开发：系统 Python 直接跑 uvicorn
    const py = findPython()
    backendProc = spawn(py, ['-m', 'uvicorn', 'api_server:app', '--host', '127.0.0.1', '--port', String(backendPort)],
      { ...spawnOpts, cwd: pythonDir })
    log('启动 Python 后端 (dev):', pythonDir, '端口', backendPort)
  } else {
    throw new Error(`未找到后端可执行文件: ${backendExe}`)
  }

  if (!isDev) {
    backendProc.stdout.on('data', (d) => log('[backend]', String(d).trim()))
    backendProc.stderr.on('data', (d) => log('[backend-err]', String(d).trim()))
  }
  backendProc.on('exit', (code) => {
    log('后端进程退出:', code)
    backendProc = null
  })

  await waitBackendReady(backendPort)
  log('后端已就绪:', `http://127.0.0.1:${backendPort}`)
  return backendPort
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'FinTerminal',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // 就绪后强制聚焦，确保“按任意键以启动”立即可用
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.focus()
  })

  const startUrl = process.env.ELECTRON_START_URL || null
  if (startUrl) {
    mainWindow.loadURL(startUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
      query: { backendPort: String(port) },
    })
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// 渲染进程询问后端端口 / API 地址
ipcMain.handle('backend:info', () => ({
  port: backendPort,
  apiBase: `http://127.0.0.1:${backendPort}/api`,
}))

app.whenReady().then(async () => {
  try {
    cleanupTempExtractions()
    const port = await startBackend()
    createWindow(port)
  } catch (e) {
    log('后端启动失败:', e.message)
    const { dialog } = require('electron')
    dialog.showErrorBox('FinTerminal 启动失败',
      `无法启动后端服务：\n${e.message}\n\n请确认 Python 已安装且依赖完整（开发模式），或重新安装应用（打包模式）。`)
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(backendPort)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  shutdownBackendGracefully()
})
