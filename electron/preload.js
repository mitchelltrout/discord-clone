const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setServerUrl: (url) => ipcRenderer.send('set-server-url', url),
});
