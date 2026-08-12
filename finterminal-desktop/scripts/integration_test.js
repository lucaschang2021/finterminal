/**
 * 前后端整合测试：Electron 加载生产前端 → 真实调用后端。
 * 覆盖：登录进入主界面、设置页 API Key 配置（备份→保存→验证→清除→恢复）。
 * 用法：electron scripts/integration_test.js
 */

const { app, BrowserWindow, ipcMain } = require('electron')
const { execFileSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const BACKEND_PORT = 8000
const API = `http://127.0.0.1:${BACKEND_PORT}/api`
const PYTHON = 'C:/Users/liuj/AppData/Local/Programs/Python/Python313/python.exe'
const OUT = path.join(__dirname, '..', 'shots')

const results = []
function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond, detail })
  console.log(`${cond ? '[PASS]' : '[FAIL]'} ${name}${detail && !cond ? ' | ' + detail : ''}`)
}

ipcMain.handle('backend:info', () => ({ port: BACKEND_PORT, apiBase: API }))

async function shoot(win, name) {
  fs.mkdirSync(OUT, { recursive: true })
  const img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(OUT, name), img.toPNG())
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function keyringBackup() {
  try {
    const code = "import keyring; print(keyring.get_password('finterminal','deepseek_api_key') or '')"
    return execFileSync(PYTHON, ['-c', code], { encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
}

function keyringRestore(value) {
  const code = value
    ? `import keyring; keyring.set_password('finterminal','deepseek_api_key',${JSON.stringify(value)})`
    : `import keyring
try:
    keyring.delete_password('finterminal','deepseek_api_key')
except Exception:
    pass`
  execFileSync(PYTHON, ['-c', code], { encoding: 'utf-8' })
}

app.whenReady().then(async () => {
  const backup = keyringBackup()
  console.log('原 keyring 状态:', backup ? '已配置（备份完成）' : '未配置')

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

  try {
    await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    await wait(9000) // 启动动画 5s + 淡出 + 主界面渲染
    await shoot(win, 'it-01-app.png')

    // 主界面渲染检查
    const mainOk = await win.webContents.executeJavaScript(`
      document.body.innerText.length > 200
    `)
    check('主界面渲染', mainOk)

    // 打开设置页
    await win.webContents.executeJavaScript(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const s = btns.find(b => b.title === '设置' || (b.textContent && b.textContent.includes('设置')));
        if (s) s.click();
        return !!s;
      })()
    `)
    await wait(1500)
    await shoot(win, 'it-03-settings.png')

    // API Key 输入框是否存在
    const hasKeyInput = await win.webContents.executeJavaScript(`
      (() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.some(i => i.type === 'password' || (i.placeholder || '').includes('sk-') || (i.placeholder || '').toLowerCase().includes('api key'));
      })()
    `)
    check('设置页 API Key 输入框存在', hasKeyInput)

    // 前端 GET status（真实后端调用）
    const statusBefore = await win.webContents.executeJavaScript(`
      fetch(${JSON.stringify(API + '/settings/api-key/status')}).then(r => r.json())
    `)
    check('前端调用 GET status 联通', statusBefore.ok === true && typeof statusBefore.data?.configured === 'boolean',
      JSON.stringify(statusBefore).slice(0, 100))

    // 模拟输入并保存（React 受控组件需 native setter）
    await win.webContents.executeJavaScript(`
      (async () => {
        const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        const inputs = Array.from(document.querySelectorAll('input'));
        const keyInput = inputs.find(i => i.type === 'password' || (i.placeholder || '').includes('sk-'));
        if (!keyInput) return 'no-input';
        setVal.call(keyInput, 'sk-integration-test-key');
        keyInput.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 300));
        const btns = Array.from(document.querySelectorAll('button'));
        const save = btns.find(b => b.textContent && b.textContent.trim() === '保存');
        if (save) save.click();
        await new Promise(r => setTimeout(r, 1200));
        return 'saved';
      })()
    `)
    await wait(1500)

    // 后端验证：keyring 中是否已保存
    const savedKey = keyringBackup()
    check('保存后 keyring 含新 key', savedKey === 'sk-integration-test-key', `实际: ${savedKey.slice(0, 12)}...`)

    // 前端清除
    await win.webContents.executeJavaScript(`
      (async () => {
        window.confirm = () => true;
        const btns = Array.from(document.querySelectorAll('button'));
        const del = btns.find(b => b.textContent && b.textContent.includes('清除'));
        if (del) del.click();
        await new Promise(r => setTimeout(r, 1000));
        return !!del;
      })()
    `)
    await wait(1200)
    const afterClear = keyringBackup()
    check('清除后 keyring 无测试 key', afterClear !== 'sk-integration-test-key')
    await shoot(win, 'it-04-apikey.png')
  } catch (e) {
    check('整合流程无异常', false, String(e).slice(0, 200))
  } finally {
    keyringRestore(backup)
    console.log('原 key 已恢复:', backup ? '是' : '（原本未配置）')
    const pass = results.filter((r) => r.pass).length
    console.log(`\n整合测试: ${pass}/${results.length} 通过`)
    app.exit(pass === results.length ? 0 : 1)
  }
})
