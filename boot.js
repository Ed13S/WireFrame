/* Startup: restore the last sheet (or show the example) and register the offline service worker. */
(function () {
  const A = window.App; let saved = null;
  (async () => {
    let ok = false;
    try { ok = await A.projects.restore(); } catch (e) { console.error(e); }
    if (!ok) { try { await A.loadExample('led'); } catch (e) { console.error(e); A.emit('load'); } A.projects.adoptCurrent(); }
    A.refreshLib(); setTimeout(A.fit, 60);
  })();

  /* Mac app only: look for a newer GitHub release (auto-install needs a paid Apple certificate, so we just offer the download). */
  if (window.electronAI && window.RELEASES_API) setTimeout(async () => {
    try {
      const r = await fetch(window.RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } }); if (!r.ok) return;
      const tag = String((await r.json()).tag_name || '').replace(/^v/i, '');
      const n = v => String(v).split('.').map(x => parseInt(x, 10) || 0);
      const a = n(tag), b = n(A.VER); let newer = false;
      for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) { newer = (a[i] || 0) > (b[i] || 0); break; } }
      if (!newer) return;
      A.toast('WireFrame ' + tag + ' is available (you have ' + A.VER + '). Opening the download page…', 5000);
      setTimeout(() => window.open(window.DMG_URL, '_blank', 'noopener'), 1800);
    } catch (e) { /* offline: ignore */ }
  }, 4000);
  addEventListener('resize', () => A.render());
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
