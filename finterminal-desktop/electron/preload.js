const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('finterminal', {
  getBackendInfo: () => ipcRenderer.invoke('backend:info'),
  // 另存为图表：弹出保存对话框并把图表文件复制到用户选择的位置
  saveChart: (fileName) => ipcRenderer.invoke('chart:save', fileName),
  platform: process.platform,
  // 当前用户主目录（供文件页默认路径使用；仅路径，非敏感信息）
  homeDir: process.env.USERPROFILE || '',
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
})
