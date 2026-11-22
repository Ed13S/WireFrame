/* Startup: restore the last sheet (or show the example) and register the offline service worker. */
(function () {
  const A = window.App; let saved = null;
  try { saved = localStorage.getItem('ss_doc'); } catch (e) {}
  (async () => {
    let ok = false;
    if (saved) { try { const o = JSON.parse(saved); if (o && o.parts && (o.parts.length || o.wires.length)) { A.importDoc(o); ok = true; } } catch (e) {} }
    if (!ok) { try { await A.loadExample('led'); } catch (e) { console.error(e); A.emit('load'); } }
    A.refreshLib(); setTimeout(A.fit, 60);
  })();
  addEventListener('resize', () => A.render());
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
