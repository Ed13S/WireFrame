/* WireFrame Build view (part 3): schematic <-> breadboard transfer and live simulation display. */
(function () {
  const A = window.App, B = A.B, V = A.BV;
  const isGnd = n => (n.name && /^(GND|AGND|DGND|PGND|VSS|0V?)$/i.test(n.name)) || n.powerPins.some(p => p.inst.def === 'GND');
  const voltsOf = n => { const v = A.railVolts ? A.railVolts(n.name || (n.powerPins[0] && n.powerPins[0].inst.value)) : null; return v; };
  const PAL = ['#2f6fdd', '#f2c200', '#2fa84f', '#ff8a1f', '#9b4fd0', '#19b5c9'];

  /* ---- schematic -> breadboard ---- */
  A.buildFromSch = () => { const d = A.doc, insts = B.insts().slice(), nets = A.nets(); d.bw = []; const need = insts.filter(i => !i.bb || !isFinite(i.bb.x));
    const placedMax = insts.filter(i => i.bb).reduce((m, i) => Math.max(m, B.bbox(i).x1), 1); let cx = Math.max(2, Math.ceil(placedMax) + 1); const free = { x: 1, y: 21, rowH: 0 };
    need.sort((a, b) => a.x - b.x || a.y - b.y);
    const onFree = (i, d0) => { const s = B.sizeOf(d0), w = s.x1 - s.x0 + 1, h = s.y1 - s.y0 + 1; if (free.x + w > 40) { free.x = 1; free.y += free.rowH + 3; free.rowH = 0; } i.bb = { x: free.x - s.x0, y: free.y - s.y0, rot: 0 }; free.x += w + 1; free.rowH = Math.max(free.rowH, h); };
    need.forEach(i => { const d0 = A.def(i.def), k = B.kind(d0), L = B.legsOf(d0), w = Math.max(...L.map(l => l.x)) + 1; let at = null;
      if (k === 'board' || k === 'free' || k === 'battery' || k === 'motor') return onFree(i, d0);
      if (k === 'dip' || k === 'seg') at = [cx, 7, w + 1]; else if (k === 'push') at = [cx, 7, 4]; else if (k === 'res' || k === 'diode' || k === 'axial') at = [cx, 4, 6]; else if (k === 'led' || k === 'elec') at = [cx, 6, 3]; else if (k === 'ceramic' || k === 'buzzer') at = [cx, 6, 4]; else at = [cx, 5, w + 2];
      if (cx + at[2] > 63) return onFree(i, d0); i.bb = { x: at[0], y: at[1], rot: 0 }; cx += at[2]; });
    const right = insts.filter(i => i.bb && B.holeStrip(B.legPos(i)[0].x, B.legPos(i)[0].y)).reduce((m, i) => Math.max(m, Math.ceil(B.bbox(i).x1)), 0); B.N = d.bn = Math.max(30, Math.min(63, right + 2));
    // supplies from power nets
    const old = d.bsup || [], sups = []; let k = 0; const pos = nets.filter(n => n.powerPins.length && !isGnd(n) && (voltsOf(n) || 0) > 0);
    pos.slice(0, 4).forEach((n, i) => { const o = old[i]; sups.push({ id: o ? o.id : 'u' + (d.seq++), x: o ? o.x : -7, y: o ? o.y : 5 + i * 6, volts: voltsOf(n), net: n.name }); }); d.bsup = sups;
    const c = B.connectivity(), find = c.find, uni = c.uni, occ = new Set(); insts.forEach(i => i.bb && B.legPos(i).forEach(l => occ.add(l.x + ',' + l.y)));
    const hole = (x, y) => { const st = B.holeStrip(x, y); if (!st) return [x, y]; const rows = st[0] === 'T' ? [3, 4, 5, 6, 7] : st[0] === 'B' ? [10, 11, 12, 13, 14] : null; if (!rows) return [x, y]; const free = rows.filter(r => !occ.has(x + ',' + r)); if (!free.length) return [x, y]; const r = st[0] === 'T' ? free[0] : free[free.length - 1]; occ.add(x + ',' + r); return [x, r]; };
    const addJ = (a, b, color) => { d.bw.push({ id: 'j' + (d.seq++), a, b, color }); const ta = B.target(a[0], a[1]), tb = B.target(b[0], b[1]); if (ta && tb) uni(ta, tb); };
    const legsFor = (inst, pin) => B.legPos(inst).filter(l => l.pin === pin); let col = 0;
    const gndSups = sups.slice(); const railNeeded = { 0: false };
    // supplies: - to GND rail, + to its rail (first two supplies)
    sups.forEach((s, i) => { const rp = i === 0 ? 0 : i === 1 ? 3 : null; const minusRail = i === 0 ? 1 : 2; addJ([s.x + 2, s.y], B.railHole(minusRail, 3), '#222'); if (rp !== null) addJ([s.x, s.y], B.railHole(rp, 3), '#d33'); s.rail = rp; });
    if (sups.length > 1) addJ(B.railHole(1, 1), B.railHole(2, 1), '#222');
    nets.forEach(n => { if (n.pins.length < 1) return; const g = isGnd(n); const si = g ? -1 : pos.indexOf(n); const sup = si >= 0 && si < 4 ? sups[si] : null;
      let ends = []; n.pins.forEach(p => { const L = legsFor(p.inst, p.n); if (!L.length) return; const l = L[0]; const pt = B.holeStrip(l.x, l.y) ? hole(l.x, l.y) : [l.x, l.y]; ends.push({ pt, leg: [l.x, l.y], x: l.x }); });
      if (g) { ends.forEach(e => { const rh = B.railHole(1, e.x); const ta = B.target(e.pt[0], e.pt[1]), tb = B.target(rh[0], rh[1]); if (ta && tb && find(ta) !== find(tb)) addJ(e.pt, rh, '#222'); }); return; }
      if (sup && sup.rail !== null && sup.rail !== undefined) { ends.forEach(e => { const rh = B.railHole(sup.rail, e.x), ta = B.target(e.pt[0], e.pt[1]), tb = B.target(rh[0], rh[1]); if (ta && tb && find(ta) !== find(tb)) addJ(e.pt, rh, '#d33'); }); return; }
      if (sup) ends.push({ pt: [sup.x, sup.y], x: sup.x });
      if (ends.length < 2) return; const done = [ends[0]], roots = new Set([find(B.target(ends[0].pt[0], ends[0].pt[1]))]);
      ends.slice(1).forEach(e => { const t = B.target(e.pt[0], e.pt[1]), r = t && find(t); if (r && roots.has(r)) return; let best = done[0], bd = 1e9; done.forEach(q => { const dd = Math.hypot(q.pt[0] - e.pt[0], q.pt[1] - e.pt[1]); if (dd < bd) { bd = dd; best = q; } }); addJ(best.pt, e.pt, PAL[col++ % PAL.length]); done.push(e); roots.add(r); }); });
    A.autosave(); };

  /* ---- breadboard -> schematic ---- */
  A.schFromBuild = async () => { const d = A.doc, insts = B.insts().filter(i => i.bb), groups = B.nets(), keep = {}; insts.forEach(i => keep[i.ref] = { bb: i.bb, sim: i.sim, def: i.def, value: i.value });
    const sorted = insts.slice().sort((a, b) => a.bb.x - b.bb.x), colOf = new Map(); sorted.forEach((i, n) => colOf.set(i.id, n));
    const spec = { title: d.meta.title || 'Breadboard circuit', parts: insts.map(i => ({ ref: i.ref, part: i.def, value: i.value, col: colOf.get(i.id), row: i.bb.y > 8.5 ? 1 : 0, rot: 0 })), nets: [] };
    groups.forEach(g => { const pins = g.pins.map(p => p.ref + '.' + p.pin); if (g.minus.length && g.plus.length) { spec.nets.push({ name: 'SHORT', pins }); return; } if (g.minus.length) { spec.nets.push({ name: 'GND', pins }); return; }
      if (g.plus.length) { const v = g.plus[0].volts; spec.nets.push({ name: '+' + String(v) + 'V', pins }); return; } if (pins.length >= 2) spec.nets.push({ pins }); });
    const meta = d.meta, bw = d.bw, bsup = d.bsup, bn = d.bn, code = d.code; A._syncing = true;
    try { await A.buildFromSpec(spec, { replace: true }); const nd = A.doc; nd.meta = meta; nd.bw = bw; nd.bsup = bsup; nd.bn = bn; nd.code = code; nd.master = 'build'; nd.parts.forEach(p => { const o = keep[p.ref]; if (o) { p.bb = o.bb; p.sim = o.sim || p.sim; } }); A.hist = []; A.fut = []; A.autosave(); }
    finally { A._syncing = false; } };

  A.on(w => { if (A._syncing) return; if (w === 'change' && A.mode === 'sch') A.doc.master = 'sch'; if (w === 'load' && A.mode === 'sch' && A.doc.master === 'build') A.schFromBuild(); });

  /* ---- live display while the simulator runs ---- */
  A.buildLive = (Sim, st, dt) => { const byId = {}; Sim.els.forEach(e => { byId[e.inst.id] = e; });
    V.live = { of: inst => { const el = byId[inst.id]; const o = { el, on: true }; if (el && el.t === 'MOTOR') { st.ang[inst.id] = ((st.ang[inst.id] || 0) + Math.max(-40, Math.min(40, (el.w || 0) * .02)) * dt * 60) % 360; o.ang = st.ang[inst.id]; } if (el && (el.t === 'SW')) o.sw = inst.sim && inst.sim.on; if (A.mcuLive) o.mcu = A.mcuLive(inst); if (el && el.t === 'BUZZ') el.on = Math.abs(Sim.v[el.n[0]] - Sim.v[el.n[1]]) > 1.5; return o; }, vj: null };
    B.draw(); };
  A.on(w => { if (w === 'stop') V.live = null; });
  const stopOrig = A.simStop; A.simStop = function () { V.live = null; stopOrig && stopOrig.apply(this, arguments); if (A.mode === 'build') B.draw(); };

  /* ---- verification helper (used by tests): do breadboard nets match schematic nets? ---- */
  A.bsyncCheck = () => { const sch = A.nets().filter(n => n.pins.length > 1), bg = B.nets(), refOf = {}; bg.forEach((g, gi) => g.pins.forEach(p => { refOf[p.ref + '.' + p.pin] = gi; })); const bad = [];
    sch.forEach(n => { const ids = new Set(n.pins.map(p => refOf[p.inst.ref + '.' + p.n])); if (ids.size > 1) bad.push((n.name || 'net') + ': ' + n.pins.map(p => p.inst.ref + '.' + p.n).join(' ') + ' not joined'); });
    bg.forEach((g, gi) => { const sg = new Set(); g.pins.forEach(p => { const n = sch.findIndex(s => s.pins.some(q => q.inst.ref === p.ref && q.n === p.pin)); if (n >= 0) sg.add(n); }); if (sg.size > 1) bad.push('breadboard joins separate schematic nets: ' + g.pins.map(p => p.ref + '.' + p.pin).join(' ')); }); return bad; };
})();
