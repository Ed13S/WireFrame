/* SVG rendering for symbols and the sheet. Coordinates are grid units; the world group scales by 10. */
(function () {
  const A = window.App, esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = n => Math.round(n * 100) / 100;
  A.SHEET = { w: 234, h: 165 };            // A4 at 1 unit = 1.27 mm (same as KiCad)
  const fillCls = (s, dflt) => { const f = s.f === undefined ? dflt : s.f; return f === 1 ? 's-solid' : f === 2 ? 's-fill' : 's-none'; };

  // text orientation: keep text readable whatever the part rotation/mirror
  function textFrame(inst, r) {
    const rad = -(r || 0) * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad);
    let [wx, wy] = A.xf({ x: 0, y: 0, rot: inst.rot || 0, mir: inst.mir }, ux, uy);
    const horiz = Math.abs(wx) >= Math.abs(wy);
    return horiz ? { theta: 0, swap: wx < -1e-6 } : { theta: -90, swap: wy > 1e-6 };
  }
  A.symbolInner = (def, inst) => {
    const m = inst && inst.mir ? -1 : 1, rot = inst ? (inst.rot || 0) : 0; let o = '';
    for (const s of def.draw) {
      if (s.t === 'l') o += `<path class="s-line" d="M${s.p[0]} ${s.p[1]}L${s.p[2]} ${s.p[3]}"/>`;
      else if (s.t === 'r') o += `<rect class="s-line ${fillCls(s, 2)}" x="${s.p[0]}" y="${s.p[1]}" width="${s.p[2]}" height="${s.p[3]}"/>`;
      else if (s.t === 'c') o += `<circle class="s-line ${fillCls(s, 2)}" cx="${s.p[0]}" cy="${s.p[1]}" r="${s.p[2]}"/>`;
      else if (s.t === 'p') { let d = 'M' + s.p[0] + ' ' + s.p[1]; for (let i = 2; i < s.p.length; i += 2) d += 'L' + s.p[i] + ' ' + s.p[i + 1]; if (!s.o) d += 'Z';
        o += `<path class="s-line ${fillCls(s, 0)}" d="${d}"/>`; }
      else if (s.t === 'd') o += `<path class="s-line ${fillCls(s, /z\s*$/i.test(s.d) ? 2 : 0)}" d="${esc(s.d)}"/>`;
      else if (s.t === 'x') {
        const z = (s.z || 1) * 1.05, fr = textFrame(inst || { rot: 0, mir: 0 }, s.r);
        let a = s.a || 'm'; if (fr.swap && a !== 'm') a = a === 's' ? 'e' : 's';
        const ang = -rot * 90 + fr.theta + (inst ? 0 : 0);
        o += `<text class="s-txt" transform="translate(${s.p[0]} ${s.p[1]}) scale(${m} 1) rotate(${ang})" text-anchor="${a === 's' ? 'start' : a === 'e' ? 'end' : 'middle'}" dominant-baseline="central" font-size="${f2(z)}">${esc(s.s)}</text>`;
      }
    }
    return o;
  };
  // which way does a pin's stub point into the body? (for pin numbers)
  function pinDir(def, p, bb) {
    for (const s of def.draw) if (s.t === 'l') { let o = null;
      if (s.p[0] === p.x && s.p[1] === p.y) o = [s.p[2] - p.x, s.p[3] - p.y]; else if (s.p[2] === p.x && s.p[3] === p.y) o = [s.p[0] - p.x, s.p[1] - p.y];
      if (o && (o[0] || o[1])) return Math.abs(o[0]) >= Math.abs(o[1]) ? [Math.sign(o[0]), 0] : [0, Math.sign(o[1])]; }
    const dx = (bb.x0 + bb.x1) / 2 - p.x, dy = (bb.y0 + bb.y1) / 2 - p.y; return Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1]; }
  A.pinOut = (inst, local) => { const def = A.def(inst.def), [dx, dy] = pinDir(def, local, A.bbox(def)); const [wx, wy] = A.xf({ x: 0, y: 0, rot: inst.rot, mir: inst.mir }, dx, dy); return [-wx, -wy]; };
  A.partSVG = (inst, o) => {
    o = o || {}; const def = A.def(inst.def); if (!def) return '';
    const bb = A.bbox(def), wb = A.worldBBox(inst), cx = (wb.x0 + wb.x1) / 2;
    let g = `<g class="inst${o.sel ? ' sel' : ''}${o.ghost ? ' ghost' : ''}" data-id="${inst.id}"><g transform="translate(${inst.x} ${inst.y}) rotate(${(inst.rot || 0) * 90}) scale(${inst.mir ? -1 : 1} 1)">${A.symbolInner(def, inst)}</g>`;
    if (!def.power && def.pins.length > 1) A.pinsOf(inst).forEach(p => { const [dx, dy] = pinDir(def, p.local, bb); const [wx, wy] = A.xf({ x: 0, y: 0, rot: inst.rot, mir: inst.mir }, dx, dy);
      g += `<text class="s-pin" x="${f2(p.x + wx * 1.1 + (wx ? 0 : .8))}" y="${f2(p.y + wy * 1.1 + (wx ? -.65 : 0))}" text-anchor="middle" dominant-baseline="central" font-size=".75">${esc(p.n)}</text>`; });
    if (def.power) { const up = wb.y1 <= .6;
      g += `<text class="s-val" x="${f2(cx)}" y="${f2(up ? wb.y0 - 1 : wb.y1 + 1)}" text-anchor="middle" dominant-baseline="central" font-size="1.1">${esc(inst.value || '')}</text>`; }
    else { const tall = (wb.y1 - wb.y0) > (wb.x1 - wb.x0) * 1.4 && def.pins.length <= 3, cy = (wb.y0 + wb.y1) / 2;
      if (tall) { if (inst.ref) g += `<text class="s-ref" x="${f2(wb.x1 + 1)}" y="${f2(cy - 1)}" text-anchor="start" dominant-baseline="central" font-size="1.15">${esc(inst.ref)}</text>`;
        if (inst.value) g += `<text class="s-val" x="${f2(wb.x1 + 1)}" y="${f2(cy + 1.1)}" text-anchor="start" dominant-baseline="central" font-size="1.1">${esc(inst.value)}</text>`; }
      else { const big = def.pins.length > 3, lx = big ? wb.x0 : cx, an = big ? 'start' : 'middle';
        if (inst.ref) g += `<text class="s-ref" x="${f2(lx)}" y="${f2(wb.y0 - 1.3)}" text-anchor="${an}" dominant-baseline="central" font-size="1.15">${esc(inst.ref)}</text>`;
        if (inst.value) g += `<text class="s-val" x="${f2(lx)}" y="${f2(wb.y1 + 1.6)}" text-anchor="${an}" dominant-baseline="central" font-size="1.1">${esc(inst.value)}</text>`; } }
    g += `<rect class="hit" x="${wb.x0 - .5}" y="${wb.y0 - .5}" width="${wb.x1 - wb.x0 + 1}" height="${wb.y1 - wb.y0 + 1}"/></g>`;
    return g;
  };
  A.VERSION = 'WireFrame EDA 1.0.1';
  A.sheetSVG = () => { const { w, h } = A.SHEET, m = A.doc.meta, bw = 110, rh = 4.4, n = 11, bh = rh * n, tx = w - 3 - bw, ty = h - 3 - bh, L = tx + 2;
    /* KiCad's layout: comments 1-4, name, company, project, then sheet/file, title, size/date/rev, app/id */
    const T = (row, t, sz, cls, dx) => `<text class="tb ${cls || ''}" x="${L + (dx || 0)}" y="${ty + rh * row + rh / 2}" font-size="${sz}" dominant-baseline="central">${esc(t)}</text>`;
    const rows = [7, 8, 9, 10], lines = rows.map(r => `M${tx} ${ty + rh * r}H${w - 3}`);
    return `<g class="sheet"><rect class="paper" x="0" y="0" width="${w}" height="${h}"/><rect class="gridfill" x="0" y="0" width="${w}" height="${h}" fill="url(#gridp)" pointer-events="none"/><rect class="frame" x="3" y="3" width="${w - 6}" height="${h - 6}"/><rect class="frame" x="${tx}" y="${ty}" width="${bw}" height="${bh}"/>` +
      `<path class="frame" d="${lines.join('')}M${tx + 28} ${ty + rh * 9}V${ty + rh * 10}M${tx + 88} ${ty + rh * 9}V${h - 3}"/>` +
      T(0, m.comment || '', 1.6, 'cm') + T(1, m.comment2 || '', 1.6, 'sm') + T(2, m.comment3 || '', 1.6, 'sm') + T(3, m.comment4 || '', 1.6, 'sm') + T(4, m.author || '', 1.7, 'sm') + T(5, m.company || '', 1.9, 'b') + T(6, m.project ? 'Project: ' + m.project : '', 1.5, 'sm') +
      T(7, 'Sheet: /   File: ' + (m.file || 'untitled.wireframe'), 1.4, 'sm') +
      T(8, 'Title: ' + (m.title || ''), 2.3, 'b i') + T(9, 'Size: ' + (m.size || 'A4'), 1.5, 'sm') + T(9, 'Date: ' + (m.date || ''), 1.5, 'sm', 28) + T(9, 'Rev: ' + (m.rev || '1'), 1.6, 'b', 88) +
      T(10, '©' + A.VERSION, 1.5, 'sm') + T(10, 'Id: 1/1', 1.4, 'sm', 88) +
      `<rect data-tb="1" class="tbhit" x="${tx}" y="${ty}" width="${bw}" height="${bh}" fill="transparent" pointer-events="all"><title>Double-click to edit the title block</title></rect></g>`; };
  A.junctions = () => { const d = A.doc, cnt = new Map(); const add = (x, y, n) => { const k = A.key(x, y); const e = cnt.get(k) || { x, y, n: 0 }; e.n += n; cnt.set(k, e); };
    d.wires.forEach(w => { add(w.p[0], w.p[1], 1); add(w.p[2], w.p[3], 1); });
    d.parts.forEach(i => A.pinsOf(i).forEach(p => { if (cnt.has(A.key(p.x, p.y))) add(p.x, p.y, 1); }));
    cnt.forEach(e => d.wires.forEach(w => { if (A.onSeg(e.x, e.y, w) && !((w.p[0] === e.x && w.p[1] === e.y) || (w.p[2] === e.x && w.p[3] === e.y))) e.n += 2; }));
    return [...cnt.values()].filter(e => e.n >= 3); };
  A.worldSVG = (o) => {
    o = o || {}; const d = A.doc, sel = o.sel || new Set(), hl = o.hl || new Set(); let s = '';
    if (o.sheet !== false) s += A.sheetSVG();
    d.wires.forEach(w => { s += `<g data-id="${w.id}" class="wiregrp${sel.has(w.id) ? ' sel' : ''}${hl.has(w.id) ? ' hl' : ''}"><line class="wire" x1="${w.p[0]}" y1="${w.p[1]}" x2="${w.p[2]}" y2="${w.p[3]}"/><line class="hitw" x1="${w.p[0]}" y1="${w.p[1]}" x2="${w.p[2]}" y2="${w.p[3]}"/></g>`; });
    d.parts.forEach(i => { s += A.partSVG(i, { sel: sel.has(i.id) }); });
    A.junctions().forEach(j => { s += `<circle class="junc" cx="${j.x}" cy="${j.y}" r=".42"/>`; });
    d.labels.forEach(l => { const w = Math.max(2, l.text.length * .75 + 1), fl = l.flip ? -1 : 1;
      s += `<g data-id="${l.id}" class="lbl${sel.has(l.id) ? ' sel' : ''}"><path class="lblline" d="M${l.x} ${l.y}h${f2(w * fl)}"/><text x="${l.x + .3 * fl}" y="${l.y - .75}" font-size="1.15" class="s-lbl" text-anchor="${fl < 0 ? 'end' : 'start'}">${esc(l.text)}</text><circle class="lblpt" cx="${l.x}" cy="${l.y}" r=".3"/><rect class="hit" x="${fl < 0 ? l.x - w - .5 : l.x - .5}" y="${l.y - 1.9}" width="${f2(w + 1)}" height="2.6"/></g>`; });
    (d.nc || []).forEach(c => { s += `<g data-id="${c.id}" class="nc${sel.has(c.id) ? ' sel' : ''}"><path d="M${c.x - .8} ${c.y - .8}l1.6 1.6M${c.x + .8} ${c.y - .8}l-1.6 1.6"/><rect class="hit" x="${c.x - 1}" y="${c.y - 1}" width="2" height="2"/></g>`; });
    d.notes.forEach(n => { s += `<g data-id="${n.id}" class="note${sel.has(n.id) ? ' sel' : ''}"><text x="${n.x}" y="${n.y}" font-size="${n.size || 1.4}" class="s-note" dominant-baseline="central">${esc(n.text)}</text><rect class="hit" x="${n.x - .5}" y="${n.y - 1.2}" width="${f2(n.text.length * (n.size || 1.4) * .62 + 1)}" height="2.4"/></g>`; });
    (o.marks || []).forEach(m => { s += `<g class="mark"><circle cx="${m.x}" cy="${m.y}" r="1.2"/><path d="M${m.x - .7} ${m.y - .7}l1.4 1.4M${m.x + .7} ${m.y - .7}l-1.4 1.4"/></g>`; });
    return s;
  };
  // standalone SVG string (export / thumbnails); fixed light colours so it prints well
  A.CSS_EXPORT = `.s-line{stroke:#8a1c1c;fill:none;stroke-width:.15;stroke-linecap:round;stroke-linejoin:round}.s-fill{fill:#fff8c4}.s-solid{fill:#8a1c1c}.s-none{fill:none}.s-txt{fill:#0f6f7a}.s-pin{fill:#0f6f7a}.s-ref{fill:#0f6f7a;font-weight:600}.s-val{fill:#0f6f7a}.s-lbl{fill:#1d4f91;font-weight:600}.s-note{fill:#23262b}.wire{stroke:#0a7a2f;stroke-width:.16;stroke-linecap:round}.junc{fill:#0a7a2f}.lblline{stroke:#1d4f91;stroke-width:.12}.lblpt{fill:#1d4f91}.hit,.hitw{display:none}.paper{fill:#fbfaf5}.frame{fill:none;stroke:#8a1c1c;stroke-width:.2}.tb{fill:#23262b}.tbhit{display:none}.tb.cm{fill:#1d4f91}.tb.b{font-weight:700}.tb.i{font-style:italic}.hs{fill:none!important;stroke-linecap:round;stroke-linejoin:round}.hs.s-txt,.hs.s-pin,.hs.s-val,.hs.s-ref{stroke:#0f6f7a}.hs.s-lbl{stroke:#1d4f91}.hs.s-note,.hs.tb{stroke:#23262b}.hs.tb.cm{stroke:#1d4f91}text{font-family:Inter,Arial,sans-serif}`;
  /* Picture for pasting into Word/Docs: transparent background, mid-tone colours that stay clear on both white and dark pages. */
  const clipPal = c => c.replace(/#8a1c1c/g, '#d84545').replace(/#0a7a2f/g, '#1fb04a').replace(/#0f6f7a/g, '#22b3c1').replace(/#1d4f91/g, '#5b95f0').replace(/#23262b/g, '#9aa0aa').replace(/stroke-width:\.16;/, 'stroke-width:.2;');
  A.exportSVG = (opts) => { opts = opts || {}; const d = A.doc; let x0 = 0, y0 = 0, x1 = A.SHEET.w, y1 = A.SHEET.h;
    if (opts.tight) { x0 = y0 = 1e9; x1 = y1 = -1e9; const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
      d.parts.forEach(i => { const b = A.worldBBox(i); add(b.x0 - 2, b.y0 - 3); add(b.x1 + 2, b.y1 + 3); }); d.wires.forEach(w => { add(w.p[0], w.p[1]); add(w.p[2], w.p[3]); }); d.labels.forEach(l => { add(l.x, l.y - 2); add(l.x + l.text.length + 2, l.y); }); d.notes.forEach(n => { add(n.x, n.y - 2); add(n.x + n.text.length * 1.2, n.y + 2); });
      if (x0 > x1) { x0 = 0; y0 = 0; x1 = 40; y1 = 30; } x0 -= 3; y0 -= 3; x1 += 3; y1 += 3; }
    const w = x1 - x0, h = y1 - y0;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" width="${Math.round(w * 10)}" height="${Math.round(h * 10)}"><style>${opts.clip ? clipPal(A.CSS_EXPORT) : A.CSS_EXPORT}</style>${opts.bg ? `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#fbfaf5"/>` : ''}${A.worldSVG({ sheet: !opts.tight })}</svg>`; };
  A.thumb = (def) => { const b = A.bbox(def), pad = 1.5, w = b.x1 - b.x0 + pad * 2, h = b.y1 - b.y0 + pad * 2;
    return `<svg viewBox="${b.x0 - pad} ${b.y0 - pad} ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${A.symbolInner(def, null)}</svg>`; };
})();
