const { app } = require('electron')
const fs = require('fs')
const path = require('path')
const glob = require('glob')
app.whenReady().then(() => {
  const dist = path.join(__dirname, '..', 'dist', 'assets')
  for (const f of fs.readdirSync(dist).filter(x => x.endsWith('.js'))) {
    const s = fs.readFileSync(path.join(dist, f), 'utf-8')
    console.log(f, s.length, '| 登录:', s.includes('请输入用户名'), '| APIKey:', s.includes('settings/api-key'), '| 对话:', s.includes('FinTerminal 对话'))
  }
  app.exit(0)
})
