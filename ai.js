/* AI assistant: description -> netlist spec -> auto place, route, verify. Also builds single parts.
   Transport: Electron bridge, optional proxy (config.js), or copy/paste (no key anywhere in this page). */
(function () {
  const A = window.App, S = A.S, $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const POWER = /^(GND|AGND|DGND|PGND|VSS|VCC|VDD|VEE|VBAT|VIN|VBUS|\+?\d+(\.\d+)?V\d*|[+-]\d+(\.\d+)?V|\+?\d+V\d+|3V3|5V|12V|9V)$/i;
  const isGnd = n => /^(GND|AGND|DGND|PGND|VSS|0V)$/i.test(n), isNeg = n => /^(VEE|-\d+(\.\d+)?V)$/i.test(n);

  /* ---------- spec <-> doc ---------- */
  A.docToSpec = () => {
    const nets = A.nets().filter(n => n.pins.length || n.powerPins.length), used = {};
    const parts = A.doc.parts.filter(p => !A.def(p.def).power).map(p => { used[p.def] = 1; return { ref: p.ref, part: p.def, value: p.value || '', rot: p.rot || 0 }; });
    return { title: A.doc.meta.title, parts, nets: nets.map(n => ({ name: n.auto ? undefined : n.name, pins: n.pins.map(p => p.inst.ref + '.' + p.n).concat(n.powerPins.length ? [] : []) })).filter(n => n.pins.length > 1 || n.name),
      _powerNets: nets.filter(n => n.powerPins.length).map(n => ({ name: n.name, pins: n.pins.map(p => p.inst.ref + '.' + p.n) })) };
  };
  const catalog = () => Object.values(A.LIB).filter(d => !d.kicad).map(d => `${d.id} | ${d.name} | ${d.pins.slice(0, 24).map(p => p.n + '=' + (p.name || '·')).join(' ')}${d.pins.length > 24 ? ' …' : ''}`).join('\n');
  const SPEC_DOC = `{
  "title": "short title",
  "newParts": [   // only for parts NOT in the catalog. "sides" lists pins as "number:name" top to bottom (left/right) or left to right (top/bottom)
    { "id": "LM3914", "name": "LM3914 LED bar driver", "ref": "U", "value": "LM3914", "sides": { "l": ["5:SIG","4:RLO"], "r": ["1:LED1","18:LED2"], "t": ["3:V+"], "b": ["2:V-"] },
      "sim": { "as": "OPAMP", "pins": ["name or number of the part's pin for each model pin"] } }   // sim: pick the closest built-in model so the part works in the simulator; see the model list below
  ],
  "parts": [      // every component. "part" is a catalog id or a newParts id. col/row (whole numbers) give a rough left-to-right, top-to-bottom layout. rot = 0..3 (quarter turns clockwise)
    { "ref": "R1", "part": "R", "value": "330", "col": 1, "row": 0, "rot": 0 }
  ],
  "nets": [       // every electrical connection. pins are "REF.pinNumber" using the catalog pin numbers. Power nets named GND, VCC, +5V, +9V, +3V3, -12V... become power symbols
    { "name": "GND", "pins": ["R1.2", "D1.2"] },
    { "name": "SIG", "pins": ["R1.1", "U1.3"] }
  ],
  "notes": "two or three sentences: what the circuit does and how to read it"
}`;
  A.circuitPrompt = (desc, modify) => `You are a circuit design assistant inside a schematic editor used by VCE Systems Engineering (Australia) teachers and students. Design the circuit described below and reply with ONE JSON object only, no markdown fences and no text before or after it.

JSON format (comments shown with // are for you, do not include them):
${SPEC_DOC}

Rules:
- Every newParts entry should carry a "sim" field choosing the closest built-in simulator model (so the circuit can be simulated). Models and their pin order:
${A.simTable()}
- Use catalog parts whenever one fits. Use ONLY the pin numbers listed in the catalog for those parts. If you need a part that is not in the catalog, define it in newParts with its real datasheet pin numbers and names.
- Every part reference must be unique (R1, R2, C1, U1, Q1, D1, SW1, BT1...). Use realistic standard values (E12 resistors, common capacitor values) and sensible ratings in the value text.
- Every pin that matters must appear in a net. Include supply decoupling, pull-ups/pull-downs, base/gate resistors and current-limit resistors where a real build needs them. Use power symbols via net names (GND, +5V, +9V, VCC, +3V3, -12V) instead of drawing a battery, unless the question is about the battery.
- A net lists 2 or more pins. Put each pin in exactly one net.
- Layout: signal flows left to right (inputs at col 0), larger ICs in the middle, outputs on the right, related parts share a row.
- Keep it as simple as the task allows, and mention important design equations or values in notes.
${modify ? '\nThe schematic is currently:\n' + JSON.stringify(modify) + '\nReturn the complete updated circuit in the same format (all parts and nets, not just changes).\n' : ''}
Catalog (id | name | pin number=name):
${catalog()}

Circuit to design:
${desc}`;
  A.partPrompt = (desc) => `You are a parts-library assistant inside a schematic editor. Create the schematic symbol for the part described below and reply with ONE JSON object only (no markdown fences, no other text):
{ "name": "LM358 dual op-amp (DIP-8)", "ref": "U", "value": "LM358", "desc": "one line description",
  "sides": { "l": ["2:1IN-","3:1IN+","6:2IN-","5:2IN+"], "r": ["1:1OUT","7:2OUT"], "t": ["8:V+"], "b": ["4:V-"] },
  "sim": { "as": "OPAMP", "pins": ["2","3","1","8","4"] } }
Pins are written "number:name". Left and right pins are listed top to bottom, top and bottom pins left to right. Use the real datasheet pin numbers and names for the exact package named. Put inputs on the left, outputs on the right, power on top, ground on the bottom. Include every pin of the package (use "NC" as the name for no-connect pins).

SIMULATION: the "sim" field makes the part work in the simulator. Pick the built-in model that behaves most like the part (leave "sim" out only if none fits). "pins" lists, in the model's pin order, which of THIS part's pins (number or name) plays each role. If the part contains several identical blocks (e.g. a dual op-amp) model the first block. Models and their pin order:
${A.simTable()}

Part:
${desc}`;
  A.askPrompt = (q) => `You are a friendly electronics tutor helping with a VCE Systems Engineering schematic. Answer the question about the circuit below in plain language a Year 11/12 student can follow. Check the connections for mistakes (missing resistors, wrong polarity, floating inputs, shorts) and say exactly which references are involved.

Circuit netlist:
${A.netlistText()}

Question:
${q}`;

  const parseJSON = (t) => { t = String(t).trim(); try { return JSON.parse(t); } catch (e) {} const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(t); if (fence) try { return JSON.parse(fence[1]); } catch (e) {}
    const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1).replace(/^\s*\/\/.*$/gm, '')); } catch (e) {} } return null; };

  /* ---------- build a circuit from a spec ---------- */
  const pinIndex = (inst, ref) => { const pins = A.pinsOf(inst), s = String(ref); return pins.find(p => p.n === s) || pins.find(p => (p.name || '').toLowerCase() === s.toLowerCase()) || null; };
  const hits = (x0, y0, x1, y1, b) => y0 === y1 ? (y0 > b.y0 && y0 < b.y1 && Math.max(Math.min(x0, x1), b.x0) < Math.min(Math.max(x0, x1), b.x1)) : (x0 > b.x0 && x0 < b.x1 && Math.max(Math.min(y0, y1), b.y0) < Math.min(Math.max(y0, y1), b.y1));
  A.buildFromSpec = async (spec, opts) => {
    opts = opts || {}; const warn = [];
    (spec.newParts || []).forEach(np => { try { if (!np.id) np.id = 'AI:' + np.name; if (A.LIB[np.id] && A.LIB[np.id].builtin) return;
      let d; if (np.sides) d = window.buildBox(np.id, np.name || np.id, 'My parts', np.ref || 'U', np.value || np.name, np.sides); else if (np.pins && np.draw) d = { id: np.id, name: np.name, ref: np.ref || 'U', value: np.value || np.name, pins: np.pins, draw: np.draw }; else return;
      d.desc = np.desc || ''; if (np.sim && np.sim.as) d.sim = np.sim; A.addCustom(d); } catch (e) { warn.push('Could not make part ' + np.id); } });
    const specParts = (spec.parts || []).filter(p => p && p.ref && p.part); if (!specParts.length) throw new Error('The reply had no parts.');
    if (opts.replace !== false) { A.doc = A.newDoc(); }
    const defs = {}; for (const sp of specParts) { let id = sp.part, d = A.def(id) || await A.ensureDef(id);
      if (!d) { const k = Object.keys(A.LIB).find(k => k.toLowerCase() === String(id).toLowerCase() || (A.LIB[k].name || '').toLowerCase() === String(id).toLowerCase()); if (k) { id = k; d = A.def(k); } }
      if (!d) { const pins = new Set(); (spec.nets || []).forEach(n => (n.pins || []).forEach(r => { const [rf, pn] = String(r).split('.'); if (rf === sp.ref) pins.add(pn); })); const arr = [...pins]; const sides = { l: [], r: [], t: [], b: [] }; arr.forEach((pn, i) => sides[i % 2 ? 'r' : 'l'].push(pn + ':' + pn));
        d = window.buildBox('AI:' + sp.ref, String(sp.part), 'My parts', sp.ref.replace(/\d+$/, '') || 'U', sp.value || String(sp.part), sides); A.addCustom(d); id = d.id; warn.push(`“${sp.part}” is not in the library, so ${sp.ref} is a generic box. Check its pin numbers.`); }
      defs[sp.ref] = { id, d }; }
    // layout: rows from spec.row, columns from spec.col; size from rotated bbox
    const items = specParts.map((sp, i) => ({ sp, i, row: Number.isFinite(+sp.row) ? +sp.row : Math.floor(i / 4), col: Number.isFinite(+sp.col) ? +sp.col : i % 4 }));
    const rows = {}; items.forEach(it => (rows[it.row] = rows[it.row] || []).push(it)); const insts = {}; let y = 26;
    Object.keys(rows).map(Number).sort((a, b) => a - b).forEach(r => { const row = rows[r].sort((a, b) => a.col - b.col || a.i - b.i); let x = 22, h = 0; const placed = [];
      row.forEach(it => { const { id, d } = defs[it.sp.ref]; const tmp = { x: 0, y: 0, rot: (+it.sp.rot || 0) % 4, mir: it.sp.mir ? 1 : 0, def: id }; A.LIB[id] = A.LIB[id] || d; const b = A.worldBBox(tmp), w = b.x1 - b.x0, hh = b.y1 - b.y0;
        const inst = { id: A.id('p'), def: id, x: Math.round(x - b.x0 + 4), y: 0, rot: tmp.rot, mir: tmp.mir, ref: it.sp.ref, value: it.sp.value !== undefined ? String(it.sp.value) : d.value }; placed.push([inst, b, hh]); x += w + 14; h = Math.max(h, hh); });
      placed.forEach(([inst, b, hh]) => { inst.y = Math.round(y + h / 2 - (b.y0 + b.y1) / 2); A.doc.parts.push(inst); insts[inst.ref] = inst; }); y += h + 17; });
    A.doc.meta.title = spec.title || A.doc.meta.title;
    // nets
    const nets = []; let auto = 1; (spec.nets || []).forEach(n => { const pins = []; (n.pins || []).forEach(r => { const [rf, ...rest] = String(r).trim().split('.'); const inst = insts[rf]; if (!inst) { warn.push('Net references unknown part ' + rf); return; }
        const p = pinIndex(inst, rest.join('.')); if (!p) { warn.push(`Part ${rf} has no pin “${rest.join('.')}”.`); return; } pins.push(p); }); if (pins.length) nets.push({ name: n.name || ('N' + auto++), named: !!n.name, pins }); });
    const bbs = A.doc.parts.map(p => A.worldBBox(p));
    const route = (labelsFor) => {
      A.doc.wires = []; A.doc.labels = []; A.doc.parts = A.doc.parts.filter(p => !(A.def(p.def) || {}).power);
      const wire = (x0, y0, x1, y1) => { if (x0 !== x1 || y0 !== y1) A.doc.wires.push({ id: A.id('w'), p: [x0, y0, x1, y1] }); };
      nets.forEach(n => { const out = n.pins.map(p => ({ p, o: A.pinOut(p.inst, p.local) }));
        const power = POWER.test(n.name) && n.named;
        if (power) { out.forEach(({ p, o }) => { const len = isGnd(n.name) ? 2 : 2, ex = p.x + o[0] * len, ey = p.y + o[1] * len; wire(p.x, p.y, ex, ey);
            const sym = isGnd(n.name) ? 'GND' : isNeg(n.name) ? 'VEE' : 'VCC'; A.doc.parts.push({ id: A.id('p'), def: sym, x: ex, y: ey, rot: 0, mir: 0, ref: '#PWR0' + (A.doc.parts.length + 1), value: n.name }); }); return; }
        const useLabel = labelsFor.has(n.name) || labelsFor.has('*') || out.length > 5;
        if (!useLabel) { const stub = q => [q.p.x + q.o[0] * 2, q.p.y + q.o[1] * 2];
          const clear = pts => { for (let i = 0; i + 1 < pts.length; i++) for (const bb of bbs) if (hits(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], { x0: bb.x0 + .3, y0: bb.y0 + .3, x1: bb.x1 - .3, y1: bb.y1 - .3 })) return false; return true; };
          const pair = (a, b) => { const a1 = stub(a), b1 = stub(b), cands = (a1[0] === b1[0] || a1[1] === b1[1]) ? [[]] : (Math.abs(a.o[0]) ? [[[b1[0], a1[1]]], [[a1[0], b1[1]]]] : [[[a1[0], b1[1]]], [[b1[0], a1[1]]]]);
            for (const c of cands) { const pts = [a1, ...c, b1]; if (clear(pts)) return pts; } return null; };
          const left = out.slice().sort((u, v) => u.p.x - v.p.x || u.p.y - v.p.y), order = [left.shift()]; while (left.length) { const l = order[order.length - 1]; left.sort((u, v) => Math.hypot(u.p.x - l.p.x, u.p.y - l.p.y) - Math.hypot(v.p.x - l.p.x, v.p.y - l.p.y)); order.push(left.shift()); }
          const segs = []; let ok = true; for (let i = 0; i + 1 < order.length && ok; i++) { const pts = pair(order[i], order[i + 1]); if (!pts) { ok = false; break; } segs.push([order[i], order[i + 1], pts]); }
          if (ok) { const seen = new Set(), put = (x0, y0, x1, y1) => { const k = [x0, y0, x1, y1].join(); const k2 = [x1, y1, x0, y0].join(); if (seen.has(k) || seen.has(k2)) return; seen.add(k); wire(x0, y0, x1, y1); };
            segs.forEach(([a, b, pts]) => { put(a.p.x, a.p.y, pts[0][0], pts[0][1]); for (let i = 0; i + 1 < pts.length; i++) put(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]); const l = pts[pts.length - 1]; put(l[0], l[1], b.p.x, b.p.y); }); return; } }
        out.forEach(({ p, o }) => { const ex = p.x + o[0] * 2, ey = p.y + o[1] * 2; wire(p.x, p.y, ex, ey); A.doc.labels.push({ id: A.id('l'), x: ex, y: ey, text: n.name, flip: o[0] < 0 ? 1 : 0 }); }); });
    };
    const want = nets.map(n => new Set(n.pins.map(p => p.inst.ref + '.' + p.n)));
    const verify = () => { const bad = new Set(); A.nets().forEach(g => { const got = new Set(g.pins.map(p => p.inst.ref + '.' + p.n)); if (!got.size) return; if (!want.some(w => w.size === got.size && [...w].every(x => got.has(x)))) got.forEach(x => bad.add(x)); }); return bad; };
    const labelsFor = new Set(); route(labelsFor); let bad = verify();
    for (let pass = 0; pass < 2 && bad.size; pass++) { nets.forEach(n => { if (n.pins.some(p => bad.has(p.inst.ref + '.' + p.n))) labelsFor.add(n.name); }); route(labelsFor); bad = verify(); }
    if (bad.size) { labelsFor.add('*'); route(labelsFor); bad = verify(); if (bad.size) warn.push('Some nets may not match the description. Run Check and inspect.'); }
    A.centerContent(); A.doc.meta.file = A.projects && A.projects.cur ? A.projects.name() + '.wireframe' : A.doc.meta.file; A.hist = []; A.fut = []; A.commit(); A.emit('load'); return { warnings: warn, notes: spec.notes || '' };
  };

  /* ---------- transport ---------- */
  A.aiMode = () => (window.electronAI && window.electronAI.ask) ? 'electron' : (window.AI_PROXY_URL ? 'proxy' : 'paste');
  A.aiAsk = async (prompt, kind) => {
    if (window.electronAI && window.electronAI.ask) return await window.electronAI.ask(prompt, kind);
    if (window.AI_PROXY_URL) { const r = await fetch(window.AI_PROXY_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt, kind }) });
      if (!r.ok) throw new Error('The AI server answered ' + r.status + (r.status === 429 ? ' (too many requests, try again shortly)' : '')); const j = await r.json(); if (j.error) throw new Error(j.error); return j.text; }
    throw new Error('no-transport'); };

  /* ---------- dialog ---------- */
  A.aiDialog = (startKind) => {
    const host = $('#modalHost'); let kind = startKind || 'circuit'; const mode = A.aiMode(); const hasDoc = A.doc.parts.length > 0;
    const ph = { circuit: 'e.g. A 555 timer astable flashing an LED about once per second, powered from 9 V', part: 'e.g. LM317T adjustable voltage regulator in a TO-220 package', ask: 'e.g. Why is my transistor never switching on?' };
    host.innerHTML = `<div class="back"><div class="modal"><header><b>AI Assistant</b><button id="aiX" class="small">Close</button></header><div class="mb">
      <div class="tabs"><button data-k="circuit">Make a circuit</button><button data-k="part">Make a part</button><button data-k="ask">Ask about this circuit</button></div>
      <textarea id="aiText" rows="4" placeholder=""></textarea>
      <label id="aiModRow" class="note"><input type="checkbox" id="aiMod" ${hasDoc ? '' : 'disabled'}> Change the circuit that is on the sheet now (otherwise the sheet is replaced${hasDoc ? '; Undo brings it back' : ''})</label>
      <div id="aiPaste" ${mode === 'paste' ? '' : 'hidden'}><p class="note">No AI server is connected, so this works by copy and paste with any Claude chat: 1) press Copy request, 2) paste it into Claude, 3) paste Claude’s reply below and press Build.</p>
        <textarea id="aiReply" rows="6" placeholder="Paste Claude’s reply here"></textarea></div>
      <div id="aiOut" class="note"></div></div>
      <footer>${mode === 'paste' ? '<button id="aiCopy">Copy request</button><button id="aiBuild" class="accent">Build from reply</button>' : '<button id="aiGo" class="accent">Generate</button>'}</footer></div></div>`;
    const setKind = k => { kind = k; host.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.k === k)); $('#aiText').placeholder = ph[k]; $('#aiModRow').hidden = k !== 'circuit'; if (mode === 'paste') $('#aiBuild').textContent = k === 'ask' ? 'Show answer' : 'Build from reply'; if (mode !== 'paste') $('#aiGo').textContent = k === 'ask' ? 'Ask' : 'Generate'; };
    host.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setKind(b.dataset.k)); setKind(kind); $('#aiX').onclick = () => host.innerHTML = ''; $('#aiText').focus();
    const promptNow = () => { const t = $('#aiText').value.trim(); if (!t) { $('#aiOut').textContent = 'Describe what you want first.'; return null; }
      return kind === 'circuit' ? A.circuitPrompt(t, $('#aiMod').checked && hasDoc ? A.docToSpec() : null) : kind === 'part' ? A.partPrompt(t) : A.askPrompt(t); };
    const finish = async (reply) => { const out = $('#aiOut');
      if (kind === 'ask') { out.innerHTML = '<div style="white-space:pre-wrap;color:var(--fg)">' + esc(reply) + '</div>'; return; }
      const spec = parseJSON(reply); if (!spec) { out.textContent = 'I could not read that reply as JSON. Ask Claude to “reply with the JSON object only”.'; return; }
      try { if (kind === 'part') { const d = spec.sides ? window.buildBox('My:' + spec.name.replace(/\s+/g, '_'), spec.name, 'My parts', spec.ref || 'U', spec.value || spec.name, spec.sides) : null;
          if (!d) { out.textContent = 'The reply did not contain pins for a part.'; return; } d.desc = spec.desc || ''; if (spec.sim && spec.sim.as) d.sim = spec.sim; A.addCustom(d); A.L.cat = 'My parts'; A.refreshLib(); host.innerHTML = ''; A.toast('Added “' + d.name + '” to My parts. Click it to place it.'); return; }
        const res = await A.buildFromSpec(spec, { replace: true }); host.innerHTML = ''; A.fit(); A.runCheck(); const m = $('#msgs'); m.insertAdjacentHTML('afterbegin', (res.notes ? `<div class="msg ok">${esc(res.notes)}</div>` : '') + res.warnings.map(w => `<div class="msg bad">${esc(w)}</div>`).join('')); A.toast('Circuit built. Tweak it like any other sheet.'); }
      catch (e) { out.textContent = 'Could not build that: ' + e.message; } };
    if (mode === 'paste') { $('#aiCopy').onclick = async () => { const p = promptNow(); if (!p) return; try { await navigator.clipboard.writeText(p); $('#aiOut').textContent = 'Request copied (' + Math.round(p.length / 1000) + ' KB). Paste it into Claude.'; } catch (e) { const ta = $('#aiReply'); ta.value = p; ta.select(); $('#aiOut').textContent = 'Copy was blocked, so the request is in the box below. Copy it from there.'; } };
      $('#aiBuild').onclick = () => { const r = $('#aiReply').value.trim(); if (!r) { $('#aiOut').textContent = 'Paste Claude’s reply first.'; return; } finish(r); }; }
    else $('#aiGo').onclick = async () => { const p = promptNow(); if (!p) return; const b = $('#aiGo'); b.disabled = true; $('#aiOut').innerHTML = '<span class="spin"></span>Thinking… this can take up to a minute.';
      try { await finish(await A.aiAsk(p, kind)); } catch (e) { $('#aiOut').textContent = 'The AI request failed: ' + e.message; } b.disabled = false; };
  };
  $('#bAI').onclick = () => A.aiDialog();

  /* ---------- lesson circuits ---------- */
  A.loadExample = async (id) => { const ex = window.EXAMPLES.find(e => e.id === (id || 'flasher')); const res = await A.buildFromSpec(JSON.parse(JSON.stringify(ex.spec)), { replace: true }); return res; };
  A.examplesDialog = () => { const host = $('#modalHost');
    host.innerHTML = `<div class="back"><div class="modal"><header><b>Lesson circuits</b><button id="exX" class="small">Close</button></header><div class="mb"><p class="note">Pick one, press Play, and poke at it. Everything on the sheet can be changed.</p><div class="exgrid">${window.EXAMPLES.map(e => `<button class="excard" data-ex="${e.id}"><span class="lv">${esc(e.level)}</span><b>${esc(e.title)}</b><span>${esc(e.desc)}</span></button>`).join('')}</div></div></div></div>`;
    $('#exX').onclick = () => host.innerHTML = ''; host.querySelectorAll('[data-ex]').forEach(b => b.onclick = async () => { host.innerHTML = ''; try { const ex = window.EXAMPLES.find(x => x.id === b.dataset.ex); A.projects.newProject(ex.title); const r = await A.loadExample(b.dataset.ex); A.runCheck(); $('#msgs').insertAdjacentHTML('afterbegin', r.notes ? `<div class="msg ok">${esc(r.notes)}</div>` : ''); } catch (e) { A.toast('Could not open that circuit'); } }); };
})();
