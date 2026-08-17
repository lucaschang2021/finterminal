const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('finterminal', {
  getBackendInfo: () => ipcRenderer.invoke('backend:info'),
  platform: process.platform,
  // 当前用户主目录（供文件页默认路径使用；仅路径，非敏感信息）
  homeDir: process.env.USERPROFILE || '',
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
})
