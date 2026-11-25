/* WireFrame: import/export with KiCad (.kicad_sch, netlist), SPICE, BOM. */
(function () {
  const A = window.App, $ = (s) => document.querySelector(s);
  const MM = 1.27, f = v => +(+v).toFixed(4), qs = s => '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  const base = () => (A.doc.meta.title || 'circuit').replace(/[^\w\-]+/g, '_');
  const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  const eff = (sz, hide, just) => `(effects (font (size ${sz || 1.27} ${sz || 1.27}))${just ? ` (justify ${just})` : ''}${hide ? ' hide' : ''})`;
  const safe = id => String(id).replace(/[^\w\-.+]/g, '_');
  const insts = () => A.doc.parts.filter(p => A.def(p.def));

  /* ----- netlists / BOM ----- */
  A.kicadNetlist = () => { const nets = A.nets(), parts = insts().filter(p => !(A.def(p.def).power) && !(p.ref || '').startsWith('#'));
    let o = '(export (version "E")\n  (design (source ' + qs(base() + '.wireframe') + ') (tool "WireFrame EDA 1.0.1"))\n  (components\n';
    parts.forEach(p => { const d = A.def(p.def); o += `    (comp (ref ${qs(p.ref)}) (value ${qs(p.value || d.name)}) (libsource (lib "WireFrame") (part ${qs(safe(p.def))}) (description ${qs(d.name)})))\n`; });
    o += '  )\n  (nets\n'; let code = 1;
    nets.forEach(n => { const pins = n.pins.filter(x => parts.includes(x.inst)); if (!pins.length) return; o += `    (net (code ${code++}) (name ${qs(n.name)})\n` + pins.map(x => `      (node (ref ${qs(x.inst.ref)}) (pin ${qs(x.n)}))`).join('\n') + ')\n'; });
    return o + '  ))\n'; };
  A.bomCSV = () => { const g = {}; insts().filter(p => !A.def(p.def).power && !(p.ref || '').startsWith('#')).forEach(p => { const d = A.def(p.def), k = (p.value || d.name) + '|' + d.name; (g[k] = g[k] || { value: p.value || d.name, part: d.name, refs: [] }).refs.push(p.ref); });
    return 'Reference,Qty,Value,Part\n' + Object.values(g).map(r => `"${r.refs.join(' ')}",${r.refs.length},"${r.value}","${r.part}"`).join('\n') + '\n'; };
  A.spiceNetlist = () => { const nets = A.nets(), name = new Map(); const nm = n => /^(GND|AGND|DGND|PGND|VSS|0V|0)$/i.test(n.name) ? '0' : n.name.replace(/[^\w+\-]/g, '_');
    nets.forEach(n => n.pins.forEach(p => name.set(p.inst.id + '.' + p.n, nm(n)))); let o = '* ' + (A.doc.meta.title || 'WireFrame circuit') + '\n* exported by WireFrame EDA 1.0.1 (starting point: check models before simulating)\n'; const models = new Set(); let k = 0;
    insts().forEach(p => { const d = A.def(p.def); if (d.power || (p.ref || '').startsWith('#')) return; const m = A.simModel && A.simModel(p); const node = i => name.get(p.id + '.' + d.pins[i].n) || ('NC' + (++k)); const r = (p.ref || 'X' + (++k)).replace(/\W/g, ''); const val = p.value || '';
      const num = v => (A.parseValue ? A.parseValue(v) : parseFloat(v)); const t = m && m.t;
      if (t === 'R') o += `${/^R/i.test(r) ? r : 'R' + r} ${node(0)} ${node(1)} ${num(val) || 1000}\n`;
      else if (t === 'C') o += `${/^C/i.test(r) ? r : 'C' + r} ${node(0)} ${node(1)} ${num(val) || 1e-6}\n`;
      else if (t === 'L') o += `${/^L/i.test(r) ? r : 'L' + r} ${node(0)} ${node(1)} ${num(val) || 1e-3}\n`;
      else if (t === 'D' || t === 'LED' || t === 'ZD') { o += `${/^D/i.test(r) ? r : 'D' + r} ${node(0)} ${node(1)} DGEN\n`; models.add('.model DGEN D(IS=1e-14 N=1.8)'); }
      else if (t === 'V' || t === 'VDC') o += `${/^V/i.test(r) ? r : 'V' + r} ${node(0)} ${node(1)} DC ${num(val) || 5}\n`;
      else o += `* ${r} (${d.name}) not exported: ${d.pins.map((q, i) => q.n + '=' + node(i)).join(' ')}\n`; });
    return o + [...models].join('\n') + '\n.op\n.end\n'; };

  /* ----- .kicad_sch export ----- */
  function libSymbol(id, d) { const lid = 'WireFrame:' + safe(id), x = v => f(v * MM), y = v => f(-v * MM); let g = '', pn = '';
    d.draw.forEach(s => { const fill = '(fill (type ' + (s.f === 2 ? 'background' : s.f === 1 ? 'outline' : 'none') + '))', st = '(stroke (width 0.254) (type default))';
      if (s.t === 'r') g += `      (rectangle (start ${x(s.p[0])} ${y(s.p[1])}) (end ${x(s.p[0] + s.p[2])} ${y(s.p[1] + s.p[3])}) ${st} ${fill})\n`;
      else if (s.t === 'c') g += `      (circle (center ${x(s.p[0])} ${y(s.p[1])}) (radius ${f(s.p[2] * MM)}) ${st} ${fill})\n`;
      else if (s.t === 'p' || (s.t === 'l' && !pinLine(d, s))) { const pts = s.t === 'l' ? s.p : s.p.slice(); if (s.t === 'p' && !s.o && s.f) { pts.push(pts[0], pts[1]); } g += `      (polyline (pts ${(() => { let r = ''; for (let i = 0; i < pts.length; i += 2) r += `(xy ${x(pts[i])} ${y(pts[i + 1])}) `; return r; })()}) ${st} ${fill})\n`; } });
    d.pins.forEach(p => { const o = A.pinOut({ def: id, x: 0, y: 0, rot: 0, mir: 0 }, p), len = pinLen(d, p), ang = Math.round(Math.atan2(o[1], -o[0]) * 180 / Math.PI), a = ((ang % 360) + 360) % 360;
      pn += `      (pin passive line (at ${x(p.x)} ${y(p.y)} ${a}) (length ${f(len * MM)}) (name ${qs(p.name || '~')} ${eff(1.0)}) (number ${qs(p.n)} ${eff(1.0)}))\n`; });
    const pw = d.power ? '    (power)\n' : '';
    return `    (symbol ${qs(lid)}\n${pw}      (pin_names (offset 0))\n      (in_bom ${d.power ? 'no' : 'yes'}) (on_board ${d.power ? 'no' : 'yes'})\n      (property "Reference" ${qs(d.power ? '#PWR' : (d.ref || 'U'))} (at 0 2 0) ${eff(1.27, d.power)})\n      (property "Value" ${qs(d.value || d.name)} (at 0 -2 0) ${eff(1.27)})\n      (property "Footprint" "" (at 0 0 0) ${eff(1.27, true)})\n      (property "Datasheet" "" (at 0 0 0) ${eff(1.27, true)})\n      (symbol ${qs(safe(id) + '_0_1')}\n${g}      )\n      (symbol ${qs(safe(id) + '_1_1')}\n${pn}      )\n    )\n`; }
  function pinLine(d, s) { return d.pins.some(p => (s.p[0] === p.x && s.p[1] === p.y) || (s.p[2] === p.x && s.p[3] === p.y)); }
  function pinLen(d, p) { for (const s of d.draw) if (s.t === 'l') { if (s.p[0] === p.x && s.p[1] === p.y) return Math.hypot(s.p[2] - s.p[0], s.p[3] - s.p[1]) || 2; if (s.p[2] === p.x && s.p[3] === p.y) return Math.hypot(s.p[2] - s.p[0], s.p[3] - s.p[1]) || 2; } return 2; }
  A.kicadSch = () => { const d = A.doc, m = d.meta, used = {}; insts().forEach(p => used[p.def] = 1);
    let o = `(kicad_sch (version 20231120) (generator "wireframe") (generator_version "1.0.1")\n  (uuid ${qs(uuid())})\n  (paper "A4")\n  (title_block (title ${qs(m.title)}) (date ${qs(m.date)}) (rev ${qs(m.rev || '1')}) (company ${qs(m.company || '')}) (comment 1 ${qs(m.comment || '')})${[2, 3, 4].map(i => m['comment' + i] ? ` (comment ${i} ${qs(m['comment' + i])})` : '').join('')})\n  (lib_symbols\n`;
    Object.keys(used).forEach(id => { o += libSymbol(id, A.def(id)); }); o += '  )\n';
    const X = v => f(v * MM);
    A.junctions().forEach(j => { o += `  (junction (at ${X(j.x)} ${X(j.y)}) (diameter 0) (color 0 0 0 0) (uuid ${qs(uuid())}))\n`; });
    d.wires.forEach(w => { o += `  (wire (pts (xy ${X(w.p[0])} ${X(w.p[1])}) (xy ${X(w.p[2])} ${X(w.p[3])})) (stroke (width 0) (type default)) (uuid ${qs(uuid())}))\n`; });
    d.labels.forEach(l => { o += `  (label ${qs(l.text)} (at ${X(l.x)} ${X(l.y)} 0) ${eff(1.27, false, 'left bottom')} (uuid ${qs(uuid())}))\n`; });
    (d.nc || []).forEach(c => { o += `  (no_connect (at ${X(c.x)} ${X(c.y)}) (uuid ${qs(uuid())}))\n`; });
    d.notes.forEach(n => { o += `  (text ${qs(n.text)} (exclude_from_sim no) (at ${X(n.x)} ${X(n.y)} 0) ${eff(1.27, false, 'left')} (uuid ${qs(uuid())}))\n`; });
    insts().forEach(p => { const df = A.def(p.def), a = p.mir ? (p.rot || 0) * 90 : ((4 - (p.rot || 0)) % 4) * 90, pw = df.power;
      o += `  (symbol (lib_id ${qs('WireFrame:' + safe(p.def))}) (at ${X(p.x)} ${X(p.y)} ${a})${p.mir ? ' (mirror y)' : ''} (unit 1) (exclude_from_sim no) (in_bom ${pw ? 'no' : 'yes'}) (on_board ${pw ? 'no' : 'yes'}) (dnp no) (uuid ${qs(uuid())})\n` +
        `    (property "Reference" ${qs(pw ? '#PWR' + p.id.replace(/\D/g, '') : p.ref)} (at ${X(p.x)} ${X(p.y - 3)} 0) ${eff(1.27, pw)})\n    (property "Value" ${qs(p.value || df.value || df.name)} (at ${X(p.x)} ${X(p.y + 3)} 0) ${eff(1.27)})\n    (property "Footprint" ${qs(p.footprint || "")} (at ${X(p.x)} ${X(p.y)} 0) ${eff(1.27, true)})\n    (property "Datasheet" "" (at ${X(p.x)} ${X(p.y)} 0) ${eff(1.27, true)})\n` +
        df.pins.map(q => `    (pin ${qs(q.n)} (uuid ${qs(uuid())}))`).join('\n') + '\n  )\n'; });
    return o + '  (sheet_instances (path "/" (page "1")))\n)\n'; };

  /* ----- .kicad_sch import ----- */
  A.importKicadSch = (text, fname) => { const K = A._k; let tree; try { tree = K.sexp(text); } catch (e) { return A.toast('Could not read that KiCad file'); }
    if (!Array.isArray(tree) || tree[0] !== 'kicad_sch') return A.toast('That is not a .kicad_sch file (KiCad 6 or newer)');
    const { all, find, str, q, symToDef } = K, lib = find(tree, 'lib_symbols') || [], syms = all(lib, 'symbol'), parents = {}; syms.forEach(s => parents[str(s[1])] = { raw: s });
    const nd = A.newDoc(), defsById = {}, warn = [];
    syms.forEach(s => { try { const id = str(s[1]), d = symToDef(s, id.split(':')[0] || 'lib', parents); if (d) { d.id = 'KiSch:' + id; d.name = id.split(':').pop(); const p = parents[id]; if (find(s, 'power')) d.power = true; A.addCustom(Object.assign({}, d)); defsById[id] = d; } } catch (e) { warn.push(str(s[1])); } });
    const U = v => Math.round(+v / MM), pt = a => { const at = find(a, 'at'); return at ? [U(at[1]), U(at[2]), +at[3] || 0] : [0, 0, 0]; };
    const prop = (a, k) => { const r = all(a, 'property').find(x => str(x[1]) === k); return r ? str(r[2]) : ''; };
    all(tree, 'symbol').forEach(s => { const lid = find(s, 'lib_id'); if (!lid) return; const id = str(lid[1]); let d = defsById[id]; if (!d) { warn.push(id); return; }
      const un = find(s, 'unit') ? +find(s, 'unit')[1] : 1; if (un > 1 && parents[id]) { const k2 = id + '#' + un; if (!defsById[k2]) { try { const d2 = symToDef(parents[id].raw, id.split(':')[0] || 'lib', parents, un); if (d2 && d2.pins.length) { d2.id = 'KiSch:' + k2; d2.name = id.split(':').pop() + ' (unit ' + un + ')'; A.addCustom(Object.assign({}, d2)); defsById[k2] = d2; } } catch (e) { /* keep unit 1 */ } } if (defsById[k2]) d = defsById[k2]; }
      let [x, y, ang] = pt(s), mir = find(s, 'mirror'), mx = mir && mir[1] === 'x', my = mir && mir[1] === 'y'; if (mx) { my = true; ang += 180; } ang = ((Math.round(ang / 90) % 4) + 4) % 4;
      const rot = my ? ang : (4 - ang) % 4; const ref = prop(s, 'Reference'), val = prop(s, 'Value');
      nd.parts.push({ id: 'p' + (nd.seq++), def: d.id, x, y, rot, mir: my ? 1 : 0, ref: d.power ? '#PWR' + nd.seq : ref, value: val || d.value }); });
    all(tree, 'wire').forEach(w => { const pts = all(find(w, 'pts'), 'xy').map(p => [U(p[1]), U(p[2])]); for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i], b = pts[i + 1]; if (a[0] === b[0] && a[1] === b[1]) continue; if (a[0] === b[0] || a[1] === b[1]) nd.wires.push({ id: 'w' + (nd.seq++), p: [a[0], a[1], b[0], b[1]] }); else { nd.wires.push({ id: 'w' + (nd.seq++), p: [a[0], a[1], b[0], a[1]] }, { id: 'w' + (nd.seq++), p: [b[0], a[1], b[0], b[1]] }); } } });
    ['label', 'global_label', 'hierarchical_label'].forEach(k => all(tree, k).forEach(l => { const [x, y] = pt(l); nd.labels.push({ id: 'l' + (nd.seq++), x, y, text: str(l[1]) }); }));
    all(tree, 'no_connect').forEach(t => { const [x, y] = pt(t); nd.nc.push({ id: 'q' + (nd.seq++), x, y }); });
    all(tree, 'text').forEach(t => { const [x, y] = pt(t); nd.notes.push({ id: 'n' + (nd.seq++), x, y, text: str(t[1]) }); });
    const tb = find(tree, 'title_block'); if (tb) { const g = k => { const r = find(tb, k); return r ? str(r[1]) : ''; }; Object.assign(nd.meta, { title: g('title') || (fname || '').replace(/\.kicad_sch$/i, ''), date: g('date') || nd.meta.date, rev: g('rev'), company: g('company') }); all(tb, 'comment').forEach(c => { const i = parseInt(str(c[1]), 10), t = str(c[2]); if (i === 1) nd.meta.comment = t; else if (i >= 2 && i <= 9) nd.meta['comment' + i] = t; }); } else nd.meta.title = (fname || 'KiCad import').replace(/\.kicad_sch$/i, '');
    const nm = nd.meta.title || 'KiCad import'; A.projects.newProject(nm); Object.assign(A.doc, { parts: nd.parts, wires: nd.wires, labels: nd.labels, notes: nd.notes, nc: nd.nc, seq: nd.seq + 100 }); Object.assign(A.doc.meta, nd.meta, { file: nm + '.wireframe' });
    A.refreshLib && A.refreshLib(); A.hist = []; A.fut = []; A.commit(); A.emit('load'); A.toast('Imported ' + nd.parts.length + ' parts from KiCad' + (warn.length ? ' (' + warn.length + ' skipped)' : '')); };
  A.importAnyFile = (name, text) => { if (/\.kicad_sch$/i.test(name)) return A.importKicadSch(text, name); if (/\.kicad_sym$/i.test(name)) return A.importKicadSym(text, name); return false; };

  const dl = (n, t, ty) => A.download(n, t, ty || 'text/plain');
  Object.assign(A.interopActs = {}, {
    sch() { dl(base() + '.kicad_sch', A.kicadSch()); A.toast('Saved. Open it in KiCad 8 or 9 (File → Open).'); }, kinet() { dl(base() + '.net', A.kicadNetlist()); },
    spice() { dl(base() + '.cir', A.spiceNetlist()); }, bom() { dl(base() + '-bom.csv', A.bomCSV(), 'text/csv'); },
    impkicad() { const i = document.createElement('input'); i.type = 'file'; i.accept = '.kicad_sch,.kicad_sym'; i.onchange = async () => { const fl = i.files[0]; if (!fl) return; A.importAnyFile(fl.name, await fl.text()); }; i.click(); } });
})();
