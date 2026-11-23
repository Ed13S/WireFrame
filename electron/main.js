const { app, BrowserWindow, ipcMain, shell, protocol, net } = require('electron');
const path = require('path'), { pathToFileURL } = require('url');
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
// Optional: set OPENROUTER_API_KEY in your environment to enable one-click AI in the desktop app.
ipcMain.handle('ai', async (_e, prompt) => {
  const key = process.env.OPENROUTER_API_KEY; if (!key) throw new Error('No OPENROUTER_API_KEY set; use copy/paste mode instead.');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.MODEL || 'anthropic/claude-sonnet-4.5', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error && j.error.message || 'AI error'); return (j.choices && j.choices[0] && j.choices[0].message.content) || '';
});
app.on('window-all-closed', () => app.quit());
