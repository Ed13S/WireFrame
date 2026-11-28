/* Simulation controls and animation: play/pause, current flow along wires, glowing LEDs, clickable switches, readouts. */
(function () {
  const A = window.App, S = A.S, Sim = A.Sim, $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NS = 'http://www.w3.org/2000/svg', svg = $('#svg'), world = $('#world', svg);
  const simg = document.createElementNS(NS, 'g'); simg.id = 'simg'; simg.setAttribute('pointer-events', 'none'); world.insertBefore(simg, $('#ov', svg));
  svg.querySelector('defs').insertAdjacentHTML('beforeend', '<filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.6"/></filter>');
  const st = A.simState = { active: false, play: false, speed: 1, showV: true, last: 0, flow: [], dots: 0, msgs: [], ang: {} };
  const fmt = (x, u) => { const a = Math.abs(x); if (a < 1e-12) return '0 ' + u; if (a >= 1) return x.toFixed(a >= 100 ? 0 : a >= 10 ? 1 : 2) + ' ' + u; if (a >= 1e-3) return (x * 1e3).toFixed(a >= 1e-1 ? 0 : a >= 1e-2 ? 1 : 2) + ' m' + u; if (a >= 1e-6) return (x * 1e6).toFixed(1) + ' µ' + u; return (x * 1e9).toFixed(1) + ' n' + u; };
  A.fmtUnit = fmt;
  /* multimeter reading text for a simulated element */
  A.mmRead = el => { const vd = Sim.v[el.n[0]] - Sim.v[el.n[1]], rms = Math.sqrt((el.acs || 0) / Math.max(1, el.acn || 1)), m = el.mode || 'dcv'; return m === 'dcv' ? fmt(vd, 'V DC') : m === 'acv' ? fmt(rms, 'V AC') : m === 'dca' ? fmt(vd / el.r, 'A DC') : m === 'aca' ? fmt(rms / el.r, 'A AC') : fmt(Math.abs(vd) / 1e-3, 'Ω'); };

  /* ---------- wire graph for current flow ---------- */
  function buildFlow() {
    const nets = A.nets(), flow = []; const d = A.doc;
    nets.forEach((net, ni) => {
      if (!net.wires.length) return; const wires = d.wires.filter(w => net.wires.includes(w.id)); const pts = new Map(); const P = (x, y) => { const k = A.key(x, y); if (!pts.has(k)) pts.set(k, { x, y, k, inj: 0, adj: [] }); return pts.get(k); };
      wires.forEach(w => { P(w.p[0], w.p[1]); P(w.p[2], w.p[3]); }); net.pins.concat(net.powerPins).forEach(p => P(p.x, p.y)); d.labels.forEach(l => { if (net.labels.includes(l.text)) { const k = A.key(l.x, l.y); if (pts.has(k)) { } } });
      const edges = []; wires.forEach(w => { const on = [...pts.values()].filter(p => A.onSeg(p.x, p.y, w)); const dx = w.p[2] - w.p[0], dy = w.p[3] - w.p[1], L2 = dx * dx + dy * dy || 1; on.sort((a, b) => ((a.x - w.p[0]) * dx + (a.y - w.p[1]) * dy) / L2 - ((b.x - w.p[0]) * dx + (b.y - w.p[1]) * dy) / L2);
        for (let i = 0; i + 1 < on.length; i++) if (on[i] !== on[i + 1]) edges.push([on[i], on[i + 1], w.id]); });
      edges.forEach(([a, b]) => { a.adj.push([b, a, b]); b.adj.push([a, a, b]); });
      // spanning forest
      const seen = new Set(), order = [], parent = new Map();
      for (const root of pts.values()) { if (seen.has(root)) continue; const comp = [], stack = [root]; seen.add(root); parent.set(root, null);
        while (stack.length) { const u = stack.pop(); comp.push(u); order.push(u); u.adj.forEach(([v]) => { if (!seen.has(v)) { seen.add(v); parent.set(v, u); stack.push(v); } }); }
        comp._root = root; comp._nodes = comp; flow.push({ net: ni, comp, parent }); }
    });
    st.flow = flow; st.pinPt = new Map(); A.doc.parts.forEach(p => A.pinsOf(p).forEach(q => st.pinPt.set(p.id + ':' + q.n, A.key(q.x, q.y))));
  }
  function edgeCurrents() {
    const out = []; const I = Sim.pinI;
    st.flow.forEach(({ comp, parent }) => { comp.forEach(n => n.inj = 0);
      const byKey = new Map(comp.map(n => [n.k, n])); st.injections && 0;
      for (const [key, k] of st.pinPt) { const n = byKey.get(k); if (n && I[key] !== undefined) n.inj += -I[key]; }
      const sum = comp.reduce((s, n) => s + n.inj, 0); if (Math.abs(sum) > 1e-12) { const sink = comp.find(n => st.powerPts && st.powerPts.has(n.k)) || null; if (sink) sink.inj -= sum; }
      const sub = new Map(); for (let i = comp.length - 1; i >= 0; i--) { const n = comp[i]; sub.set(n, (sub.get(n) || 0) + n.inj); const p = parent.get(n); if (p) sub.set(p, (sub.get(p) || 0) + sub.get(n)); }
      comp.forEach(n => { const p = parent.get(n); if (p) out.push({ a: n, b: p, i: sub.get(n) }); }); });   // current flows a -> b
    return out;
  }
  function powerPoints() { st.powerPts = new Set(); A.doc.parts.forEach(p => { const df = A.def(p.def); if (df && df.power) A.pinsOf(p).forEach(q => st.powerPts.add(A.key(q.x, q.y))); }); }

  /* ---------- drawing ---------- */
  const vcol = (v, lo, hi) => { const f = hi - lo < 1e-6 ? 0 : Math.max(0, Math.min(1, (v - lo) / (hi - lo))); return `hsl(${Math.round(215 - 215 * f)} 85% 52%)`; };
  function frame(now) {
    if (!st.play) return; const dt = Math.min(0.05, (now - st.last) / 1000 || 0.016); st.last = now;
    try { Sim.run(dt * st.speed); } catch (e) { console.error(e); pause(); A.toast('The simulator hit a problem: ' + e.message); return; }
    const vs = Math.max(.1, Math.min(st.speed, 4)); st.dots += dt * vs; draw(dt * vs); updateStatus(); st.raf = requestAnimationFrame(frame);
  }
  function draw(dt) {
    const v = Sim.v; let lo = 0, hi = 1; for (let i = 0; i < v.length; i++) { lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]); } let o = '';
    const nets = A.nets(); const byWire = new Map(); nets.forEach((n, i) => n.wires.forEach(w => byWire.set(w, i)));
    const nodeIdx = (ni) => { const n = nets[ni]; const p = n.pins[0] || n.powerPins[0]; return p ? Sim.pinNode[p.inst.id + ':' + p.n] : undefined; };
    const nodeOfNet = []; nets.forEach((n, i) => nodeOfNet[i] = nodeIdx(i));
    A.doc.wires.forEach(w => { const ni = byWire.get(w.id); const nv = ni !== undefined ? v[nodeOfNet[ni]] : undefined; if (nv === undefined) return; o += `<line x1="${w.p[0]}" y1="${w.p[1]}" x2="${w.p[2]}" y2="${w.p[3]}" stroke="${vcol(nv, lo, hi)}" stroke-width=".26" stroke-linecap="round" opacity=".95"/>`; });
    // flowing current
    edgeCurrents().forEach(e => { const I = e.i, a = Math.abs(I); if (a < 2e-6) return; const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, L = Math.hypot(dx, dy); if (L < .01) return; const sp = Math.min(22, 3 + 5.5 * Math.log10(1 + a / 2e-4)), gap = 3.2, dir = I > 0 ? 1 : -1;
      const ph = ((st.dots * sp * dir) % gap + gap) % gap; for (let s = ph; s < L; s += gap) { const t = s / L; o += `<circle cx="${(e.a.x + dx * t).toFixed(2)}" cy="${(e.a.y + dy * t).toFixed(2)}" r=".34" fill="#ffe08a" stroke="#c46a00" stroke-width=".08"/>`; } });
    // components
    for (const el of Sim.els) { const inst = el.inst, wb = A.worldBBox(inst), cx = (wb.x0 + wb.x1) / 2, cy = (wb.y0 + wb.y1) / 2;
      if (el.t === 'LED') { if (el.dead) o += `<g><circle cx="${cx}" cy="${cy}" r="2.3" fill="none" stroke="#e03c31" stroke-width=".3"/><path d="M${cx - 1.4} ${cy - 1.4}l2.8 2.8M${cx + 1.4} ${cy - 1.4}l-2.8 2.8" stroke="#e03c31" stroke-width=".35"/><text x="${cx}" y="${wb.y0 - 3}" text-anchor="middle" font-size="1.4" fill="#e03c31" font-weight="700">Popped! Add a resistor</text></g>`;
        else if ((el.lum || 0) > 0.02) o += `<circle cx="${cx}" cy="${cy}" r="${4 + el.lum * 3}" fill="${el.color}" opacity="${(0.15 + el.lum * 0.6).toFixed(2)}" filter="url(#glow)"/><circle cx="${cx}" cy="${cy}" r="1.1" fill="${el.color}" opacity="${Math.min(1, el.lum + .2).toFixed(2)}"/>`; }
      else if (el.t === 'LAMP' && (el.lum || 0) > 0.03) o += `<circle cx="${cx}" cy="${cy}" r="${3 + el.lum * 4}" fill="#ffd84a" opacity="${Math.min(.95, .2 + el.lum * .6).toFixed(2)}" filter="url(#glow)"/>`;
      else if (el.t === 'MOTOR') { const w = el.w || 0; st.ang[inst.id] = ((st.ang[inst.id] || 0) + Math.max(-40, Math.min(40, w * 0.02)) * dt * 60) % 360; o += `<g transform="translate(${cx} ${cy}) rotate(${st.ang[inst.id]})"><path d="M-2 0H2M0 -2V2" stroke="#e0a030" stroke-width=".4" stroke-linecap="round"/></g>`; }
      else if (el.t === 'SW' || el.t === 'SPDT') { const on = el.t === 'SW' ? inst.sim.on : !inst.sim.pos; o += `<g><rect x="${cx - 2.2}" y="${wb.y0 - 3.4}" width="4.4" height="1.9" rx=".5" fill="${on ? '#2fa84f' : '#8a8f98'}"/><text x="${cx}" y="${wb.y0 - 2}" text-anchor="middle" font-size="1.15" fill="#fff" font-weight="700">${el.t === 'SW' ? (on ? 'ON' : 'OFF') : (inst.sim.pos ? 'NC' : 'NO')}</text></g>`; }
      else if (el.t === 'RELAY') o += `<text x="${cx}" y="${wb.y0 - 1.2}" text-anchor="middle" font-size="1.2" fill="${inst.sim.on ? '#2fa84f' : '#8a8f98'}" font-weight="700">${inst.sim.on ? 'CLICK ON' : 'OFF'}</text>`;
      else if (el.t === 'MM') { o += `<rect x="${cx - 4}" y="${wb.y1 + .4}" width="8" height="2" rx=".5" fill="#111" /><text x="${cx}" y="${wb.y1 + 1.5}" text-anchor="middle" dominant-baseline="central" font-size="1.15" fill="#6bff8e" font-family="monospace">${A.mmRead(el)}</text>`; }
      else if (el.t === 'VM') { const rd = Sim.v[el.n[0]] - Sim.v[el.n[1]]; o += `<rect x="${cx - 3.4}" y="${wb.y1 + .4}" width="6.8" height="2" rx=".5" fill="#111" /><text x="${cx}" y="${wb.y1 + 1.5}" text-anchor="middle" dominant-baseline="central" font-size="1.2" fill="#6bff8e" font-family="monospace">${fmt(rd, 'V')}</text>`; }
      else if (el.t === 'AM') { const rd = (Sim.v[el.n[0]] - Sim.v[el.n[1]]) / el.r; o += `<rect x="${cx - 3.4}" y="${wb.y1 + .4}" width="6.8" height="2" rx=".5" fill="#111" /><text x="${cx}" y="${wb.y1 + 1.5}" text-anchor="middle" dominant-baseline="central" font-size="1.2" fill="#6bff8e" font-family="monospace">${fmt(rd, 'A')}</text>`; }
      else if (el.t === 'FUSE' && el.blown) o += `<text x="${cx}" y="${wb.y0 - 1.5}" text-anchor="middle" font-size="1.3" fill="#e03c31" font-weight="700">Blown</text>`;
    }
    if (st.showV) nets.forEach((n, i) => { const nd = nodeOfNet[i]; if (nd === undefined || (!n.wires.length && n.pins.length < 2)) return; const w = A.doc.wires.find(x => n.wires.includes(x.id)); if (!w) return; const mx = (w.p[0] + w.p[2]) / 2, my = (w.p[1] + w.p[3]) / 2; const vv = v[nd];
      o += `<g><rect x="${mx - 2.1}" y="${my - 2.3}" width="4.2" height="1.5" rx=".4" fill="var(--panel)" opacity=".85"/><text x="${mx}" y="${my - 1.55}" text-anchor="middle" dominant-baseline="central" font-size="1" fill="var(--fg)">${vv.toFixed(Math.abs(vv) < 10 ? 2 : 1)}V</text></g>`; });
    simg.innerHTML = o; if (A.mode === 'build' && A.buildLive) A.buildLive(Sim, st, dt);
    // refresh the selected part's live readout
    if (st.readoutT === undefined || performance.now() - st.readoutT > 250) { st.readoutT = performance.now(); A.simReadout && A.simReadout(); }
  }
  function updateStatus() { A.scopeTick && A.scopeTick(); $('#simStat').textContent = (st.play ? 'Running' : 'Paused') + ' · ' + Sim.t.toFixed(Sim.t < 10 ? 2 : 1) + ' s'; }

  /* ---------- control ---------- */
  async function start() {
    if (A.mode === 'build' && A.doc.master === 'build') { try { await A.schFromBuild(); } catch (e) { console.error(e); A.toast('Could not read the breadboard: ' + e.message); return; } }
    if (!st.active) { st.active = true; $('#simbar').classList.add('on'); }
    const ok = Sim.build(); const box = $('#msgs');
    box.innerHTML = Sim.errors.map(e => `<div class="msg bad">${esc(e)}</div>`).join('') + Sim.warnings.map(w => `<div class="msg">${esc(w)}</div>`).join('') + (Sim.notes || []).map(w => `<div class="msg ok">${esc(w)}</div>`).join('');
    if (!ok) { st.play = false; sync(); A.toast(Sim.errors[0]); return; }
    powerPoints(); buildFlow(); st.ang = {}; A.mcu && A.mcu.stop && A.mcu.stop(); A.mcu && A.mcu.start(); play();
  }
  function play() { if (!st.active) return start(); st.play = true; st.last = performance.now(); sync(); cancelAnimationFrame(st.raf); st.raf = requestAnimationFrame(frame); }
  function pause() { st.play = false; sync(); updateStatus(); }
  function stop() { A.scopeClose && A.scopeClose(); A.mcu && A.mcu.stop(); st.play = false; st.active = false; simg.innerHTML = ''; $('#simbar').classList.remove('on'); sync(); A.render(); }
  function sync() { const b = $('#bPlay'); b.textContent = st.play ? '⏸ Pause' : (st.active ? '▶ Resume' : '▶ Play'); b.classList.toggle('playing', st.play); $('#bStop').hidden = !st.active; $('#bReset').hidden = !st.active; $('#simOpts').hidden = !st.active; const is = $('#instr'); if (is) is.hidden = st.active; }
  A.simStart = start; A.simStop = stop;
  $('#bPlay').onclick = () => st.play ? pause() : (st.active ? play() : start());
  $('#bStop').onclick = stop; $('#bReset').onclick = () => { const was = st.play; start(); if (!was) pause(); };
  $('#simSpeed').onchange = e => st.speed = +e.target.value; $('#simV').onchange = e => { st.showV = e.target.checked; if (!st.play && st.active) draw(0.016); };
  // editing while running restarts the simulation on the new circuit
  A.on(what => { if (A._syncing) return; if (st.active && (what === 'change' || what === 'load')) { const was = st.play; if (what === 'load') { stop(); return; } Sim.build(); powerPoints(); buildFlow(); if (Sim.errors.length) { pause(); } else if (!was) draw(0.016); } });
  // interaction with parts while running
  A.simPointer = (id, phase) => {
    if (!st.active) return false;
    if (phase === 'up') { let ch = false; A.doc.parts.forEach(p => { const m = A.simModel(p); if (m && m.momentary && p.sim && p.sim.on) { p.sim.on = false; ch = true; } }); if (ch && !st.play) draw(0.016); return false; }
    const p = A.doc.parts.find(x => x.id === id); if (!p) return false; const m = A.simModel(p); if (!m) return false; p.sim = p.sim || {};
    if (m.t === 'SW') { p.sim.on = m.momentary ? true : !p.sim.on; if (!st.play) draw(0.016); return true; } if (m.t === 'SPDT') { p.sim.pos = p.sim.pos ? 0 : 1; if (!st.play) draw(0.016); return true; } return false; };
  A.simProps = (it, body) => { if (!st.active) return; const m = A.simModel(it); if (!m) return; it.sim = it.sim || {}; let h = '<div class="simp"><b>Live</b><div id="simRead" class="note"></div>';
    const slider = (k, label, dflt) => `<div class="row"><label>${label}</label><input type="range" id="sl_${k}" min="0" max="1" step="0.01" value="${it.sim[k] !== undefined ? it.sim[k] : dflt}"></div>`;
    if (m.t === 'POT') h += slider('pos', 'Turn', 0.5); if (m.t === 'LDR') h += slider('light', 'Light', 0.5); if (m.t === 'NTC') h += slider('temp', 'Heat', 0.5);
    if (m.t === 'SW') h += `<div class="row"><button id="swTog">${it.sim.on ? 'Turn OFF' : 'Turn ON'}</button></div>`; h += '</div>'; body.insertAdjacentHTML('beforeend', h);
    ['pos', 'light', 'temp'].forEach(k => { const s = $('#sl_' + k); if (s) s.oninput = e => { it.sim[k] = +e.target.value; }; }); const tg = $('#swTog'); if (tg) tg.onclick = () => { it.sim.on = !it.sim.on; tg.textContent = it.sim.on ? 'Turn OFF' : 'Turn ON'; }; A.simReadout(); };
  A.simReadout = () => { const box = $('#simRead'); if (!box || !st.active) return; const it = [...S.sel].map(id => A.doc.parts.find(p => p.id === id))[0]; if (!it) return; const el = Sim.els.find(e => e.inst === it); if (!el) { box.textContent = 'This part is not simulated yet.'; return; }
    const v = Sim.v, I = Sim.pinI; let t = ''; if (el.n.length >= 2) { const vd = v[el.n[0]] - v[el.n[1]]; t += 'Voltage across: ' + fmt(vd, 'V') + '<br>'; } const i0 = I[el.keys[0]]; if (i0 !== undefined) t += 'Current in at pin 1: ' + fmt(i0, 'A') + '<br>';
    if (el.t === 'LED') t += el.dead ? 'This LED popped.' : 'Brightness: ' + Math.round((el.lum || 0) * 100) + '%'; if (el.t === 'MOTOR') t += 'Speed: ' + Math.round(Math.abs(el.w) * 9.55) + ' rpm'; box.innerHTML = t; };

  /* ---------- oscilloscope windows ---------- */
  const wins = new Map(), TD = [1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, .01, .02, .05, .1, .2, .5, 1], VD = [.01, .02, .05, .1, .2, .5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
  const lab = (x, u) => (x < 1e-3 ? (x * 1e6) + ' µ' : x < 1 ? (x * 1e3) + ' m' : x + ' ') + u;
  function scopeWin(el) { const w = document.createElement('div'); w.className = 'scopewin'; w.style.cssText = 'position:fixed;right:20px;top:' + (110 + wins.size * 30) + 'px;z-index:40;background:#10151b;color:#cfe;border:1px solid #456;border-radius:8px;box-shadow:0 8px 30px #0008;font:12px Inter,system-ui,sans-serif';
    w.innerHTML = `<div class="sh" style="cursor:move;padding:5px 9px;display:flex;justify-content:space-between;background:#1c2530;border-radius:8px 8px 0 0"><b>Oscilloscope ${esc(el.inst.ref || '')}</b><span class="note" style="color:#8ab">drag me</span></div><canvas width="480" height="300" style="display:block"></canvas><div class="sc" style="display:flex;gap:8px;padding:6px 8px;flex-wrap:wrap;align-items:center"><label>Time/div <select class="td">${TD.map((t, i) => `<option value="${i}">${lab(t, 's')}</option>`).join('')}</select></label><label style="color:#ffe14d">CH1 <select class="v1">${VD.map((t, i) => `<option value="${i}">${lab(t, 'V')}</option>`).join('')}</select></label><label style="color:#4dd2ff">CH2 <select class="v2">${VD.map((t, i) => `<option value="${i}">${lab(t, 'V')}</option>`).join('')}</select></label><button class="auto small">Auto</button></div><div class="ro" style="padding:0 9px 8px;font-family:monospace;color:#8f8"></div>`;
    document.body.appendChild(w); const o = { el, w, cv: w.querySelector('canvas'), td: 11, v1: 9, v2: 9 }; w.querySelector('.td').value = o.td; w.querySelector('.v1').value = o.v1; w.querySelector('.v2').value = o.v2;
    w.querySelector('.td').onchange = e => { o.td = +e.target.value; }; w.querySelector('.v1').onchange = e => { o.v1 = +e.target.value; }; w.querySelector('.v2').onchange = e => { o.v2 = +e.target.value; };
    w.querySelector('.auto').onclick = () => { const b = el.buf.slice(-8000); if (b.length < 20) return; const f = freqOf(b, 1); if (f) { const per = 1 / f, want = per / 2; o.td = Math.max(0, TD.findIndex(t => t >= want)); if (o.td < 0) o.td = TD.length - 1; w.querySelector('.td').value = o.td; } [1, 2].forEach(c => { const vs = b.map(r => r[c]), pk = Math.max(...vs.map(Math.abs)) || 1; let i = VD.findIndex(t => t * 4 >= pk); if (i < 0) i = VD.length - 1; o['v' + c] = i; w.querySelector('.v' + c).value = i; }); };
    const sh = w.querySelector('.sh'); let dr = null; sh.onpointerdown = e => { dr = { x: e.clientX - w.offsetLeft, y: e.clientY - w.offsetTop }; sh.setPointerCapture(e.pointerId); }; sh.onpointermove = e => { if (dr) { w.style.left = (e.clientX - dr.x) + 'px'; w.style.top = (e.clientY - dr.y) + 'px'; w.style.right = 'auto'; } }; sh.onpointerup = () => { dr = null; };
    wins.set(el, o); }
  function freqOf(b, c) { const vs = b.map(r => r[c]), mn = Math.min(...vs), mx = Math.max(...vs); if (mx - mn < 1e-6) return 0; const mid = (mx + mn) / 2, t = []; for (let i = 1; i < b.length; i++) if (b[i - 1][c] < mid && b[i][c] >= mid) t.push(b[i - 1][0] + (b[i][0] - b[i - 1][0]) * (mid - b[i - 1][c]) / ((b[i][c] - b[i - 1][c]) || 1)); return t.length >= 2 ? (t.length - 1) / (t[t.length - 1] - t[0]) : 0; }
  A.scopeClose = () => { wins.forEach(o => o.w.remove()); wins.clear(); };
  A.scopeTick = () => { if (!st.active) return; Sim.els.filter(e => e.t === 'SCOPE').forEach(e => { if (!wins.has(e)) scopeWin(e); }); wins.forEach(o => { const { cv, el } = o, g = cv.getContext('2d'), W = cv.width, H = cv.height, td = TD[o.td], span = td * 10, t1 = Sim.t, t0 = t1 - span; g.fillStyle = '#0a0f0a'; g.fillRect(0, 0, W, H); g.strokeStyle = '#1f3a1f'; g.lineWidth = 1;
      for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(i * W / 10, 0); g.lineTo(i * W / 10, H); g.stroke(); } for (let j = 0; j <= 8; j++) { g.beginPath(); g.moveTo(0, j * H / 8); g.lineTo(W, j * H / 8); g.stroke(); } g.strokeStyle = '#2f5a2f'; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
      const b = el.buf; let lo = 0, hi = b.length; while (lo < hi) { const m = (lo + hi) >> 1; if (b[m][0] < t0) lo = m + 1; else hi = m; }
      const ro = []; [[1, '#ffe14d', o.v1, 'CH1'], [2, '#4dd2ff', o.v2, 'CH2']].forEach(([c, col, vi, nm]) => { const vd = VD[vi]; g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); let first = true, last = -1; for (let i = lo; i < b.length; i++) { const x = (b[i][0] - t0) / span * W, px = Math.round(x); if (px === last && i < b.length - 1) continue; last = px; const y = H / 2 - b[i][c] / vd * (H / 8); if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y); } g.stroke();
        const win = b.slice(lo); if (win.length > 3) { const vs = win.map(r => r[c]), pp = Math.max(...vs) - Math.min(...vs), f = freqOf(win, c); ro.push(`<span style="color:${col}">${nm}: Vpp ${fmt(pp, 'V')}${f ? ', ' + fmt(f, 'Hz') : ''}</span>`); } });
      g.fillStyle = '#8fb88f'; g.font = '11px monospace'; g.fillText(lab(td, 's') + '/div', 6, H - 6); o.w.querySelector('.ro').innerHTML = ro.join(' &nbsp; ') || 'Waiting for signal…'; }); };

  /* ---------- instrument strip: drag an instrument onto the sheet ---------- */
  (() => { const bar = $('#instr'); if (!bar) return; let drag = null, ghost = null;
    bar.addEventListener('pointerdown', e => { const b = e.target.closest('[data-inst]'); if (!b || st.active) return; drag = b.dataset.inst; ghost = document.createElement('div'); ghost.textContent = b.textContent; ghost.style.cssText = 'position:fixed;z-index:99;pointer-events:none;padding:4px 8px;background:#b4ff00;color:#111;border-radius:6px;font:12px Inter,system-ui'; document.body.appendChild(ghost); ghost.style.left = e.clientX + 8 + 'px'; ghost.style.top = e.clientY + 8 + 'px'; e.preventDefault(); });
    addEventListener('pointermove', e => { if (ghost) { ghost.style.left = e.clientX + 8 + 'px'; ghost.style.top = e.clientY + 8 + 'px'; } });
    addEventListener('pointerup', async e => { if (!drag) return; const id = drag; drag = null; if (ghost) { ghost.remove(); ghost = null; } const t = document.elementFromPoint(e.clientX, e.clientY), host = t && t.closest && t.closest('#svg,#bsvg'); if (!host || host.hasAttribute('hidden')) return;
      await A.startPlacing(id); const mk = (n, x) => new PointerEvent(n, { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY, button: 0, buttons: x, pointerId: 1, pointerType: 'mouse' }); host.dispatchEvent(mk('pointermove', 0)); host.dispatchEvent(mk('pointerdown', 1)); host.dispatchEvent(mk('pointerup', 0)); A.setTool && A.setTool('select'); });
    bar.addEventListener('click', e => { const b = e.target.closest('[data-inst]'); if (b && !st.active) A.startPlacing(b.dataset.inst); }); })();
})();
