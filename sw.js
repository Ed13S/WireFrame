/* Offline cache: app shell is cached on install; KiCad library files are cached as they are used. */
const V = 'wf-v50', SHELL = ['./', 'index.html', 'style.css', 'config.js', 'parts.js', 'parts_ic.js', 'core.js', 'render.js', 'hershey.js', 'ctx.js', 'fontdata.js', 'fonts/newstroke.woff2', 'ui.js', 'fppick.js', 'panels.js', 'partedit.js', 'sim.js', 'simui.js', 'mcu.js', 'examples.js', 'projects.js', 'interop.js', 'build.js', 'buildview.js', 'buildsync.js', 'build3d.js', 'ai.js', 'boot.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(caches.open(V).then(async c => { const hit = await c.match(r);
    const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
    return hit || net; }));
});
