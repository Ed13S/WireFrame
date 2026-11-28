/* WireFrame Build view (part 1): breadboard geometry, part footprints/looks, connectivity.
   Units are breadboard grid steps (1 step = 0.1 inch = 2.54 mm). y grows downwards. */
(function () {
  const A = window.App, esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const B = A.B = { N: 30, rows: { top: [3, 4, 5, 6, 7], bot: [10, 11, 12, 13, 14] }, railY: [0, 1, 16, 17], PX: 12 };
  /* ---------- the board ---------- */
  B.holeStrip = (x, y) => { x = Math.round(x * 1e6) / 1e6; y = Math.round(y * 1e6) / 1e6; if (!Number.isInteger(x) || !Number.isInteger(y) || x < 1 || x > B.N) return null;
    if (y >= 3 && y <= 7) return 'T' + x; if (y >= 10 && y <= 14) return 'B' + x; const ri = B.railY.indexOf(y); if (ri >= 0 && x % 6 !== 0 && x <= B.N - 0) return 'R' + ri; return null; };
  B.railHole = (ri, nearX) => { let best = null; for (let x = 1; x <= B.N; x++) if (x % 6 !== 0 && (best === null || Math.abs(x - nearX) < Math.abs(best - nearX))) best = x; return [best, B.railY[ri]]; };
  /* ---------- classification and footprints ---------- */
  const BOARDS = new Set(['ARDUINO_UNO', 'ARDUINO_NANO', 'ESP32_DEVKIT', 'ESP32_C3', 'PICO', 'STM32_BLUEPILL']);
  const FREE = new Set(['BAT', 'VDC', 'VAC', 'IDC', 'MOTOR', 'SERVO', 'SPEAKER', 'LAMP', 'TRANSFORMER', 'RELAY', 'JACK_DC', 'USB_C', 'VM', 'AM', 'MM', 'SCOPE', 'INVERTER']);
  const num = s => /^\d+$/.test(String(s)) ? +s : NaN;
  B.kind = (d) => { const id = d.id, n = d.pins.length, c = d.cat || '';
    const fp = d.footprint || '', evenNum = n % 2 === 0 && d.pins.every(p => !isNaN(num(p.n))); // AI/custom parts: the footprint tells us the real package
    if (fp && !BOARDS.has(id) && !d.builtin) { if (/DIP|SOIC|SO-?\d|SSOP|TSSOP/i.test(fp) && evenNum) return 'dip'; if (/TO-?220|TO-?247|TO-?3P/i.test(fp) && n === 3) return 'to220'; if (/TO-?92|SOT-?23|TO-?126/i.test(fp) && n === 3) return 'to92'; if (/SIP|PinHeader|Pin_Socket|Connector_Pin/i.test(fp) && n >= 2) return 'sip'; }
    if (BOARDS.has(id)) return 'board'; if (id === 'SW_PUSH') return 'push'; if (id === 'SW') return 'toggle'; if (id === 'SW_SPDT') return 'spdt'; if (id === 'POT' || id === 'RTRIM') return 'pot'; if (id === 'LED') return 'led'; if (id === 'SEG7') return 'seg';
    if (id === 'BUZZER') return 'buzzer'; if (id === 'MOTOR') return 'motor'; if (id === 'BAT' || id === 'VDC') return 'battery';
    if (FREE.has(id)) return 'free'; if (id === 'R' || id === 'R_US') return 'res'; if (/^(D|D_SCHOTTKY|D_ZENER)$/.test(id)) return 'diode'; if (id === 'CP') return 'elec'; if (id === 'C' || id === 'CVAR') return 'ceramic';
    if (n === 2) return 'axial'; if (n === 3) return /Semicond|Analog$/.test(c) || /^Q_|SCR|TL431|REG|LM35/.test(id) ? 'to92' : 'header';
    const allNum = d.pins.every(p => !isNaN(num(p.n)));
    if ((/IC|MCU/.test(c) || /^Transistor|^Amplifier|^Timer|^Logic|^MCU|^Interface/.test(id)) && n % 2 === 0 && n <= 40 && allNum) return 'dip';
    if (/Sensor|Display|Module|Connector/.test(c) || n > 12) return 'header'; if (n % 2 === 0 && allNum) return 'dip'; return 'header'; };
  /* legs: [{pin, x, y}] in rot-0 local coordinates; w,h extent for hit-testing and drawing */
  B.legsOf = (d) => { const k = B.kind(d), P = d.pins.slice(), L = []; const byN = p => d.pins.find(q => q.n === p);
    const push = (pin, x, y) => L.push({ pin, x, y });
    if (k === 'res' || k === 'diode' || k === 'axial') { push(P[0].n, 0, 0); push(P[1].n, 4, 0); }
    else if (k === 'toggle') { push(P[0].n, 0, 0); push(P[1].n, 3, 0); }
    else if (k === 'led' || k === 'elec') { push(P[0].n, 0, 0); push(P[1].n, 1, 0); } else if (k === 'ceramic') { push(P[0].n, 0, 0); push(P[1].n, 2, 0); }
    else if (k === 'buzzer') { push(P[0].n, 0, 0); push(P[1].n, 2, 0); }
    else if (k === 'push') { push(P[0].n, 0, 0); push(P[0].n, 2, 0); push(P[1].n, 0, 3); push(P[1].n, 2, 3); }
    else if (k === 'to92' || k === 'to220' || k === 'pot') { P.forEach((p, i) => push(p.n, i, 0)); }
    else if (k === 'battery' || k === 'motor' || k === 'free' || k === 'spdt') { P.forEach((p, i) => push(p.n, i * 2, 0)); }
    else if (k === 'dip') { const sorted = P.slice().sort((a, b) => num(a.n) - num(b.n)), h = sorted.length / 2; sorted.forEach((p, i) => i < h ? push(p.n, i, 0) : push(p.n, sorted.length - 1 - i, 3)); }
    else if (k === 'seg') { const sorted = P.slice(); const h = Math.ceil(sorted.length / 2); sorted.forEach((p, i) => i < h ? push(p.n, i, 0) : push(p.n, i - h, 3)); }
    else if (k === 'board') { const n = P.length, top = Math.ceil(n / 2); P.forEach((p, i) => i < top ? push(p.n, i + 1, 1) : push(p.n, i - top + 1, 11)); }
    else { P.forEach((p, i) => push(p.n, i, 0)); }
    return L; };
  B.sizeOf = (d) => { const k = B.kind(d), L = B.legsOf(d); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; L.forEach(l => { x0 = Math.min(x0, l.x); x1 = Math.max(x1, l.x); y0 = Math.min(y0, l.y); y1 = Math.max(y1, l.y); });
    if (k === 'board') return { x0: 0, y0: 0, x1: x1 + 2, y1: 12 }; if (k === 'res' || k === 'diode' || k === 'axial') return { x0: -.5, y0: -1, x1: 4.5, y1: 1 }; if (k === 'led') return { x0: -.5, y0: -3, x1: 1.5, y1: .6 };
    if (k === 'dip' || k === 'seg') return { x0: -.5, y0: -.2, x1: x1 + .5, y1: y1 + .2 }; return { x0: x0 - .6, y0: y0 - 2, x1: x1 + .6, y1: y1 + .8 }; };
  B.xf = (inst, x, y) => { const bb = inst.bb; let rx = x, ry = y; for (let i = 0; i < (bb.rot || 0); i++) { const t = rx; rx = -ry; ry = t; } return [bb.x + rx, bb.y + ry]; };
  B.legPos = (inst) => { const d = A.def(inst.def); if (!d || !inst.bb) return []; return B.legsOf(d).map((l, i) => { const [x, y] = B.xf(inst, l.x, l.y); return { pin: l.pin, i, x, y }; }); };
  B.insts = () => A.doc.parts.filter(p => { const d = A.def(p.def); return d && !d.power && !(p.ref || '').startsWith('#'); });
  B.bbox = (inst) => { const d = A.def(inst.def), s = B.sizeOf(d); const c = [[s.x0, s.y0], [s.x1, s.y0], [s.x1, s.y1], [s.x0, s.y1]].map(([x, y]) => B.xf(inst, x, y)); return { x0: Math.min(...c.map(p => p[0])), x1: Math.max(...c.map(p => p[0])), y0: Math.min(...c.map(p => p[1])), y1: Math.max(...c.map(p => p[1])) }; };
  /* power supplies live only in the build view: {id,x,y,volts}. terminals: + at (x,y), - at (x+2,y) */
  B.supLegs = (s) => [{ pin: '+', x: s.x, y: s.y, sup: s }, { pin: '-', x: s.x + 2, y: s.y, sup: s }];

  /* ---------- connectivity ---------- */
  B.connectivity = () => { const parent = new Map(); const find = k => { if (!parent.has(k)) parent.set(k, k); let r = k; while (parent.get(r) !== r) r = parent.get(r); let c = k; while (parent.get(c) !== r) { const n = parent.get(c); parent.set(c, r); c = n; } return r; }; const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) parent.set(a, b); };
    const free = []; // free leg points: {key,x,y}
    const addLeg = (key, pinKey, x, y) => { find(key); uni(key, pinKey); const st = B.holeStrip(x, y); if (st) uni(key, 'S:' + st); else free.push({ key, x, y }); };
    B.insts().forEach(inst => { if (!inst.bb) return; B.legPos(inst).forEach(l => addLeg('L:' + inst.id + ':' + l.i, 'P:' + inst.id + ':' + l.pin, l.x, l.y)); });
    (A.doc.bsup || []).forEach(s => B.supLegs(s).forEach((l, i) => addLeg('L:' + s.id + ':' + i, 'U:' + s.id + ':' + l.pin, l.x, l.y)));
    const target = (x, y) => { const st = B.holeStrip(x, y); if (st) return 'S:' + st; let best = null, bd = .75; free.forEach(f => { const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = f.key; } }); return best; };
    B.target = target; (A.doc.bw || []).forEach(j => { const a = target(j.a[0], j.a[1]), b = target(j.b[0], j.b[1]); if (a && b) uni(a, b); });
    const groups = new Map(); [...parent.keys()].forEach(k => { if (k[0] !== 'P' && k[0] !== 'U') return; const r = find(k); (groups.get(r) || groups.set(r, []).get(r)).push(k); });
    return { find, uni, free, groups: [...groups.values()], nodeOf: (x, y) => { const t = target(x, y); return t ? find(t) : null; } }; };
  /* nets as the schematic sees them: [{pins:[{ref,pin,inst}], plus:[sup], minus:[sup]}] */
  B.nets = () => { const c = B.connectivity(), out = [], byId = {}; B.insts().forEach(i => byId[i.id] = i); const sups = {}; (A.doc.bsup || []).forEach(s => sups[s.id] = s);
    c.groups.forEach(g => { const pins = [], plus = [], minus = []; g.forEach(k => { const sp = k.split(':'), t = sp[0], id = sp[1], pin = sp.slice(2).join(':'); if (t === 'P' && byId[id]) pins.push({ inst: byId[id], pin, ref: byId[id].ref }); else if (t === 'U' && sups[id]) (pin === '+' ? plus : minus).push(sups[id]); });
      if (pins.length || plus.length || minus.length) out.push({ pins, plus, minus }); }); return out; };
})();
