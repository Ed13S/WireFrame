/* Right-click menu (arrange, rotate, delete...), click-to-jump from Check messages in both views, and auto no-connect. */
(function () {
  const A = window.App, S = new Proxy({}, { get: (_, k) => A.S[k], set: (_, k, v) => (A.S[k] = v, true) }), $ = (s, r) => (r || document).querySelector(s);
  const click = id => { const b = $(id); if (b) b.click(); };
  const keyDown = (key, o) => document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, o || {})));
  const lists = () => { const d = A.doc; return [d.parts, d.wires, d.labels, d.notes, d.nc || [], d.bw || []]; };
  const keyOf = (o) => (o.__bw ? 'j:' : '') + o.id;
  A.zOrder = (ids, op) => { const set = new Set(ids); let ch = false;
    lists().forEach((arr, li) => { const sel = arr.filter(o => set.has(li === 5 ? 'j:' + o.id : o.id)); if (!sel.length || !arr.length) return; ch = true;
      if (op === 'front' || op === 'back') { const rest = arr.filter(o => !sel.includes(o)); arr.length = 0; (op === 'front' ? rest.concat(sel) : sel.concat(rest)).forEach(o => arr.push(o)); }
      else { const dir = op === 'forward' ? 1 : -1; const idx = sel.map(o => arr.indexOf(o)).sort((a, b) => dir * (b - a)); idx.forEach(i => { const j = i + dir; if (j < 0 || j >= arr.length || sel.includes(arr[j])) return; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }); } });
    if (ch) { if (A.mode === 'build') A.doc.master = 'build'; A.commit(); } return ch; };
  function menu(x, y, items) { const old = $('#ctxMenu'); if (old) old.remove(); const m = document.createElement('div'); m.id = 'ctxMenu'; m.className = 'ctx';
    m.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : `<button data-i="${i}"${it.off ? ' disabled' : ''}>${it.t}<kbd>${it.k || ''}</kbd></button>`).join('');
    document.body.appendChild(m); const r = m.getBoundingClientRect(); m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 6)) + 'px'; m.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 6)) + 'px';
    m.onclick = e => { const b = e.target.closest('button'); if (!b || b.disabled) return; m.remove(); items[+b.dataset.i].f(); };
    const away = ev => { if (!m.contains(ev.target)) { m.remove(); removeEventListener('pointerdown', away, true); removeEventListener('keydown', away, true); } };
    setTimeout(() => { addEventListener('pointerdown', away, true); addEventListener('keydown', away, true); }, 0); }
  A.ctxShow = (e, view) => {
    let id = null; const t = document.elementFromPoint(e.clientX, e.clientY);
    if (view === 'build') { const g = t && t.closest && t.closest('[data-id],[data-j],[data-s]'); id = g ? (g.dataset.id && g.dataset.id !== 'ghost' ? g.dataset.id : g.dataset.j ? 'j:' + g.dataset.j : g.dataset.s ? 's:' + g.dataset.s : null) : null;
      if (id && !A.bsel().has(id)) A.bselect([id]); }
    else { const g = t && t.closest && t.closest('#svg [data-id]'); id = g ? g.dataset.id : null; if (id && !S.sel.has(id)) { S.sel = new Set([id]); A.renderProps(); A.render(); } }
    const sel = view === 'build' ? [...A.bsel()] : [...S.sel], has = !!id || sel.length > 0;
    const arr = [{ t: 'Rotate', k: 'R', off: !has, f: () => click('#bRot') }];
    if (view !== 'build') arr.push({ t: 'Mirror', k: 'X', off: !has, f: () => click('#bMir') });
    arr.push({ t: 'Duplicate', k: A.isMac ? '⌘D' : 'Ctrl+D', off: !has || view === 'build', f: () => keyDown('d', { ctrlKey: !A.isMac, metaKey: A.isMac }) }, { t: 'Delete', k: 'Del', off: !has, f: () => click('#bDel') }, '-',
      { t: 'Bring to front', off: !has, f: () => A.zOrder(sel, 'front') }, { t: 'Bring forward', off: !has, f: () => A.zOrder(sel, 'forward') }, { t: 'Send backward', off: !has, f: () => A.zOrder(sel, 'backward') }, { t: 'Send to back', off: !has, f: () => A.zOrder(sel, 'back') }, '-',
      { t: 'Properties', k: 'E', off: !has, f: () => { A.propsOpen(true); } }, { t: 'Add part…', k: 'A', f: () => A.libOpen(true) });
    if (view !== 'build') arr.push({ t: 'Fit to window', k: 'F', f: () => keyDown('f') }); menu(e.clientX, e.clientY, arr); };
  /* ---- jump from Check messages ---- */
  A.jumpTo = m => {
    const mm = /\b([A-Z]{1,3}\d+)\b/.exec(m.text || ''); let pt = mm && A.doc.parts.find(p => p.ref === mm[1]);
    if (!pt && m.x !== undefined) { let best = 1e9; A.doc.parts.forEach(p => { A.pinsOf(p).forEach(q => { const dd = Math.hypot(q.x - m.x, q.y - m.y); if (dd < best) { best = dd; pt = p; } }); }); if (best > 3) pt = null; }
    if (A.mode === 'build') { if (!pt || !pt.bb) { A.toast('That one is on the schematic only (it is not placed on the breadboard)', 2400); return; } A.bselect([pt.id]); A.bjump(pt.id); return; }
    let x = m.x, y = m.y; if (x === undefined) { if (!pt) { A.toast('This message is about the whole circuit, so there is nothing to jump to', 2400); return; } const b = A.worldBBox(pt); x = (b.x0 + b.x1) / 2; y = (b.y0 + b.y1) / 2; }
    if (pt) { S.sel = new Set([pt.id]); A.renderProps(); }
    const v = S.view, rect = $('#svg').getBoundingClientRect(); v.tx = rect.width / 2 - x * v.sc; v.ty = rect.height / 2 - y * v.sc; A.applyView(); A.render(); S.marks = [{ x, y }]; A.render(); };
  /* ---- auto no-connect: flag every unconnected pin so the student does not have to place each one ---- */
  A.autoNC = () => { const d = A.doc; d.nc = d.nc || []; let n = 0;
    A.erc().forEach(m => { if (/^Unconnected pin/.test(m.text) && m.x !== undefined && !d.nc.some(c => Math.abs(c.x - m.x) < .3 && Math.abs(c.y - m.y) < .3)) { d.nc.push({ id: A.id('q'), x: m.x, y: m.y }); n++; } });
    if (n) A.commit(); A.toast(n ? 'Added ' + n + ' no-connect flag' + (n === 1 ? '' : 's') : 'No unconnected pins to flag', 1800); return n; };
})();
