const { app, BrowserWindow, ipcMain, shell, protocol, net, safeStorage } = require('electron');
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
// Serve the web app from an app:// address instead of file://, so fetch() of the KiCad library (lib/*.json) works.
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
function win() {
  const w = new BrowserWindow({ width: 1440, height: 900, title: 'WireFrame', backgroundColor: '#0a0a0a', webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  w.loadURL('app://wireframe/index.html');
  w.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}
app.whenReady().then(() => {
  protocol.handle('app', req => { const u = new URL(req.url); let p = decodeURIComponent(u.pathname); if (p === '/' || !p) p = '/index.html';
    const full = path.normalize(path.join(__dirname, 'app', p)); if (!full.startsWith(path.join(__dirname, 'app'))) return new Response('forbidden', { status: 403 }); return net.fetch(pathToFileURL(full).toString()); });
  win();
});
const openWire = (w, f) => { try { const t = fs.readFileSync(f, 'utf8'); w.webContents.executeJavaScript('App.openText(' + JSON.stringify(t) + ',' + JSON.stringify(path.basename(f)) + ')'); } catch (e) {} };
let pendingFile = process.argv.find(a => /\.wire$/i.test(a)) || null;
app.on('open-file', (e, f) => { e.preventDefault(); const w = BrowserWindow.getAllWindows()[0]; if (w) openWire(w, f); else pendingFile = f; });
app.on('browser-window-created', (e, w) => w.webContents.on('did-finish-load', () => { if (pendingFile) { const f = pendingFile; pendingFile = null; setTimeout(() => openWire(w, f), 800); } }));
// The OpenRouter key is pasted once inside the app and kept encrypted (macOS Keychain-backed), never in the page or the repo.
// OPENROUTER_API_KEY in the environment still works and takes priority.
const keyFile = () => path.join(app.getPath('userData'), 'ai-key.bin');
function getKey() { if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY; try { return safeStorage.decryptString(fs.readFileSync(keyFile())); } catch (e) { return ''; } }
ipcMain.handle('ai-key-tail', () => { const k = getKey(); return k ? k.slice(-4) : ''; });
ipcMain.handle('ai-has-key', () => !!getKey());
ipcMain.handle('ai-set-key', (_e, k) => { k = String(k || '').trim(); if (!/^sk-or-[\w-]{10,}$/.test(k)) throw new Error('That does not look like an OpenRouter key. It starts with sk-or-'); if (!safeStorage.isEncryptionAvailable()) throw new Error('This computer cannot store the key securely.'); fs.writeFileSync(keyFile(), safeStorage.encryptString(k)); return true; });
ipcMain.handle('ai-clear-key', () => { try { fs.unlinkSync(keyFile()); } catch (e) { /* nothing saved */ } return true; });
ipcMain.handle('ai', async (_e, prompt) => {
  const key = getKey(); if (!key) throw new Error('Paste your OpenRouter key into the box at the top of the AI window first.');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.MODEL || 'openrouter/free', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error && j.error.message || 'AI error'); return (j.choices && j.choices[0] && j.choices[0].message.content) || '';
});
app.on('window-all-closed', () => app.quit());
