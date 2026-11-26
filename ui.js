/* WireFrame UI: canvas interaction, tools, library panel, properties, file menu. */
(function () {
  const A = window.App, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const svg = $('#svg'), NS = 'http://www.w3.org/2000/svg';
  const S = A.S = { tool: 'select', view: { tx: 30, ty: 30, sc: 4 }, sel: new Set(), placing: null, rot: 0, mir: 0, mouse: { x: 0, y: 0 }, drag: null, draft: null, hl: new Set(), marks: [], space: false, clip: null };
  svg.innerHTML = `<defs><pattern id="gridp" width="1" height="1" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".07" fill="var(--grid)"/></pattern></defs><g id="world"><rect id="gridr" x="0" y="0" width="${A.SHEET.w}" height="${A.SHEET.h}" fill="url(#gridp)" pointer-events="none"/><g id="doc"></g><g id="ov" pointer-events="none"></g></g>`;
  const world = $('#world', svg), docG = $('#doc', svg), ov = $('#ov', svg), gridp = $('#gridp', svg), gridr = $('#gridr', svg);

  /* ---------- helpers ---------- */
  A.toast = (t, ms) => { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(A._tt); A._tt = setTimeout(() => e.hidden = true, ms || 2600); };
  const snap = v => Math.round(v);
  const toGrid = (cx, cy) => { const r = svg.getBoundingClientRect(), v = S.view; return [(cx - r.left - v.tx) / v.sc, (cy - r.top - v.ty) / v.sc]; };
  function snapPt(x, y, wireMode) {
    let best = null, bd = 1.4 * 1.4;
    A.doc.parts.forEach(i => A.pinsOf(i).forEach(p => { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = [p.x, p.y, 'pin']; } }));
    if (wireMode) { A.doc.wires.forEach(w => [[w.p[0], w.p[1]], [w.p[2], w.p[3]]].forEach(([ex, ey]) => { const d = (ex - x) ** 2 + (ey - y) ** 2; if (d < bd) { bd = d; best = [ex, ey, 'end']; } }));
      A.doc.labels.forEach(l => { const d = (l.x - x) ** 2 + (l.y - y) ** 2; if (d < bd) { bd = d; best = [l.x, l.y, 'label']; } }); }
    if (best) return best; const sx = snap(x), sy = snap(y);
    if (wireMode && A.doc.wires.some(w => A.onSeg(sx, sy, w))) return [sx, sy, 'wire'];
    return [sx, sy, null];
  }
  function applyView() { const v = S.view; world.setAttribute('transform', `translate(${v.tx} ${v.ty}) scale(${v.sc})`);
    const g = v.sc >= 7 ? 1 : v.sc >= 3 ? 5 : 10; gridp.setAttribute('width', g); gridp.setAttribute('height', g); gridr.setAttribute('width', A.SHEET.w); gridr.setAttribute('height', A.SHEET.h);
    const gs = S.gi || 0; svg.classList.toggle('gridoff', gs === 2); gridr.style.display = 'none';
    gridp.innerHTML = gs === 1 ? `<path d="M${g} 0H0V${g}" fill="none" stroke="var(--grid)" stroke-width=".04"/>` : `<circle cx="0" cy="0" r="${g === 1 ? .09 : .14 * g / 2}" fill="var(--grid)"/>`; $('#stZoom').textContent = Math.round(v.sc / 10 * 100) + '%'; }
  const GRIDS = [['Dots'], ['Lines'], ['Off']]; S.gi = 0;
  function cycleGrid() { S.gi = (S.gi + 1) % 3; try { localStorage.setItem('wf_grid', S.gi); } catch (e) {} applyView(); A.toast('Grid: ' + GRIDS[S.gi][0], 1200); }
  try { S.gi = Math.min(2, +localStorage.getItem('wf_grid') || 0); } catch (e) {}
  A.cycleGrid = cycleGrid; A.applyView = applyView;
  function zoomAt(cx, cy, f) { const v = S.view, r = svg.getBoundingClientRect(), mx = cx - r.left, my = cy - r.top, ns = Math.max(1.2, Math.min(40, v.sc * f)), k = ns / v.sc;
    v.tx = mx - (mx - v.tx) * k; v.ty = my - (my - v.ty) * k; v.sc = ns; applyView(); }
  A.fitContent = () => { const r = svg.getBoundingClientRect(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const d = A.doc;
    const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    d.parts.forEach(i => { const b = A.worldBBox(i); add(b.x0 - 4, b.y0 - 4); add(b.x1 + 4, b.y1 + 4); }); d.wires.forEach(w => { add(w.p[0], w.p[1]); add(w.p[2], w.p[3]); }); d.labels.forEach(l => add(l.x, l.y));
    if (x0 > x1) { x0 = 0; y0 = 0; x1 = A.SHEET.w; y1 = A.SHEET.h; }
    const w = x1 - x0, h = y1 - y0, sc = Math.max(1.2, Math.min(18, Math.min((r.width - 40) / w, (r.height - 70) / h))); S.view = { sc, tx: (r.width - w * sc) / 2 - x0 * sc, ty: (r.height - 40 - h * sc) / 2 - y0 * sc }; applyView(); };

  A.fit = () => { const r = svg.getBoundingClientRect(), W = A.SHEET.w, H = A.SHEET.h, sc = Math.max(1.2, Math.min(18, Math.min((r.width - 30) / W, (r.height - 30) / H))); S.view = { sc, tx: (r.width - W * sc) / 2, ty: (r.height - H * sc) / 2 }; applyView(); };
  A.centerContent = () => { const d = A.doc; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    d.parts.forEach(i => { const b = A.worldBBox(i); add(b.x0, b.y0); add(b.x1, b.y1); }); d.wires.forEach(w => { add(w.p[0], w.p[1]); add(w.p[2], w.p[3]); }); d.labels.forEach(l => add(l.x, l.y)); if (x0 > x1) return;
    const dx = Math.round((A.SHEET.w - (x1 - x0)) / 2 - x0), dy = Math.round((A.SHEET.h - 40 - (y1 - y0)) / 2 - y0); if (!dx && !dy) return;
    d.parts.forEach(p => { p.x += dx; p.y += dy; }); d.wires.forEach(w => { w.p = [w.p[0] + dx, w.p[1] + dy, w.p[2] + dx, w.p[3] + dy]; }); d.labels.forEach(l => { l.x += dx; l.y += dy; }); d.notes.forEach(l => { l.x += dx; l.y += dy; }); };

  /* ---------- rendering ---------- */
  let raf = 0;
  A.render = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
  function draw() { docG.innerHTML = A.worldSVG({ sel: S.sel, hl: S.hl, marks: S.marks }); drawOverlay(); updateButtons(); }
  function drawOverlay() {
    let o = ''; const [mx, my] = [S.mouse.x, S.mouse.y];
    if (S.placing) { const def = A.def(S.placing); if (def) o += A.partSVG({ id: 'ghost', def: S.placing, x: mx, y: my, rot: S.rot, mir: S.mir, ref: A.nextRef(def.ref), value: def.value }, { ghost: true }); }
    if (S.tool === 'wire') { o += `<circle class="snapdot" cx="${mx}" cy="${my}" r=".7"/>`; if (S.draft) o += draftSVG(); }
    if (S.tool === 'label' || S.tool === 'text') o += `<circle class="snapdot" cx="${mx}" cy="${my}" r=".7"/>`;
    if (S.drag && S.drag.type === 'rubber') { const d = S.drag; o += `<rect class="rubber" x="${Math.min(d.x0, d.x1)}" y="${Math.min(d.y0, d.y1)}" width="${Math.abs(d.x1 - d.x0)}" height="${Math.abs(d.y1 - d.y0)}"/>`; }
    ov.innerHTML = o;
  }
  const elbow = (a, b, hfirst) => hfirst ? [[a[0], a[1], b[0], a[1]], [b[0], a[1], b[0], b[1]]] : [[a[0], a[1], a[0], b[1]], [a[0], b[1], b[0], b[1]]];
  function draftSegs() { const d = S.draft; if (!d) return []; const last = d.pts[d.pts.length - 1], m = [S.mouse.x, S.mouse.y];
    if (last[0] === m[0] && last[1] === m[1]) return []; const hf = d.hfirst === undefined ? Math.abs(m[0] - last[0]) >= Math.abs(m[1] - last[1]) : d.hfirst;
    return elbow(last, m, hf).filter(s => s[0] !== s[2] || s[1] !== s[3]); }
  function draftSVG() { return draftSegs().map(s => `<line class="wire" x1="${s[0]}" y1="${s[1]}" x2="${s[2]}" y2="${s[3]}" opacity=".75"/>`).join(''); }

  /* ---------- selection / editing ops ---------- */
  const findItem = id => A.doc.parts.find(p => p.id === id) || A.doc.wires.find(p => p.id === id) || A.doc.labels.find(p => p.id === id) || A.doc.notes.find(p => p.id === id) || (A.doc.nc || []).find(p => p.id === id);
  A.select = (ids) => { S.sel = new Set(ids); S.hl = new Set(); renderProps(); A.render(); };
  function deleteSel() { if (!S.sel.size) return; const d = A.doc, s = S.sel; d.parts = d.parts.filter(p => !s.has(p.id)); d.wires = d.wires.filter(p => !s.has(p.id)); d.labels = d.labels.filter(p => !s.has(p.id)); d.notes = d.notes.filter(p => !s.has(p.id)); d.nc = (d.nc || []).filter(p => !s.has(p.id)); S.sel = new Set(); A.commit(); }
  function rotateSel(dir) { if (S.placing) { S.rot = (S.rot + 1) % 4; drawOverlay(); return; } let ch = false;
    A.doc.parts.forEach(p => { if (S.sel.has(p.id)) { p.rot = ((p.rot || 0) + (dir || 1) + 4) % 4; ch = true; } }); if (ch) A.commit(); }
  function mirrorSel() { if (S.placing) { S.mir ^= 1; drawOverlay(); return; } let ch = false; A.doc.parts.forEach(p => { if (S.sel.has(p.id)) { p.mir = p.mir ? 0 : 1; ch = true; } }); if (ch) A.commit(); }
  function copySel() { const d = A.doc, s = S.sel; if (!s.size) return; S.clip = JSON.stringify({ parts: d.parts.filter(p => s.has(p.id)), wires: d.wires.filter(p => s.has(p.id)), labels: d.labels.filter(p => s.has(p.id)), notes: d.notes.filter(p => s.has(p.id)), nc: (d.nc || []).filter(p => s.has(p.id)) }); A.toast('Copied'); }
  function paste(dx, dy) { if (!S.clip) return; const c = JSON.parse(S.clip), ids = []; dx = dx === undefined ? 2 : dx; dy = dy === undefined ? 2 : dy;
    c.parts.forEach(p => { const n = Object.assign({}, p, { id: A.id('p'), x: p.x + dx, y: p.y + dy }); const df = A.def(n.def); if (df && !(n.ref || '').startsWith('#')) n.ref = A.nextRef(df.ref); A.doc.parts.push(n); ids.push(n.id); });
    c.wires.forEach(w => { const n = { id: A.id('w'), p: [w.p[0] + dx, w.p[1] + dy, w.p[2] + dx, w.p[3] + dy] }; A.doc.wires.push(n); ids.push(n.id); });
    c.labels.forEach(l => { const n = Object.assign({}, l, { id: A.id('l'), x: l.x + dx, y: l.y + dy }); A.doc.labels.push(n); ids.push(n.id); });
    c.notes.forEach(l => { const n = Object.assign({}, l, { id: A.id('n'), x: l.x + dx, y: l.y + dy }); A.doc.notes.push(n); ids.push(n.id); });
    A.commit(); A.select(ids); S.clip = JSON.stringify({ parts: A.doc.parts.filter(p => ids.includes(p.id)), wires: A.doc.wires.filter(p => ids.includes(p.id)), labels: A.doc.labels.filter(p => ids.includes(p.id)), notes: A.doc.notes.filter(p => ids.includes(p.id)) }); }
  A.placePart = (defId, x, y, rot, mir) => { const df = A.def(defId); const inst = { id: A.id('p'), def: defId, x, y, rot: rot || 0, mir: mir || 0, ref: A.nextRef(df.ref || 'U'), value: df.value || df.name }; A.doc.parts.push(inst); return inst; };

  /* ---------- tools ---------- */
  function idsAt(x, y) { const seen = new Set(), out = []; document.elementsFromPoint(x, y).forEach(el => { const g = el.closest && el.closest('[data-id]'); if (g && svg.contains(g) && !seen.has(g.dataset.id)) { seen.add(g.dataset.id); out.push(g.dataset.id); } }); return out; }
  function overlapMenu(ids, x, y) { const old = $('#ovMenu'); if (old) old.remove(); const m = document.createElement('div'); m.id = 'ovMenu'; m.style.cssText = `left:${Math.min(x, innerWidth - 190)}px;top:${Math.min(y, innerHeight - 30 - ids.length * 28)}px`;
    m.innerHTML = '<div class="ovh">Select which item</div>' + ids.map(id => { const it = findItem(id) || {}; const nm = it.def ? (it.ref || '?') + ' (' + (it.def.name || it.def) + ')' : it.text !== undefined && it.p === undefined ? (it.size !== undefined || id[0] === 'n' ? 'Note: ' : 'Label: ') + it.text : it.p ? 'Wire' : id[0] === 'q' ? 'No-connect flag' : id; return `<button data-i="${id}">${esc ? esc(String(nm)) : nm}</button>`; }).join('');
    m.onclick = ev => { const b = ev.target.closest('button'); if (b) { S.sel = new Set([b.dataset.i]); m.remove(); renderProps(); A.render(); } }; document.body.appendChild(m); setTimeout(() => addEventListener('pointerdown', function f(ev) { if (!m.contains(ev.target)) { m.remove(); removeEventListener('pointerdown', f); } }), 0); }
  function propsOpen(on) { document.body.classList.toggle('propsopen', on); } A.propsOpen = propsOpen;
  $('#bProps').onclick = () => propsOpen(!document.body.classList.contains('propsopen')); $('#bPropsX').onclick = () => propsOpen(false);
  function libOpen(on) { document.body.classList.toggle('libopen', on); if (on) { const q = $('#q'); if (q) { q.focus(); q.select(); } } }
  A.libOpen = libOpen; $('#bAdd').onclick = () => libOpen(!document.body.classList.contains('libopen')); $('#bLibX').onclick = () => libOpen(false);
  $('#q').addEventListener('keydown', e => { if (e.key === 'Escape') { libOpen(false); svg.focus(); } });
  if ($('#quick')) $('#quick').onclick = e => { const b = e.target.closest('[data-q]'); if (b) { libOpen(false); A.startPlacing(b.dataset.q); } };
  $('#partList').addEventListener('click', e => { if (e.target.closest('.pi') && !e.target.closest('.pinb')) setTimeout(() => libOpen(false), 0); });
  function setTool(t) { S.tool = t; if (t !== 'place') S.placing = null; if (t !== 'wire') S.draft = null;
    $$('.tool').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); svg.style.cursor = t === 'select' ? 'default' : 'crosshair';
    $('#hint').textContent = { select: 'Click to select, drag to move, drag on empty space to box-select. Click a wire to highlight its net.', wire: 'Click to start a wire, click again to bend or finish. Click on a pin to connect. Esc or double-click to stop.', label: 'Click on a wire or pin to name the net.', text: 'Click to place a note.', nc: 'Click a pin to add a no-connect flag (X). Click a flag again to remove it. Esc to stop.', place: 'Click to place. R rotates, M mirrors, Esc stops placing.' }[t] || ''; A.render(); }
  A.setTool = setTool;
  $$('.tool').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  $('#bRot').onclick = () => rotateSel(1); $('#bMir').onclick = mirrorSel; $('#bDel').onclick = deleteSel; $('#bUndo').onclick = A.undo; $('#bRedo').onclick = A.redo; $('#bFit').onclick = A.fit;
  function updateButtons() { $('#bUndo').disabled = A.hist.length < 2; $('#bRedo').disabled = !A.fut.length; }
  A.startPlacing = async (id) => { const df = await A.ensureDef(id); if (!df) return A.toast('Could not load that part'); S.placing = id; S.rot = 0; S.mir = 0; setTool('place'); $$('.pi').forEach(e => e.classList.toggle('on', e.dataset.id === id)); };

  function askText(title, init, cb, multi) {
    const host = $('#modalHost'); host.innerHTML = `<div class="back"><div class="modal" style="width:min(420px,100%)"><header><b>${esc(title)}</b></header><div class="mb"><input id="askIn" value="${esc(init || '')}" autocomplete="off"></div><footer><button id="askNo">Cancel</button><button id="askOk" class="accent">OK</button></footer></div></div>`;
    const inp = $('#askIn'); inp.focus(); inp.select(); const close = () => host.innerHTML = '';
    const ok = () => { const v = inp.value.trim(); close(); if (v) cb(v); }; $('#askOk').onclick = ok; $('#askNo').onclick = close;
    inp.onkeydown = e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') close(); e.stopPropagation(); };
  }
  A.askText = askText;

  /* ---------- pointer interaction ---------- */
  const hitId = (t) => { const g = t.closest && t.closest('[data-id]'); return g && g.dataset.id !== 'ghost' ? g.dataset.id : null; };
  let panning = null;
  svg.addEventListener('contextmenu', e => e.preventDefault());
  svg.addEventListener('wheel', e => { e.preventDefault();
    const mouseWheel = Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY) && !e.deltaX;
    if (e.ctrlKey || e.metaKey || mouseWheel) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0018)));
    else { S.view.tx -= e.deltaX; S.view.ty -= e.deltaY; applyView(); } }, { passive: false });
  svg.addEventListener('pointerdown', e => {
    svg.focus({ preventScroll: true }); svg.setPointerCapture(e.pointerId);
    if (e.button === 1 || e.button === 2 || S.space) { panning = { x: e.clientX, y: e.clientY, tx: S.view.tx, ty: S.view.ty, right: e.button === 2, moved: false }; svg.style.cursor = 'grabbing'; return; }
    if (e.button !== 0) return;
    if (S.drag && S.drag.sticky) { const dd = S.drag; S.drag = null; if (dd.moved) { fixDiagonals(dd); A.commit(); } A.render(); return; }
    const [gx, gy] = toGrid(e.clientX, e.clientY); const wm = S.tool === 'wire'; const [sx, sy, kind] = snapPt(gx, gy, wm || S.tool === 'label'); S.mouse = { x: sx, y: sy };
    if (S.tool === 'place' && S.placing) { const i = A.placePart(S.placing, sx, sy, S.rot, S.mir); A.commit(); S.sel = new Set([i.id]); renderProps(); A.render(); return; }
    if (S.tool === 'wire') { if (!S.draft) { S.draft = { pts: [[sx, sy]] }; A.render(); return; }
      const segs = draftSegs(); if (segs.length) { segs.forEach(s => A.doc.wires.push({ id: A.id('w'), p: s })); S.draft.pts.push([sx, sy]); S.draft.hfirst = undefined; S.draft.n = (S.draft.n || 0) + 1;
        if (kind) { S.draft = null; } A.commit(); } return; }
    if (S.tool === 'label') { const lbl = A.nets().find(n => n.points.includes(A.key(sx, sy))); askText('Net label name', lbl && !lbl.auto ? lbl.name : '', v => { A.doc.labels.push({ id: A.id('l'), x: sx, y: sy, text: v }); A.commit(); }); return; }
    if (S.tool === 'nc') { const nc = A.doc.nc = A.doc.nc || [], i = nc.findIndex(c => Math.abs(c.x - sx) < .3 && Math.abs(c.y - sy) < .3); if (i >= 0) nc.splice(i, 1); else nc.push({ id: A.id('q'), x: sx, y: sy }); A.commit(); return; }
    if (S.tool === 'text') { askText('Note text', '', v => { A.doc.notes.push({ id: A.id('n'), x: sx, y: sy, text: v }); A.commit(); }); return; }
    // select tool
    const id = hitId(e.target);
    if (id && A.simPointer && A.simPointer(id, 'down')) return;
    if (e.altKey) { const ids = idsAt(e.clientX, e.clientY); if (ids.length) { e.preventDefault(); overlapMenu(ids, e.clientX, e.clientY); return; } }
    clearTimeout(S.lp); if (id) { const cx = e.clientX, cy = e.clientY; S.lp = setTimeout(() => { if (S.drag && !S.drag.moved && S.drag.type === 'move') { const ids = idsAt(cx, cy); if (ids.length > 1) { S.drag = null; overlapMenu(ids, cx, cy); } } }, 650); }
    if (id) { if (e.shiftKey && (e.ctrlKey || e.metaKey)) { S.sel.delete(id); } else if (e.ctrlKey || e.metaKey) { S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); } else if (e.shiftKey) { S.sel.add(id); } else if (!S.sel.has(id)) S.sel = new Set([id]);
      S.hl = new Set(); S.drag = { type: 'move', x0: gx, y0: gy, last: [snap(gx), snap(gy)], moved: false, clickId: id, orig: null }; renderProps(); A.render(); }
    else { if (!e.shiftKey) S.sel = new Set(); S.hl = new Set(); S.drag = { type: 'rubber', x0: gx, y0: gy, x1: gx, y1: gy, shift: e.shiftKey }; renderProps(); A.render(); }
  });
  function startMove(d) { const d0 = A.doc; d.orig = { parts: [], wires: [], labels: [], notes: [], att: [] };
    d0.parts.forEach(p => S.sel.has(p.id) && d.orig.parts.push([p, p.x, p.y])); d0.wires.forEach(w => S.sel.has(w.id) && d.orig.wires.push([w, w.p.slice()]));
    d0.labels.forEach(l => S.sel.has(l.id) && d.orig.labels.push([l, l.x, l.y])); d0.notes.forEach(l => S.sel.has(l.id) && d.orig.notes.push([l, l.x, l.y]));
    const pins = new Set(); d0.parts.forEach(p => { if (S.sel.has(p.id)) A.pinsOf(p).forEach(q => pins.add(A.key(q.x, q.y))); });
    d0.labels.forEach(l => { if (S.sel.has(l.id)) pins.add(A.key(l.x, l.y)); });
    d0.wires.forEach(w => { if (S.sel.has(w.id)) return; [0, 2].forEach(k => { if (pins.has(A.key(w.p[k], w.p[k + 1]))) d.orig.att.push([w, k, w.p.slice()]); }); }); }
  svg.addEventListener('pointermove', e => {
    if (panning) { const dx = e.clientX - panning.x, dy = e.clientY - panning.y; if (Math.abs(dx) + Math.abs(dy) > 3) panning.moved = true; S.view.tx = panning.tx + dx; S.view.ty = panning.ty + dy; applyView(); return; }
    const [gx, gy] = toGrid(e.clientX, e.clientY); const [sx, sy] = snapPt(gx, gy, S.tool === 'wire'); S.mouse = { x: sx, y: sy }; $('#stPos').textContent = `${sx}, ${sy}`;
    if (S.draft) { const dd = S.draft, last = dd.pts[dd.pts.length - 1], ddx = sx - last[0], ddy = sy - last[1];
      if (!ddx && !ddy) dd.hfirst = undefined; else if (dd.hfirst === undefined) { if (!ddx) dd.hfirst = false; else if (!ddy) dd.hfirst = true; else if (Math.abs(ddx) !== Math.abs(ddy)) dd.hfirst = Math.abs(ddx) > Math.abs(ddy); } }
    const d = S.drag;
    if (d && d.type === 'move') { const nx = snap(gx), ny = snap(gy); if (!d.moved && (Math.abs(gx - d.x0) + Math.abs(gy - d.y0)) < .6) return; if (!d.orig) { startMove(d); } d.moved = true;
      const dx = nx - snap(d.x0), dy = ny - snap(d.y0); d.orig.parts.forEach(([p, x, y]) => { p.x = x + dx; p.y = y + dy; }); d.orig.labels.forEach(([p, x, y]) => { p.x = x + dx; p.y = y + dy; }); d.orig.notes.forEach(([p, x, y]) => { p.x = x + dx; p.y = y + dy; });
      d.orig.wires.forEach(([w, o]) => { w.p = [o[0] + dx, o[1] + dy, o[2] + dx, o[3] + dy]; }); d.orig.att.forEach(([w, k, o]) => { w.p = o.slice(); w.p[k] = o[k] + dx; w.p[k + 1] = o[k + 1] + dy; }); A.render(); return; }
    if (d && d.type === 'rubber') { d.x1 = gx; d.y1 = gy; drawOverlay(); return; }
    drawOverlay();
  });
  svg.addEventListener('pointerup', e => {
    if (panning) { const was = panning; panning = null; svg.style.cursor = S.tool === 'select' ? 'default' : 'crosshair'; if (was.right && !was.moved) { if (S.draft) { finishWire(); } else if (S.placing) { S.placing = null; setTool('select'); } } return; }
    if (A.simPointer) A.simPointer(null, 'up');
    if (S.drag && S.drag.sticky) return; const d = S.drag; S.drag = null; if (!d) return;
    if (d.type === 'move') { if (d.moved) { fixDiagonals(d); A.commit(); }
      else { const id = d.clickId, it = findItem(id); if (it && it.p && !e.shiftKey) { const n = A.nets().find(n => n.wires.includes(id)); if (n) { S.hl = new Set(n.wires); $('#stNet').textContent = 'Net: ' + n.name + ' (' + n.pins.map(p => p.inst.ref + '.' + p.n).join(', ') + ')'; } } A.render(); } }
    if (d.type === 'rubber') { const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
      if (x1 - x0 > .4 || y1 - y0 > .4) { const ids = new Set(d.shift ? S.sel : []); const D = A.doc;
        D.parts.forEach(p => { const b = A.worldBBox(p); if (b.x0 >= x0 && b.x1 <= x1 && b.y0 >= y0 && b.y1 <= y1) ids.add(p.id); });
        D.wires.forEach(w => { if (Math.min(w.p[0], w.p[2]) >= x0 && Math.max(w.p[0], w.p[2]) <= x1 && Math.min(w.p[1], w.p[3]) >= y0 && Math.max(w.p[1], w.p[3]) <= y1) ids.add(w.id); });
        D.labels.forEach(l => { if (l.x >= x0 && l.x <= x1 && l.y >= y0 && l.y <= y1) ids.add(l.id); }); D.notes.forEach(l => { if (l.x >= x0 && l.x <= x1 && l.y >= y0 && l.y <= y1) ids.add(l.id); });
        S.sel = ids; } renderProps(); A.render(); }
  });
  function fixDiagonals(d) { d.orig.att.forEach(([w, k, o]) => { if (w.p[0] !== w.p[2] && w.p[1] !== w.p[3]) { const fixed = k === 0 ? [w.p[2], w.p[3]] : [w.p[0], w.p[1]], mv = k === 0 ? [w.p[0], w.p[1]] : [w.p[2], w.p[3]];
      const wasH = o[1] === o[3], e = wasH ? [mv[0], fixed[1]] : [fixed[0], mv[1]]; A.doc.wires = A.doc.wires.filter(x => x !== w);
      [[fixed, e], [e, mv]].forEach(([a, b]) => { if (a[0] !== b[0] || a[1] !== b[1]) A.doc.wires.push({ id: A.id('w'), p: [a[0], a[1], b[0], b[1]] }); }); } }); }
  function finishWire() { S.draft = null; A.render(); }
  svg.addEventListener('dblclick', e => { if (S.draft) { finishWire(); return; } if (document.elementsFromPoint(e.clientX, e.clientY).some(n => n.hasAttribute && n.hasAttribute('data-tb'))) { A.sheetDialog && A.sheetDialog(); return; } const id = hitId(e.target), it = id && findItem(id); if (it && it.text !== undefined) { askText('Edit text', it.text, v => { it.text = v; A.commit(); }); } else if (it && it.def) { const i = $('#pRef'); if (i) { i.focus(); i.select(); } } });
  addEventListener('keyup', e => { if (e.code === 'Space') { S.space = false; svg.style.cursor = S.tool === 'select' ? 'default' : 'crosshair'; } });
  addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if ($('#modalHost').firstChild) return; const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (e.code === 'Space') { S.space = true; svg.style.cursor = 'grab'; e.preventDefault(); return; }
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? A.redo() : A.undo(); return; } if (mod && k === 'y') { e.preventDefault(); A.redo(); return; }
    if (mod && k === 'c') { copySel(); return; } if (mod && k === 'x') { copySel(); deleteSel(); return; } if (mod && k === 'v') { e.preventDefault(); paste(); return; }
    if (mod && k === 'd') { e.preventDefault(); copySel(); paste(); return; } if (mod && k === 'a') { e.preventDefault(); A.select([...A.doc.parts, ...A.doc.wires, ...A.doc.labels, ...A.doc.notes, ...(A.doc.nc || [])].map(x => x.id)); return; }
    if (e.ctrlKey && k === 'f1') { e.preventDefault(); A.shortcutsDialog && A.shortcutsDialog(); return; }
    if (mod && k === 's') { e.preventDefault(); A.saveFile(); return; } if (mod) return;
    if (A.buildKey && A.buildKey(e, k)) return;
    if (k === 'escape' && document.body.classList.contains('libopen')) { libOpen(false); return; }
    if (k === 'escape') { if (S.drag && S.drag.sticky) { const dd = S.drag; S.drag = null; if (dd.orig) { dd.orig.parts.forEach(([p, x, y]) => { p.x = x; p.y = y; }); dd.orig.labels.forEach(([p, x, y]) => { p.x = x; p.y = y; }); dd.orig.notes.forEach(([p, x, y]) => { p.x = x; p.y = y; }); dd.orig.wires.forEach(([w, o]) => { w.p = o; }); dd.orig.att.forEach(([w, kk, o]) => { w.p = o; }); } A.render(); } else if (S.draft) finishWire(); else if (S.placing || S.tool !== 'select') setTool('select'); else A.select([]); return; }
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSel(); return; }
    const sel1 = () => [...S.sel].map(findItem).filter(Boolean)[0], focus = id => { const i = $(id); if (i) { i.focus(); i.select(); } };
    const startGrab = () => { if (!S.sel.size) return; const d = { type: 'move', x0: S.mouse.x, y0: S.mouse.y, last: [S.mouse.x, S.mouse.y], moved: false, clickId: null, orig: null, sticky: true }; startMove(d); S.drag = d; A.toast('Move: click to drop, Esc to cancel', 1800); };
    if (e.ctrlKey && k === 'home' || (e.shiftKey && k === 'home')) A.fitContent();
    else if (k === 'q') setTool('nc');
    else if (k === 'a') { e.preventDefault(); setTool('select'); libOpen(!document.body.classList.contains('libopen')); } else if (k === 'i') propsOpen(!document.body.classList.contains('propsopen'));
    else if (k === 'p') { e.preventDefault(); const c = $$('#cats [data-cat]').find(b => b.dataset.cat === 'Power'); libOpen(true); if (c) c.click(); const q = $('#q'); if (q) { q.value = ''; q.focus(); } }
    else if (k === 'w') setTool('wire'); else if (k === 'l') setTool('label'); else if (k === 't') setTool('text'); else if (k === 'j') { setTool('wire'); A.toast('Junction dots appear automatically where wires meet or end on a wire', 2600); } else if (k === 's') setTool('select');
    else if (k === 'r') rotateSel(1); else if (k === 'x') { rotateSel(2); mirrorSel(); } else if (k === 'y') mirrorSel();
    else if (k === 'm' || k === 'g') startGrab();
    else if (k === 'c') { copySel(); paste(); startGrab(); }
    else if (k === 'e') { e.preventDefault(); const it = sel1(); if (it && it.def) { propsOpen(true); focus('#pRef'); } else if (it && it.text !== undefined) askText('Edit text', it.text, v => { it.text = v; A.commit(); }); else if (!it) A.sheetDialog && A.sheetDialog(); }
    else if (k === 'v') { e.preventDefault(); propsOpen(true); focus('#pVal'); } else if (k === 'u') { e.preventDefault(); propsOpen(true); focus('#pRef'); }
    else if (k === 'f' || k === 'home') A.fit(); else if (k === '?' || (e.shiftKey && k === '/')) A.shortcutsDialog && A.shortcutsDialog();
    else if (k === 'n' && S.tool === 'wire' && S.draft) finishWire();
    else if (k === 'n') cycleGrid();
    else if (k === '=' || k === '+') zoomAt(svg.clientWidth / 2 + svg.getBoundingClientRect().left, svg.clientHeight / 2 + svg.getBoundingClientRect().top, 1.25); else if (k === '-') zoomAt(svg.clientWidth / 2 + svg.getBoundingClientRect().left, svg.clientHeight / 2 + svg.getBoundingClientRect().top, .8);
    else if (k.startsWith('arrow') && S.sel.size) { e.preventDefault(); const dx = k === 'arrowleft' ? -1 : k === 'arrowright' ? 1 : 0, dy = k === 'arrowup' ? -1 : k === 'arrowdown' ? 1 : 0;
      A.doc.parts.forEach(p => S.sel.has(p.id) && (p.x += dx, p.y += dy)); A.doc.labels.forEach(p => S.sel.has(p.id) && (p.x += dx, p.y += dy)); A.doc.notes.forEach(p => S.sel.has(p.id) && (p.x += dx, p.y += dy)); A.doc.wires.forEach(w => S.sel.has(w.id) && (w.p = [w.p[0] + dx, w.p[1] + dy, w.p[2] + dx, w.p[3] + dy])); A.commit(); }
  });

  /* ---------- properties panel ---------- */
  function renderProps() {
    const b = $('#propBody'), sel = [...S.sel].map(findItem).filter(Boolean);
    if (!sel.length) { const m = A.doc.meta; b.innerHTML = `<div class="row"><label>Title</label><input id="mTitle" value="${esc(m.title)}"></div><div class="row"><label>Author</label><input id="mAuth" value="${esc(m.author)}"></div><div class="row"><label>Date</label><input id="mDate" value="${esc(m.date)}"></div><p class="muted">${A.doc.parts.length} parts, ${A.doc.wires.length} wires. Nothing selected.</p>`;
      ['Title:title', 'Auth:author', 'Date:date'].forEach(s => { const [i, k] = s.split(':'); $('#m' + i).onchange = e => { A.doc.meta[k] = e.target.value; A.commit(); }; }); return; }
    if (sel.length > 1) { b.innerHTML = `<p>${sel.length} items selected.</p><button id="pDel" class="danger">Delete selection</button>`; $('#pDel').onclick = deleteSel; return; }
    const it = sel[0];
    if (it.def) { const df = A.def(it.def) || {}; b.innerHTML = `<div id="pPrev" class="pvw"></div><div class="row"><label>Part</label><span>${esc(df.name || it.def)}</span></div>${df.desc ? `<p class="note">${esc(df.desc)}</p>` : ''}${df.power ? '' : `<div class="row"><label>Ref</label><input id="pRef" value="${esc(it.ref || '')}"></div>`}<div class="row"><label>${df.power ? 'Net' : 'Value'}</label><input id="pVal" value="${esc(it.value || '')}"></div>${df.power ? '' : `<div class="row"><label>Footprint</label><input id="pFp" placeholder="e.g. Resistor_THT:R_Axial_DIN0207…" value="${esc(it.footprint || '')}"></div>`}
        <div class="row"><button id="pRot">Rotate</button><button id="pMir">Mirror</button><button id="pDel" class="danger">Delete</button></div>${df.custom ? '<div class="row"><button id="pEdit">Edit this part…</button></div>' : ''}
        <div class="note">${df.pins.length} pins${df.pins.length < 17 ? ': ' + df.pins.map(p => esc(p.n + (p.name ? ' ' + p.name : ''))).join(', ') : ''}</div>`;
      const r = $('#pRef'); if (r) r.onchange = e => { it.ref = e.target.value; A.commit(); }; $('#pVal').onchange = e => { it.value = e.target.value; A.commit(); }; const fp = $('#pFp'); if (fp) fp.onchange = e => { it.footprint = e.target.value.trim(); A.commit(); };
      const drawPrev = () => { const bb = A.bbox(df), w = bb.x1 - bb.x0 + 11, h = bb.y1 - bb.y0 + 8, rf = $('#pRef'), vv = $('#pVal'), tmp = Object.assign({}, it, { rot: 0 });
        $('#pPrev').innerHTML = `<svg viewBox="${bb.x0 - 3} ${bb.y0 - 4} ${w} ${h}" preserveAspectRatio="xMidYMid meet"><g class="pvg">${A.symbolInner(df, tmp)}<text class="s-ref" x="${bb.x1 + 1.5}" y="${bb.y0 + .6}" font-size="1.6">${esc(rf ? rf.value : it.ref || '')}</text><text class="s-val" x="${bb.x1 + 1.5}" y="${bb.y0 + 2.8}" font-size="1.5">${esc(vv ? vv.value : it.value || '')}</text></g></svg>`; };
      drawPrev(); ['#pRef', '#pVal'].forEach(q => { const el = $(q); if (el) el.addEventListener('input', drawPrev); });
      $('#pRot').onclick = () => rotateSel(1); $('#pMir').onclick = mirrorSel; $('#pDel').onclick = deleteSel; const pe = $('#pEdit'); if (pe) pe.onclick = () => A.editPart && A.editPart(df.id); if (A.simProps) A.simProps(it, b); return; }
    if (it.text !== undefined) { b.innerHTML = `<div class="row"><label>Text</label><input id="pTxt" value="${esc(it.text)}"></div><button id="pDel" class="danger">Delete</button>`; $('#pTxt').onchange = e => { it.text = e.target.value; A.commit(); }; $('#pDel').onclick = deleteSel; return; }
    b.innerHTML = `<p>Wire (${it.p[0]}, ${it.p[1]}) to (${it.p[2]}, ${it.p[3]})</p><button id="pDel" class="danger">Delete</button>`; $('#pDel').onclick = deleteSel;
  }
  A.renderProps = renderProps;
  A.on(what => { if (what === 'load') { S.sel = new Set(); S.hl = new Set(); S.marks = []; } if (what === 'change' || what === 'load') { renderProps(); } A.render(); if (what === 'load') setTimeout(A.fit, 30); });
})();
