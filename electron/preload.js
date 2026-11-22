const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAI', { ask: p => ipcRenderer.invoke('ai', p) });
