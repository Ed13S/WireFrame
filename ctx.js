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
  A.ctxMenu = menu;
  /* auto-router: orthogonal path with few bends that stays out of parts (Dijkstra on a 1-unit grid, turns cost extra) */
  A.routeOrtho = (x0, y0, x1, y1) => { const pad = 10, minx = Math.min(x0, x1) - pad, maxx = Math.max(x0, x1) + pad, miny = Math.min(y0, y1) - pad, maxy = Math.max(y0, y1) + pad, W = maxx - minx + 1, H = maxy - miny + 1;
    const bl = new Uint8Array(W * H); A.doc.parts.forEach(p => { const b = A.worldBBox(p); for (let x = Math.ceil(b.x0 + .01); x <= Math.floor(b.x1 - .01); x++) for (let y = Math.ceil(b.y0 + .01); y <= Math.floor(b.y1 - .01); y++) { const i = (x - minx) * H + (y - miny); if (x >= minx && x <= maxx && y >= miny && y <= maxy) bl[i] = 1; } });
    const id = (x, y) => (x - minx) * H + (y - miny); bl[id(x0, y0)] = 0; bl[id(x1, y1)] = 0;
    const D = [[1, 0], [0, 1], [-1, 0], [0, -1]], dist = new Float64Array(W * H * 5).fill(1e9), prev = new Int32Array(W * H * 5).fill(-1), heap = [[0, id(x0, y0) * 5 + 4]]; dist[id(x0, y0) * 5 + 4] = 0;
    const push = e => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } }, pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { let m = i; const a = 2 * i + 1, b = a + 1; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
    let goal = -1; while (heap.length) { const [d, s] = pop(); if (d > dist[s]) continue; const c = (s / 5) | 0, dir = s % 5, x = minx + ((c / H) | 0), y = miny + (c % H); if (x === x1 && y === y1) { goal = s; break; }
      for (let k = 0; k < 4; k++) { const nx = x + D[k][0], ny = y + D[k][1]; if (nx < minx || nx > maxx || ny < miny || ny > maxy || bl[id(nx, ny)]) continue; const ns = id(nx, ny) * 5 + k, nd = d + 1 + (dir !== 4 && dir !== k ? 4 : 0); if (nd < dist[ns]) { dist[ns] = nd; prev[ns] = s; push([nd, ns]); } } }
    if (goal < 0) return null; const pts = []; for (let s = goal; s >= 0; s = prev[s]) { const c = (s / 5) | 0; pts.push([minx + ((c / H) | 0), miny + (c % H)]); } pts.reverse();
    const out = [pts[0]]; for (let i = 1; i < pts.length - 1; i++) { const a = pts[i - 1], b = pts[i], c = pts[i + 1]; if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) out.push(b); } out.push(pts[pts.length - 1]); return out; };
  /* split an axis-aligned wire at pt, leaving a 2-unit gap (or none if too short) */
  A.breakWire = (wid, pt) => { const i = A.doc.wires.findIndex(w => w.id === wid); if (i < 0) return; const [x0, y0, x1, y1] = A.doc.wires[i].p, hz = y0 === y1, a = hz ? x0 : y0, b = hz ? x1 : y1, lo = Math.min(a, b), hi = Math.max(a, b), c = hz ? pt.x : pt.y, g = hi - lo >= 6 ? 1 : 0;
    const mk = (u, v) => ({ id: A.id('w'), p: hz ? [u, y0, v, y0] : [x0, u, x0, v] }), out = []; const m1 = Math.max(lo, Math.min(hi, c)) - g, m2 = Math.max(lo, Math.min(hi, c)) + g;
    if (m1 > lo) out.push(mk(lo, m1)); if (m2 < hi) out.push(mk(m2, hi)); A.doc.wires.splice(i, 1, ...out); S.sel = new Set(); A.commit(); A.render(); };
  /* drop a 2-pin part into a wire: part centred on pt, wire re-joined to its two pins */
  A.insertPartInWire = async (defId) => { const q = A._insertWire; A._insertWire = null; if (!q) return false; const w = A.doc.wires.find(x => x.id === q.id); const df = await A.ensureDef(defId); if (!w || !df || df.pins.length < 2) { A.toast('Pick a part with two pins'); return true; }
    const hz = w.p[1] === w.p[3], p0 = df.pins[0], p1 = df.pins[1], axisX = Math.abs(p1.x - p0.x) >= Math.abs(p1.y - p0.y);
    const rot = hz === axisX ? 0 : 1, inst = A.placePart(defId, 0, 0, rot, 0); let ps = A.pinsOf(inst); const mx = (ps[0].x + ps[1].x) / 2, my = (ps[0].y + ps[1].y) / 2; inst.x = Math.round(q.pt.x - mx); inst.y = Math.round(q.pt.y - my); ps = A.pinsOf(inst);
    const k = hz ? 'x' : 'y', ord = ps.slice(0, 2).sort((u, v) => u[k] - v[k]), lo = Math.min(w.p[0], w.p[2]), hi = Math.max(w.p[0], w.p[2]), j = A.doc.wires.indexOf(w), add = [];
    const mk = (a, b, c, d) => { if (a !== c || b !== d) add.push({ id: A.id('w'), p: [a, b, c, d] }); };
    if (hz) { mk(lo, w.p[1], ord[0].x, ord[0].y); mk(ord[1].x, ord[1].y, hi, w.p[1]); } else { mk(w.p[0], lo, ord[0].x, ord[0].y); mk(ord[1].x, ord[1].y, w.p[0], hi); }
    A.doc.wires.splice(j, 1, ...add); S.sel = new Set([inst.id]); A.setTool && A.setTool('select'); A.commit(); A.render(); return true; };
  A.ctxShow = (e, view) => {
    let id = null; const t = document.elementFromPoint(e.clientX, e.clientY);
    if (view === 'build') { const g = t && t.closest && t.closest('[data-id],[data-j],[data-s]'); id = g ? (g.dataset.id && g.dataset.id !== 'ghost' ? g.dataset.id : g.dataset.j ? 'j:' + g.dataset.j : g.dataset.s ? 's:' + g.dataset.s : null) : null;
      if (id && !A.bsel().has(id)) A.bselect([id]); }
    else { const g = t && t.closest && t.closest('#svg [data-id]'); id = g ? g.dataset.id : null; if (id && !S.sel.has(id)) { S.sel = new Set([id]); A.renderProps(); A.render(); } }
    const sel = view === 'build' ? [...A.bsel()] : [...S.sel], has = !!id || sel.length > 0;
    const arr = [{ t: 'Rotate', k: 'R', off: !has, f: () => click('#bRot') }];
    const wr = view !== 'build' && id && (A.doc.wires || []).find(w => w.id === id);
    if (wr && (wr.p[0] === wr.p[2] || wr.p[1] === wr.p[3])) { const pt = { x: Math.round(S.mouse.x), y: Math.round(S.mouse.y) };
      arr.push({ t: 'Break wire here', f: () => A.breakWire(wr.id, pt) }, { t: 'Insert part in this wire…', f: () => { A._insertWire = { id: wr.id, pt }; A.libOpen(true); A.toast('Pick a part: it will be dropped into the wire', 2600); } }, '-'); }
    const w2 = view !== 'build' && id && (A.doc.wires || []).find(w => w.id === id);
    if (w2) arr.push({ t: 'Auto-route this wire', f: () => { const r = A.routeOrtho(w2.p[0], w2.p[1], w2.p[2], w2.p[3]); if (!r) { A.toast('No clear route', 1800); return; } const i = A.doc.wires.indexOf(w2), nw = []; for (let q = 0; q + 1 < r.length; q++) nw.push({ id: A.id('w'), p: [r[q][0], r[q][1], r[q + 1][0], r[q + 1][1]] }); A.doc.wires.splice(i, 1, ...nw); S.sel = new Set(); A.commit(); A.render(); } });
    if (view !== 'build') arr.push({ t: 'Mirror', k: 'X', off: !has, f: () => click('#bMir') });
    arr.push({ t: 'Duplicate', k: A.isMac ? '⌘D' : 'Ctrl+D', off: !has || view === 'build', f: () => keyDown('d', { ctrlKey: !A.isMac, metaKey: A.isMac }) }, { t: 'Delete', k: 'Del', off: !has, f: () => click('#bDel') }, '-',
      { t: 'Bring to front', off: !has, f: () => A.zOrder(sel, 'front') }, { t: 'Bring forward', off: !has, f: () => A.zOrder(sel, 'forward') }, { t: 'Send backward', off: !has, f: () => A.zOrder(sel, 'backward') }, { t: 'Send to back', off: !has, f: () => A.zOrder(sel, 'back') }, '-',
      { t: 'Properties', k: 'E', off: !has, f: () => { A.propsOpen(true); } }, { t: 'Add part…', k: 'A', f: () => A.libOpen(true) });
    if (view === 'build' && [...A.bsel()].some(k => String(k).startsWith('j:'))) { const back = (A.doc.bw || []).some(j => new Set(A.bsel()).has('j:' + j.id) && j.back); arr.push({ t: back ? 'Bring wire in front of parts' : 'Send wire behind parts', f: () => { (A.doc.bw || []).forEach(j => { if (new Set(A.bsel()).has('j:' + j.id)) j.back = !back; }); A.doc.master = 'build'; A.commit(); } }); }
    if (view === 'build') arr.push('-', { t: 'Tidy wires (straighten & avoid parts)', f: () => A.tidyWires() });
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
  /* right-click a part in the parts list: place, pin, delete your own parts */
  document.addEventListener('contextmenu', e => { const pi = e.target.closest && e.target.closest('.pi[data-id]'); if (!pi) return; e.preventDefault(); const id = pi.dataset.id, mine = (A.custom || []).some(c => c.id === id), d = A.def(id); if (!d) return;
    const used = (A.doc.parts || []).some(p => p.def === id);
    A.ctxMenu(e.clientX, e.clientY, [{ t: 'Place on sheet', f: () => pi.click() }, ...(mine ? ['-', { t: 'Delete this part', f: () => { if (used) return A.toast('This part is used on the sheet. Delete those first.', 3000); if (!confirm('Delete "' + (d.name || id) + '" from My parts? This cannot be undone.')) return; A.removeCustom(id); A.refreshLib && A.refreshLib(); A.toast('Deleted ' + (d.name || id)); } }] : [])]); });
})();
