/* Part creator (box generator + JSON shape editor) and .kicad_sym importer. */
(function () {
  const A = window.App, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const host = () => $('#modalHost');

  A.defFromRows = (m) => { const sides = { l: [], r: [], t: [], b: [] }; m.rows.forEach(r => { if (!r.n && !r.name) return; sides[{ left: 'l', right: 'r', top: 't', bottom: 'b' }[r.side] || 'l'].push((r.n || '?') + ':' + (r.name || '')); });
    const d = window.buildBox('My:' + m.name.replace(/\s+/g, '_'), m.name, 'My parts', m.ref || 'U', m.value || m.name, sides); d.desc = m.desc || ''; d.spec = { rows: m.rows }; return d; };

  /* "Inside the part": one component per line, e.g.  D AC1 +   |  R + - 1k  |  C ~mid GND 100u. Nodes are pin names/numbers, or ~name for an internal node. */
  const TYPES = { R: 'R', C: 'C', L: 'L', D: 'D', LED: 'LED', ZD: 'D_ZENER', ZENER: 'D_ZENER', SCH: 'D_SCHOTTKY', SW: 'SW' };
  const parseInside = (text, rows) => { const sub = [], errs = []; const find = t => { if (t[0] === '~') return t; const r = rows.find(q => String(q.n) === t) || rows.find(q => (q.name || '').toLowerCase() === t.toLowerCase()); return r ? String(r.n) : null; };
    (text || '').split(/\r?\n/).forEach((ln, i) => { ln = ln.replace(/#.*/, '').trim(); if (!ln) return; const w = ln.split(/\s+/), ty = TYPES[w[0].toUpperCase()]; if (!ty) { errs.push('Line ' + (i + 1) + ': unknown part “' + w[0] + '” (use R, C, L, D, LED, ZD, SCH or SW)'); return; }
      const a = w[1] && find(w[1]), b = w[2] && find(w[2]); if (!a || !b) { errs.push('Line ' + (i + 1) + ': “' + (!a ? w[1] : w[2]) + '” is not one of this part’s pins (or an internal ~name)'); return; } const p = { as: ty, pins: [a, b] }; if (w[3]) p.value = w[3]; sub.push(p); });
    return { sub, errs }; };
  const insideText = d => { if (!d || !d.sub) return ''; const nm = n => { if (String(n)[0] === '~') return n; const r = (d.spec ? d.spec.rows : d.pins).find(q => String(q.n) === String(n)); return r && r.name ? r.name : n; }; const back = Object.keys(TYPES).reduce((o, k) => { if (!o[TYPES[k]]) o[TYPES[k]] = k; return o; }, {}); return d.sub.map(s => [back[s.as] || s.as, nm(s.pins[0]), nm(s.pins[1]), s.value || ''].join(' ').trim()).join('\n'); };
  A.newPartDialog = (editId) => {
    const ex = editId ? A.def(editId) : null;
    const m = { name: ex ? ex.name : '', ref: ex ? ex.ref : 'U', value: ex ? ex.value : '', desc: ex ? (ex.desc || '') : '', inside: insideText(ex), rows: ex && ex.spec ? ex.spec.rows.map(r => Object.assign({}, r)) : [{ n: '1', name: 'IN', side: 'left' }, { n: '2', name: 'OUT', side: 'right' }, { n: '3', name: 'VCC', side: 'top' }, { n: '4', name: 'GND', side: 'bottom' }] };
    let tab = ex && !ex.spec ? 'json' : 'pins'; let jsonText = '';
    const cur = () => { if (tab === 'json') { try { const o = JSON.parse(jsonText); o.id = o.id || 'My:' + (o.name || m.name).replace(/\s+/g, '_'); o.name = o.name || m.name; return o; } catch (e) { return null; } }
      if (!m.name.trim()) return null; if (!m.rows.length) return null; return A.defFromRows(m); };
    const draw = () => {
      host().innerHTML = `<div class="back"><div class="modal"><header><b>${ex ? 'Edit part' : 'New part'}</b><button id="pdX" class="small">Close</button></header><div class="mb">
        <div class="grid2"><div class="row"><label>Name</label><input id="pdName" value="${esc(m.name)}" placeholder="e.g. LM358 (DIP-8)"></div><div class="row"><label>Ref prefix</label><input id="pdRef" value="${esc(m.ref)}" maxlength="4"></div>
        <div class="row"><label>Value</label><input id="pdVal" value="${esc(m.value)}"></div><div class="row"><label>Notes</label><input id="pdDesc" value="${esc(m.desc)}"></div></div>
        <div class="tabs"><button data-t="pins" class="${tab === 'pins' ? 'on' : ''}">Pins and box</button><button data-t="inside" class="${tab === 'inside' ? 'on' : ''}">Inside (simulation)</button><button data-t="json" class="${tab === 'json' ? 'on' : ''}">Shape (advanced)</button></div>
        <div class="grid2"><div id="pdLeft"></div><div><div class="preview" id="pdPrev" style="display:flex;align-items:center;justify-content:center"></div><p class="note" id="pdErr"></p></div></div></div>
        <footer><button id="pdCancel">Cancel</button><button id="pdSave" class="accent">${ex ? 'Save changes' : 'Add to My parts'}</button></footer></div></div>`;
      const L = $('#pdLeft');
      if (tab === 'pins') { L.innerHTML = `<table class="pins"><thead><tr><th style="width:18%">Pin no.</th><th>Name</th><th style="width:30%">Side</th><th></th></tr></thead><tbody>${m.rows.map((r, i) => `<tr data-i="${i}"><td><input data-k="n" value="${esc(r.n)}"></td><td><input data-k="name" value="${esc(r.name)}"></td><td><select data-k="side">${['left', 'right', 'top', 'bottom'].map(s => `<option${r.side === s ? ' selected' : ''}>${s}</option>`).join('')}</select></td><td><button class="small danger" data-del="${i}" aria-label="Remove pin">×</button></td></tr>`).join('')}</tbody></table>
          <div class="row" style="margin-top:8px"><button id="pdAdd" class="small">+ Add pin</button><button id="pdBulk" class="small">Paste a pin list…</button></div><p class="note">Pins are drawn in the order listed on each side. Pin names are shown inside the box.</p>`; }
      else if (tab === 'inside') { L.innerHTML = `<textarea id="pdIn" rows="11" spellcheck="false" placeholder="D AC1 +\nD AC2 +\nD - AC1\nD - AC2">${esc(m.inside)}</textarea><p class="note">Build the part from simple components so it simulates. One per line: <code>type node node [value]</code>. Types: R, C, L, D, LED, ZD, SCH, SW. Nodes are your pin names or numbers, or <code>~name</code> for a hidden internal node. Diodes go anode then cathode. Example, a bridge rectifier with pins AC1, AC2, +, −:<br><code>D AC1 +</code> <code>D AC2 +</code> <code>D - AC1</code> <code>D - AC2</code><br>Leave empty for a part that is only a drawing.</p>`; }
      else { if (!jsonText) { const c = (tab === 'json' && ex) ? ex : (A.defFromRows(m)); jsonText = JSON.stringify({ name: c.name, ref: c.ref, value: c.value, pins: c.pins, draw: c.draw }, null, 1); }
        L.innerHTML = `<textarea id="pdJson" rows="16" spellcheck="false">${esc(jsonText)}</textarea><p class="note">Units are grid squares (1 square = 10 px). Shapes: <code>l</code> line [x1,y1,x2,y2], <code>r</code> rect [x,y,w,h], <code>c</code> circle [cx,cy,r], <code>p</code> polygon, <code>d</code> SVG path, <code>x</code> text. Pins sit on the connection end, at whole numbers.</p>`; }
      bind(); preview();
    };
    const preview = () => { const d = cur(), p = $('#pdPrev'), er = $('#pdErr'); if (!d || !d.pins || !d.draw) { p.innerHTML = '<span class="muted">Nothing to preview yet</span>'; er.textContent = tab === 'json' ? 'The shape text is not valid yet.' : 'Give the part a name and at least one pin.'; return; }
      er.textContent = ''; p.innerHTML = A.thumb(d).replace('<svg ', '<svg style="width:100%;height:100%" '); };
    const bind = () => {
      $('#pdX').onclick = $('#pdCancel').onclick = () => host().innerHTML = '';
      $('#pdName').oninput = e => { m.name = e.target.value; preview(); }; $('#pdRef').oninput = e => m.ref = e.target.value; $('#pdVal').oninput = e => m.value = e.target.value; $('#pdDesc').oninput = e => m.desc = e.target.value;
      $$('.tabs button').forEach(b => b.onclick = () => { if (b.dataset.t === 'json') jsonText = ''; tab = b.dataset.t; draw(); });
      if (tab === 'pins') { $$('table.pins [data-k]').forEach(el => el.oninput = el.onchange = e => { m.rows[+e.target.closest('tr').dataset.i][e.target.dataset.k] = e.target.value; preview(); });
        $$('[data-del]').forEach(b => b.onclick = () => { m.rows.splice(+b.dataset.del, 1); draw(); });
        $('#pdAdd').onclick = () => { const last = m.rows[m.rows.length - 1]; m.rows.push({ n: String(m.rows.length + 1), name: '', side: last ? last.side : 'left' }); draw(); const ins = $$('table.pins tbody tr:last-child input'); ins[1] && ins[1].focus(); };
        $('#pdBulk').onclick = () => A.askText('Paste pins: one per line as number, name, side (left/right/top/bottom). Example: 1 VCC top', '1 VCC top\n2 IN left\n3 OUT right', t => { if (!t) return;
          t.split(/\r?\n/).forEach(l => { const w = l.trim().split(/[\s,;]+/); if (w.length >= 2) { const side = ['left', 'right', 'top', 'bottom'].includes((w[2] || '').toLowerCase()) ? w[2].toLowerCase() : 'left'; m.rows.push({ n: w[0], name: w[1], side }); } }); draw(); }, true); }
      else if (tab === 'inside') $('#pdIn').oninput = e => { m.inside = e.target.value; };
      else $('#pdJson').oninput = e => { jsonText = e.target.value; preview(); };
      $('#pdSave').onclick = () => { const d = cur(); if (!d || !d.pins || !d.draw) return A.toast('Fill in the name and pins first'); d.ref = m.ref || d.ref || 'U'; d.value = m.value || d.value || d.name; d.desc = m.desc || d.desc || '';
        if (tab === 'json') { d.id = ex ? ex.id : 'My:' + d.name.replace(/\s+/g, '_'); } if (ex) d.id = ex.id; delete d.builtin; if ((m.inside || '').trim()) { const pr = parseInside(m.inside, m.rows); if (pr.errs.length) { tab = 'inside'; draw(); return A.toast(pr.errs[0], 4500); } d.sub = pr.sub; } else delete d.sub; A.addCustom(d); host().innerHTML = ''; A.L.cat = 'My parts'; A.refreshLib(); A.toast('Saved “' + d.name + '” to My parts'); A.render(); A.renderProps(); };
    };
    draw();
  };
  A.editPart = (id) => A.newPartDialog(id);

  /* ---------- .kicad_sym importer (KiCad 6 and later) ---------- */
  function sexp(t) { let i = 0; const n = t.length;
    const rd = () => { while (i < n && /\s/.test(t[i])) i++; if (t[i] === '(') { i++; const a = []; for (;;) { while (i < n && /\s/.test(t[i])) i++; if (t[i] === ')') { i++; return a; } if (i >= n) return a; a.push(rd()); } }
      if (t[i] === '"') { let s = ''; i++; while (i < n && t[i] !== '"') { if (t[i] === '\\') i++; s += t[i++]; } i++; return { s }; }
      let s = ''; while (i < n && !/[\s()]/.test(t[i])) s += t[i++]; return s; };
    return rd(); }
  const str = v => v && v.s !== undefined ? v.s : v, find = (a, k) => a.find(x => Array.isArray(x) && x[0] === k), all = (a, k) => a.filter(x => Array.isArray(x) && x[0] === k);
  const q = v => Math.round(v / 1.27 * 2) / 2;
  function symToDef(sym, lib, parents, unit) { unit = unit || 1;
    const name = str(sym[1]); let body = sym; const props = {}; all(sym, 'property').forEach(p => props[str(p[1])] = str(p[2]));
    const parentName = find(sym, 'extends') && str(find(sym, 'extends')[1]), par = parentName && parents[parentName];
    const subs = all(sym, 'symbol').length ? sym : (par ? par.raw : sym); const pins = [], draw = []; const isPow = !!find(sym, 'power');
    all(subs, 'symbol').concat(subs === sym && !all(sym, 'symbol').length ? [sym] : []).forEach(sub => {
      const m = /_(\d+)_(\d+)$/.exec(str(sub[1]) || ''); if (m && ((+m[1] !== 0 && +m[1] !== unit) || (+m[2] !== 0 && +m[2] !== 1))) return;
      const fillOf = s => { const f = find(s, 'fill'), t = f && find(f, 'type'); const v = t && t[1]; return v === 'background' ? 2 : v === 'outline' ? 1 : 0; };
      sub.forEach(it => { if (!Array.isArray(it)) return; const k = it[0];
        if (k === 'rectangle') { const a = find(it, 'start'), b = find(it, 'end'), x1 = q(+a[1]), y1 = -q(+a[2]), x2 = q(+b[1]), y2 = -q(+b[2]); draw.push({ t: 'r', p: [Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)], f: fillOf(it) }); }
        else if (k === 'polyline') { const pts = []; all(find(it, 'pts'), 'xy').forEach(p => pts.push(q(+p[1]), -q(+p[2]))); const cl = pts.length > 4 && pts[0] === pts[pts.length - 2] && pts[1] === pts[pts.length - 1]; draw.push({ t: 'p', p: pts, f: fillOf(it), o: cl ? 0 : 1 }); }
        else if (k === 'circle') { const c = find(it, 'center'), r = find(it, 'radius'); draw.push({ t: 'c', p: [q(+c[1]), -q(+c[2]), q(+r[1])], f: fillOf(it) }); }
        else if (k === 'arc') { const s = find(it, 'start'), mm = find(it, 'mid'), e = find(it, 'end'); if (s && mm && e) { const P = [s, mm, e].map(p => [+p[1], +p[2]]), [x1, y1] = P[0], [x2, y2] = P[1], [x3, y3] = P[2];
            const dd = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)); if (Math.abs(dd) > 1e-9) { const ux = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / dd, uy = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / dd;
              const r = Math.hypot(x1 - ux, y1 - uy), ccw = ((x2 - x1) * (y3 - y2) - (y2 - y1) * (x3 - x2)) > 0; const a1 = Math.atan2(y1 - uy, x1 - ux), a3 = Math.atan2(y3 - uy, x3 - ux); let span = ccw ? a3 - a1 : a1 - a3; span = ((span % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
              draw.push({ t: 'd', d: `M${q(x1)} ${-q(y1)}A${q(r)} ${q(r)} 0 ${span > Math.PI ? 1 : 0} ${ccw ? 0 : 1} ${q(x3)} ${-q(y3)}`, f: fillOf(it) }); } } }
        else if (k === 'text') { const at = find(it, 'at'); draw.push({ t: 'x', p: [q(+at[1]), -q(+at[2])], s: str(it[1]), a: 'm', z: 1 }); }
        else if (k === 'pin') { const at = find(it, 'at'), len = +find(it, 'length')[1], ang = +at[3] || 0, nm = str(find(it, 'name')[1]), num = str(find(it, 'number')[1]), hid = it.includes('hide') || (find(it, 'hide') && find(it, 'hide')[1] !== 'no'); if (hid && !isPow) return;
          const px = q(+at[1]), py = -q(+at[2]), L = q(len), dx = Math.round(Math.cos(ang * Math.PI / 180)) * L, dy = -Math.round(Math.sin(ang * Math.PI / 180)) * L; const name = nm === '~' ? '' : nm;
          pins.push({ n: num, name, x: px, y: py }); draw.push({ t: 'l', p: [px, py, px + dx, py + dy] });
          if (name) { const dir = dx > 0 ? 'R' : dx < 0 ? 'L' : dy < 0 ? 'U' : 'D', tx = px + dx + (dx > 0 ? .8 : dx < 0 ? -.8 : 0), ty = py + dy + (dy > 0 ? .8 : dy < 0 ? -.8 : 0);
            draw.push(dir === 'R' ? { t: 'x', p: [tx, ty], s: name, a: 's', z: .9 } : dir === 'L' ? { t: 'x', p: [tx, ty], s: name, a: 'e', z: .9 } : { t: 'x', p: [tx, ty], s: name, a: dir === 'U' ? 's' : 'e', z: .9, r: 90 }); } } }); });
    if (!pins.length && !draw.length) return null;
    return { id: 'Imp:' + (lib || 'lib') + ':' + name, name, ref: (props.Reference || 'U').replace(/^#/, '') || 'U', value: props.Value || name, desc: props.Description || '', kw: props.ki_keywords || '', pins, draw, power: isPow || undefined, cat: 'My parts', raw: sym };
  }
  A.importKicadSym = (text, fname) => {
    let tree; try { tree = sexp(text); } catch (e) { return A.toast('Could not read that KiCad file'); } if (!Array.isArray(tree) || tree[0] !== 'kicad_symbol_lib') return A.toast('That is not a .kicad_sym library');
    const lib = (fname || 'lib').replace(/\.kicad_sym$/i, ''), syms = all(tree, 'symbol'), parents = {}; syms.forEach(s => parents[str(s[1])] = { raw: s });
    const defs = []; syms.forEach(s => { try { const d = symToDef(s, lib, parents); if (d) defs.push(d); } catch (e) {} });
    if (!defs.length) return A.toast('No symbols found in that file');
    const done = (list) => { list.forEach(d => { const c = Object.assign({}, d); delete c.raw; A.addCustom(c); }); A.L.cat = 'My parts'; A.refreshLib(); A.toast('Imported ' + list.length + ' symbol(s) into My parts'); };
    if (defs.length <= 12) return done(defs);
    host().innerHTML = `<div class="back"><div class="modal"><header><b>Import from ${esc(lib)} (${defs.length} symbols)</b><button id="ikX" class="small">Close</button></header><div class="mb"><input id="ikQ" type="search" placeholder="Filter symbols…"><div id="ikL" style="max-height:46vh;overflow:auto"></div></div><footer><span class="note" id="ikN"></span><button id="ikOk" class="accent">Import selected</button></footer></div></div>`;
    const chosen = new Set(); const list = () => { const qq = $('#ikQ').value.toLowerCase(); $('#ikL').innerHTML = defs.filter(d => !qq || (d.name + ' ' + d.desc + ' ' + d.kw).toLowerCase().includes(qq)).slice(0, 200).map(d => `<label class="pi"><input type="checkbox" data-n="${esc(d.name)}"${chosen.has(d.name) ? ' checked' : ''}><span>${esc(d.name)}<small>${esc(d.desc)}</small></span></label>`).join(''); $('#ikN').textContent = chosen.size + ' selected'; };
    $('#ikQ').oninput = list; $('#ikL').onchange = e => { e.target.checked ? chosen.add(e.target.dataset.n) : chosen.delete(e.target.dataset.n); $('#ikN').textContent = chosen.size + ' selected'; };
    $('#ikX').onclick = () => host().innerHTML = ''; $('#ikOk').onclick = () => { const l = defs.filter(d => chosen.has(d.name)); host().innerHTML = ''; if (l.length) done(l); }; list();
  };
  A._k = { sexp, all, find, str, q, symToDef };
})();
