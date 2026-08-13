/** 通过 Electron（真实文件系统视图）读取前端源码 */
const { app } = require('electron')
const fs = require('fs')
const path = require('path')

app.whenReady().then(() => {
  const src = path.join(__dirname, '..', 'src')
  for (const f of ['App.tsx', 'components/LoginPage.tsx']) {
    const p = path.join(src, f)
    console.log(`\n===== ${f} =====`)
    try {
      console.log(fs.readFileSync(p, 'utf-8').slice(0, 2500))
    } catch (e) {
      console.log('读取失败:', e.message)
    }
  }
  app.exit(0)
})
