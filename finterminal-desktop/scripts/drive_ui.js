/**
 * 直接驱动前端界面联调：登录(注册) → 主界面 → 设置页 API Key。
 * 基于真实渲染的 UI 表单操作（不依赖源码视图）。
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const { execFileSync } = require('child_process')
const path = require('path')

const BACKEND_PORT = 8000
const API = `http://127.0.0.1:${BACKEND_PORT}/api`
const PYTHON = 'C:/Users/liuj/AppData/Local/Programs/Python/Python313/python.exe'
const results = []

function check(name, cond, detail = '') {
  results.push({ name, pass: !!cond })
  console.log(`${cond ? '[PASS]' : '[FAIL]'} ${name}${detail && !cond ? ' | ' + detail : ''}`)
}

ipcMain.handle('backend:info', () => ({ port: BACKEND_PORT, apiBase: API }))

function keyringGet() {
  try {
    return execFileSync(PYTHON, ['-c', "import keyring; print(keyring.get_password('finterminal','deepseek_api_key') or '')"], { encoding: 'utf-8' }).trim()
  } catch { return '' }
}
function keyringSet(v) {
  execFileSync(PYTHON, ['-c', `import keyring; keyring.set_password('finterminal','deepseek_api_key','${v}')`], { encoding: 'utf-8' })
}
function keyringDel() {
  execFileSync(PYTHON, ['-c', "import keyring\ntry:\n keyring.delete_password('finterminal','deepseek_api_key')\nexcept Exception: pass"], { encoding: 'utf-8' })
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** 设置 React 受控输入框的值 */
const setInput = (placeholder, value) => `
  (() => {
    const i = Array.from(document.querySelectorAll('input')).find(x => (x.placeholder || '').includes('${placeholder}'));
    if (!i) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(i, '${value}');
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()
`

const clickButton = (text) => `
  (() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent && x.textContent.trim().includes('${text}'));
    if (!b) return false;
    b.click();
    return true;
  })()
`

app.whenReady().then(async () => {
  const backup = keyringGet()
  console.log('原 keyring:', backup ? '已配置' : '未配置')

  const win = new BrowserWindow({
    width: 1440, height: 900, show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'electron', 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
  })

  try {
    await win.loadURL('http://127.0.0.1:5173')
    await wait(8000) // 启动动画 + 登录页

    // 1. 确保 demo 用户存在（快速登录）
    await win.webContents.executeJavaScript(`
      (() => {
        const users = JSON.parse(localStorage.getItem('finterminal_users') || '{}');
        users['demo'] = { passHash: 'h1', remember: true, createdAt: Date.now() };
        localStorage.setItem('finterminal_users', JSON.stringify(users));
        location.reload();
        return true;
      })()
    `)
    await wait(8000) // 启动动画 + 登录页（含 demo 按钮）

    // 2. 点击 demo 快速登录
    await win.webContents.executeJavaScript(`
      (() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent && x.textContent.trim() === 'demo'); if (b) b.click(); return !!b; })()
    `)
    await wait(3000)

    // 3. 检查是否进入主界面
    const inMain = await win.webContents.executeJavaScript(`
      document.body.innerText.includes('对话') && document.body.innerText.includes('数据链')
    `)
    check('demo 登录进入主界面', inMain)

    // 4. 打开设置页
    await win.webContents.executeJavaScript(`
      (() => { const b = Array.from(document.querySelectorAll('button')).find(x => x.title === '设置'); if (b) b.click(); return !!b; })()
    `)
    await wait(1500)

    // 5. 设置页 API Key 输入 + 保存（先 dump 按钮定位）
    const btns = await win.webContents.executeJavaScript(`
      Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean).slice(0, 20)
    `)
    console.log('设置页按钮:', JSON.stringify(btns))
    await win.webContents.executeJavaScript(setInput('sk-', 'sk-integration-drive'))
    await wait(400)
    // 点击 API Key 区的保存按钮（第一个匹配"保存"且非禁用的）
    await win.webContents.executeJavaScript(`
      (() => {
        const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent && x.textContent.trim() === '保存' && !x.disabled);
        if (b) b.click();
        return !!b;
      })()
    `)
    await wait(1500)
    check('API Key 保存到 keyring', keyringGet() === 'sk-integration-drive', 'keyring=' + keyringGet().slice(0, 15))

    // 6. 清除
    await win.webContents.executeJavaScript(`window.confirm = () => true; ${clickButton('清除')}`)
    await wait(1200)
    check('API Key 已清除', keyringGet() !== 'sk-integration-drive')
  } catch (e) {
    check('驱动流程无异常', false, String(e).slice(0, 150))
  } finally {
    // 恢复原 key
    if (backup) keyringSet(backup)
    else keyringDel()
    console.log('原 key 已恢复')
    const pass = results.filter((r) => r.pass).length
    console.log(`\nUI 联调: ${pass}/${results.length} 通过`)
    app.exit(pass === results.length ? 0 : 1)
  }
})
