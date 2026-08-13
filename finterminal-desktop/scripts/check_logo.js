const { app } = require('electron')
const fs = require('fs')
const path = require('path')
app.whenReady().then(() => {
  for (const f of ['components/SplashScreen.tsx', 'components/Logo.tsx']) {
    const p = path.join(__dirname, '..', 'src', f)
    console.log(`===== ${f} =====`)
    try {
      const s = fs.readFileSync(p, 'utf-8')
      const lines = s.split('\n')
      // 找 import 和 Logo/diamond 相关行
      lines.forEach((l, i) => { if (/import|Logo|diamond|svg|jpg|png/i.test(l)) console.log((i+1) + ': ' + l.trim()) })
    } catch (e) { console.log('读取失败:', e.message) }
  }
  app.exit(0)
})
