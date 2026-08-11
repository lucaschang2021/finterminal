const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('finterminal', {
  getBackendInfo: () => ipcRenderer.invoke('backend:info'),
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
})
