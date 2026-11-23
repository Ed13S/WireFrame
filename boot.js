/* Startup: restore the last sheet (or show the example) and register the offline service worker. */
(function () {
  const A = window.App; let saved = null;
  (async () => {
    let ok = false;
    try { ok = await A.projects.restore(); } catch (e) { console.error(e); }
    if (!ok) { try { await A.loadExample('led'); } catch (e) { console.error(e); A.emit('load'); } A.projects.adoptCurrent(); }
    A.refreshLib(); setTimeout(A.fit, 60);
  })();
  addEventListener('resize', () => A.render());
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
