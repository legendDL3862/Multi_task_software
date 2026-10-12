const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dualSlotDesktop', {
  pickMusicFolder: () => ipcRenderer.invoke('music:pickFolder'),
  setMusicFolder: (dir) => ipcRenderer.invoke('music:setFolder', dir),
  listMusic: (dir) => ipcRenderer.invoke('music:list', dir),
  readMusic: (filePath) => ipcRenderer.invoke('music:read', filePath),
})
