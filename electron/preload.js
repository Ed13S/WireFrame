const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAI', { ask: p => ipcRenderer.invoke('ai', p), tail: () => ipcRenderer.invoke('ai-key-tail'), hasKey: () => ipcRenderer.invoke('ai-has-key'), setKey: k => ipcRenderer.invoke('ai-set-key', k), clearKey: () => ipcRenderer.invoke('ai-clear-key') });
