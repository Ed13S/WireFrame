/* Schematic Studio core: model, geometry, library registry, nets, undo. No DOM here. */
const App = window.App = {
  doc: null, LIB: {}, kicadIndex: null, kicadLoaded: {}, custom: [], hist: [], fut: [], listeners: [],
  meta: { title: 'Untitled schematic', author: '', date: new Date().toISOString().slice(0, 10) }
};
(function () {
  const A = App;
  A.newDoc = () => ({ parts: [], wires: [], labels: [], notes: [], nc: [], defs: {}, meta: { title: 'Untitled schematic', author: '', date: new Date().toISOString().slice(0, 10) }, seq: 1 });
  A.doc = A.newDoc();
  A.id = (p) => p + (A.doc.seq++);
  A.on = (fn) => A.listeners.push(fn);
  A.emit = (what) => A.listeners.forEach(f => f(what));

  /* ---------- library registry ---------- */
  A.register = (def) => { if (!A.LIB[def.id] || !A.LIB[def.id].builtin) A.LIB[def.id] = def; return def; };
  window.PARTS.forEach(p => A.LIB[p.id] = p);
  try { A.custom = JSON.parse(localStorage.getItem('ss_custom') || '[]'); A.custom.forEach(p => A.LIB[p.id] = p); } catch (e) { A.custom = []; }
  A.saveCustom = () => { try { localStorage.setItem('ss_custom', JSON.stringify(A.custom)); } catch (e) {} };
  A.addCustom = (def) => { def.custom = true; def.cat = def.cat || 'My parts'; def.id = def.id || 'My:' + def.name.replace(/\s+/g, '_');
    const i = A.custom.findIndex(c => c.id === def.id); if (i >= 0) A.custom[i] = def; else A.custom.push(def);
    A.LIB[def.id] = def; A.saveCustom(); return def; };
  A.removeCustom = (id) => { A.custom = A.custom.filter(c => c.id !== id); delete A.LIB[id]; A.saveCustom(); };
  A.def = (id) => {
    let d = A.LIB[id] || A.doc.defs[id];
    if (d && d.of) { const b = A.LIB[d.lib + ':' + d.of]; if (b) d = Object.assign({}, b, { id: d.id, name: d.name, value: d.value, desc: d.desc, kw: d.kw, of: undefined }); }
    return d;
  };
  A.kicadBase = 'lib/';
  A.loadKicadIndex = async () => { if (A.kicadIndex) return A.kicadIndex; const r = await fetch(A.kicadBase + 'index.json'); A.kicadIndex = await r.json(); return A.kicadIndex; };
  A.loadKicadLib = async (lib) => {
    if (A.kicadLoaded[lib]) return A.kicadLoaded[lib];
    const r = await fetch(A.kicadBase + encodeURIComponent(lib) + '.json'); const arr = await r.json();
    arr.forEach(p => { p.kicad = true; p.cat = 'KiCad: ' + lib; A.LIB[p.id] = p; });
    return A.kicadLoaded[lib] = arr;
  };
  A.ensureDef = async (id) => { if (A.def(id)) return A.def(id); const m = /^([^:]+):/.exec(id); if (m && A.kicadIndex) { try { await A.loadKicadLib(m[1]); } catch (e) {} } return A.def(id); };

  /* ---------- geometry ---------- */
  A.xf = (inst, x, y) => { if (inst.mir) x = -x; let rx = x, ry = y; for (let i = 0; i < (inst.rot || 0); i++) { const t = rx; rx = -ry; ry = t; } return [inst.x + rx, inst.y + ry]; };
  A.pinsOf = (inst) => { const d = A.def(inst.def); if (!d) return []; return d.pins.map(p => { const [x, y] = A.xf(inst, p.x, p.y); return { n: p.n, name: p.name, x, y, inst, local: p }; }); };
  A.bbox = (def) => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    def.pins.forEach(p => add(p.x, p.y));
    def.draw.forEach(s => { if (s.t === 'l' || s.t === 'p') for (let i = 0; i < s.p.length; i += 2) add(s.p[i], s.p[i + 1]);
      else if (s.t === 'r') { add(s.p[0], s.p[1]); add(s.p[0] + s.p[2], s.p[1] + s.p[3]); }
      else if (s.t === 'c') { add(s.p[0] - s.p[2], s.p[1] - s.p[2]); add(s.p[0] + s.p[2], s.p[1] + s.p[2]); }
      else if (s.t === 'd') { (s.d.match(/-?\d*\.?\d+/g) || []).forEach((v, i, a) => { }); const n = (s.d.match(/-?\d*\.?\d+/g) || []).map(Number); for (let i = 0; i + 1 < n.length; i += 2) add(n[i], n[i + 1]); } });
    if (x0 > x1) { x0 = -2; y0 = -2; x1 = 2; y1 = 2; }
    return { x0, y0, x1, y1 };
  };
  A.worldBBox = (inst) => { const d = A.def(inst.def); const b = A.bbox(d); const c = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map(([x, y]) => A.xf(inst, x, y));
    return { x0: Math.min(...c.map(p => p[0])), y0: Math.min(...c.map(p => p[1])), x1: Math.max(...c.map(p => p[0])), y1: Math.max(...c.map(p => p[1])) }; };
  const key = (x, y) => (Math.round(x * 2) / 2) + ',' + (Math.round(y * 2) / 2);
  A.key = key;
  const onSeg = (px, py, w) => { const [x1, y1, x2, y2] = w.p; const cr = (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1); if (Math.abs(cr) > 1e-6) return false;
    return px >= Math.min(x1, x2) - 1e-6 && px <= Math.max(x1, x2) + 1e-6 && py >= Math.min(y1, y2) - 1e-6 && py <= Math.max(y1, y2) + 1e-6; };
  A.onSeg = onSeg;

  A.nextRef = (prefix) => { if (prefix.startsWith('#')) return prefix + '0' + (A.doc.parts.filter(p => (p.ref || '').startsWith('#')).length + 1);
    const used = new Set(A.doc.parts.map(p => p.ref)); let i = 1; while (used.has(prefix + i)) i++; return prefix + i; };

  /* ---------- nets ---------- */
  A.nets = () => {
    const par = new Map(); const find = a => { if (!par.has(a)) par.set(a, a); while (par.get(a) !== a) { par.set(a, par.get(par.get(a))); a = par.get(a); } return a; };
    const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par.set(a, b); };
    const d = A.doc, pts = new Map(); // point key -> {pins:[], labels:[], ends:[]}
    const P = (k, x, y) => { if (!pts.has(k)) pts.set(k, { x, y, pins: [], labels: [], ends: [] }); return pts.get(k); };
    d.wires.forEach(w => { const a = key(w.p[0], w.p[1]), b = key(w.p[2], w.p[3]); P(a, w.p[0], w.p[1]).ends.push(w.id); P(b, w.p[2], w.p[3]).ends.push(w.id); uni('w' + w.id, 'p' + a); uni('w' + w.id, 'p' + b); });
    const allPins = []; d.parts.forEach(inst => A.pinsOf(inst).forEach(p => { const k = key(p.x, p.y); P(k, p.x, p.y).pins.push(p); allPins.push(Object.assign(p, { k })); }));
    d.labels.forEach(l => { P(key(l.x, l.y), l.x, l.y).labels.push(l); });
    pts.forEach((v, k) => { uni('p' + k, 'p' + k); d.wires.forEach(w => { if (onSeg(v.x, v.y, w)) uni('w' + w.id, 'p' + k); }); });
    // names: labels and power symbols join by name
    const byName = new Map(); const joinName = (nm, node) => { if (byName.has(nm)) uni(byName.get(nm), node); else byName.set(nm, node); };
    d.labels.forEach(l => joinName('L:' + l.text, 'p' + key(l.x, l.y)));
    allPins.forEach(p => { const df = A.def(p.inst.def); if (df && df.power) joinName('L:' + (p.inst.value || p.name), 'p' + p.k); });
    const groups = new Map(); const g = (root) => { if (!groups.has(root)) groups.set(root, { pins: [], labels: [], wires: [], points: [] }); return groups.get(root); };
    allPins.forEach(p => g(find('p' + p.k)).pins.push(p));
    d.labels.forEach(l => g(find('p' + key(l.x, l.y))).labels.push(l.text));
    d.wires.forEach(w => g(find('w' + w.id)).wires.push(w.id));
    pts.forEach((v, k) => g(find('p' + k)).points.push(k));
    const out = []; let auto = 1;
    groups.forEach(gr => {
      const pw = gr.pins.find(p => (A.def(p.inst.def) || {}).power);
      const name = gr.labels[0] || (pw ? (pw.inst.value || pw.name) : null);
      const real = gr.pins.filter(p => !(A.def(p.inst.def) || {}).power);
      if (!real.length && !gr.wires.length && !name) return;
      out.push({ name: name || null, auto: !name, pins: real, powerPins: gr.pins.filter(p => (A.def(p.inst.def) || {}).power), wires: gr.wires, labels: gr.labels, points: gr.points });
    });
    out.sort((a, b) => (b.pins.length - a.pins.length));
    out.forEach(n => { if (!n.name) n.name = 'Net-' + (n.pins[0] ? '(' + n.pins[0].inst.ref + '-Pad' + n.pins[0].n + ')' : auto++); });
    return out;
  };
  A.erc = () => {
    const res = [], nets = A.nets();
    const ncAt = (x, y) => (A.doc.nc || []).some(c => Math.abs(c.x - x) < .3 && Math.abs(c.y - y) < .3);
    nets.forEach(n => { const all = n.pins.concat(n.powerPins); if (n.pins.length === 1 && !n.powerPins.length && !n.labels.length && ncAt(n.pins[0].x, n.pins[0].y)) return;
      if (n.pins.length === 1 && !n.wires.length && !n.labels.length && !n.powerPins.length) res.push({ kind: 'bad', text: `Unconnected pin ${n.pins[0].inst.ref}.${n.pins[0].n} (${n.pins[0].name || 'no name'})`, x: n.pins[0].x, y: n.pins[0].y });
      else if (n.pins.length === 1 && n.wires.length && !n.labels.length && !n.powerPins.length && n.points.length <= 2) res.push({ kind: 'bad', text: `Wire to ${n.pins[0].inst.ref}.${n.pins[0].n} goes nowhere`, x: n.pins[0].x, y: n.pins[0].y });
      if (n.pins.length === 0 && n.powerPins.length === 1 && !n.wires.length) res.push({ kind: 'bad', text: `Power symbol ${n.name} is not connected to anything`, x: n.powerPins[0].x, y: n.powerPins[0].y });
    });
    const refs = {}; A.doc.parts.forEach(p => { if ((p.ref || '').startsWith('#')) return; (refs[p.ref] = refs[p.ref] || []).push(p); });
    Object.keys(refs).forEach(r => { if (refs[r].length > 1 && new Set(refs[r].map(p => String(p.def).replace(/#\d+$/, ''))).size === 1 && refs[r].some(p => /#\d+$/.test(p.def))) return; if (refs[r].length > 1) res.push({ kind: 'bad', text: `Reference ${r} is used ${refs[r].length} times`, x: refs[r][0].x, y: refs[r][0].y }); });
    /* ---- extra checks ---- */
    const d = A.doc, isGnd = n => /^(GND|AGND|DGND|PGND|VSS|0V)$/i.test(n || '');
    const lblPos = t => { const l = d.labels.find(x => x.text === t); return l ? { x: l.x, y: l.y } : { x: 0, y: 0 }; };
    const lblCount = {}; d.labels.forEach(l => { lblCount[l.text] = (lblCount[l.text] || 0) + 1; });
    nets.forEach(n => {
      const pn = [...new Set(n.powerPins.map(p => p.inst.value || p.name))];
      if (pn.length > 1) res.push({ kind: 'bad', text: `Short circuit: ${pn.join(' and ')} are joined together`, x: n.powerPins[0].x, y: n.powerPins[0].y });
      const lt = [...new Set(n.labels)];
      if (lt.length > 1) res.push({ kind: 'bad', text: `Labels ${lt.join(' and ')} are on the same wire, so they become one net`, ...lblPos(lt[0]) });
      if (lt.length && pn.length && !lt.every(t => pn.includes(t))) res.push({ kind: 'bad', text: `Label ${lt[0]} is joined to power symbol ${pn[0]}`, ...lblPos(lt[0]) });
      if (n.labels.length && !n.pins.length && !n.powerPins.length && !n.wires.length) res.push({ kind: 'bad', text: `Label ${n.labels[0]} is not connected to anything`, ...lblPos(n.labels[0]) });
      else if (n.labels.length === 1 && lblCount[n.labels[0]] === 1 && n.pins.length <= 1 && !n.powerPins.length) res.push({ kind: 'warn', text: `Label ${n.labels[0]} is only used once, so it joins nothing. Is it spelled the same everywhere?`, ...lblPos(n.labels[0]) });
      if (!n.pins.length && !n.powerPins.length && !n.labels.length && n.wires.length) { const w = d.wires.find(x => x.id === n.wires[0]); res.push({ kind: 'warn', text: 'A wire connects to nothing', x: w.p[0], y: w.p[1] }); }
    });
    d.parts.forEach(p => { if ((p.ref || '').startsWith('#')) return; const df = A.def(p.def); if (!df || df.power) return;
      if (!(p.value || '').toString().trim() && /^(R|C|L|RV|VR|POT)\d/i.test(p.ref || '')) res.push({ kind: 'warn', text: `${p.ref} has no value (e.g. 330, 10k, 100u)`, x: p.x, y: p.y });
      const pins = A.pinsOf(p); if (pins.length > 1) { const mine = nets.filter(n => n.pins.some(q => q.inst === p)); if (mine.length && mine.every(n => n.pins.filter(q => q.inst === p).length === n.pins.length && !n.wires.length && !n.labels.length && !n.powerPins.length)) res.push({ kind: 'bad', text: `${p.ref} is not wired to anything`, x: p.x, y: p.y });
        else { const one = mine.find(n => n.pins.filter(q => q.inst === p).length > 1 && n.pins.length === n.pins.filter(q => q.inst === p).length); if (one && mine.length === 1) res.push({ kind: 'bad', text: `Every pin of ${p.ref} is joined to itself: it is shorted out`, x: p.x, y: p.y }); } } });
    const seenAt = {}; d.parts.forEach(p => { const k = p.def + '@' + p.x + ',' + p.y; if (seenAt[k]) res.push({ kind: 'warn', text: `${p.ref} sits exactly on top of ${seenAt[k].ref}`, x: p.x, y: p.y }); else seenAt[k] = p; });
    const real = d.parts.filter(p => !(p.ref || '').startsWith('#') && !(A.def(p.def) || {}).power);
    if (real.length && !nets.some(n => isGnd(n.name) && (n.powerPins.length || n.labels.length))) res.push({ kind: 'warn', text: 'There is no ground (GND) symbol, so nothing has a 0 V reference', x: real[0].x, y: real[0].y });
    return res;
  };
  A.netlistText = () => {
    const nets = A.nets(), L = [];
    L.push('# ' + A.doc.meta.title, '# Components');
    A.doc.parts.filter(p => !(p.ref || '').startsWith('#')).sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true })).forEach(p => L.push(`${p.ref}\t${p.value || ''}\t${(A.def(p.def) || {}).name || p.def}`));
    L.push('', '# Nets');
    nets.filter(n => n.pins.length).forEach(n => L.push(`${n.name}: ` + n.pins.map(p => `${p.inst.ref}.${p.n}${p.name ? '(' + p.name + ')' : ''}`).join(', ')));
    return L.join('\n');
  };

  /* ---------- undo / persistence ---------- */
  const snap = () => JSON.stringify({ parts: A.doc.parts, wires: A.doc.wires, labels: A.doc.labels, notes: A.doc.notes, nc: A.doc.nc || [], meta: A.doc.meta, seq: A.doc.seq, bw: A.doc.bw || [], bsup: A.doc.bsup || [], bn: A.doc.bn || 30, master: A.doc.master || 'sch', code: A.doc.code });
  A.commit = () => { A.hist.push(snap()); if (A.hist.length > 120) A.hist.shift(); A.fut = []; A.autosave(); A.emit('change'); };
  A.restore = (s) => { const o = JSON.parse(s); if (!o.nc) o.nc = []; Object.assign(A.doc, o); A.emit('change'); A.autosave(); };
  A.undo = () => { if (A.hist.length < 2) return; A.fut.push(A.hist.pop()); A.restore(A.hist[A.hist.length - 1]); };
  A.redo = () => { if (!A.fut.length) return; const s = A.fut.pop(); A.hist.push(s); A.restore(s); };
  A.exportDoc = () => { const o = JSON.parse(snap()); o.defs = {}; o.format = 'wireframe/1';
    A.doc.parts.forEach(p => { const d = A.def(p.def); if (d && !d.builtin) { const c = Object.assign({}, d); delete c.of; o.defs[p.def] = c; } }); return o; };
  A.importDoc = (o) => { const d = A.newDoc(); Object.assign(d, { parts: o.parts || [], wires: o.wires || [], labels: o.labels || [], notes: o.notes || [], nc: o.nc || [], meta: o.meta || d.meta, seq: o.seq || 1000, defs: o.defs || {}, bw: o.bw || [], bsup: o.bsup || [], bn: o.bn || 30, master: o.master || 'sch', code: o.code });
    Object.keys(d.defs).forEach(id => { if (!A.LIB[id]) { A.LIB[id] = d.defs[id]; } });
    A.doc = d; A.hist = []; A.fut = []; A.hist.push(snap()); A.emit('load'); };
  A.autosave = () => { clearTimeout(A._as); A._as = setTimeout(() => { try { localStorage.setItem('ss_doc', JSON.stringify(A.exportDoc())); } catch (e) {} }, 400); };
  A.hist.push(snap());
})();
