const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Configuración
  getApiConfig: () => ipcRenderer.invoke('get-api-config'),

  // Cache para modo offline
  cache: {
    save: (endpoint, data) => ipcRenderer.invoke('cache-save', endpoint, data),
    get: (endpoint) => ipcRenderer.invoke('cache-get', endpoint),
    clean: () => ipcRenderer.invoke('cache-clean')
  },

  // Verificar conexión
  checkOnline: () => ipcRenderer.invoke('check-online'),

  // Info de la app
  platform: process.platform,
  version: require('./package.json').version
});
