const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAI', { ask: p => ipcRenderer.invoke('ai', p), hasKey: () => ipcRenderer.invoke('ai-has-key'), setKey: k => ipcRenderer.invoke('ai-set-key', k), clearKey: () => ipcRenderer.invoke('ai-clear-key') });
