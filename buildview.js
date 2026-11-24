/* WireFrame Build view (part 2): drawing, interaction, mode switch. */
(function () {
  const A = window.App, B = A.B, $ = (s, r) => (r || document).querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NS = 'http://www.w3.org/2000/svg', stage = $('#stage'), S = A.S;
  const bsvg = document.createElementNS(NS, 'svg'); bsvg.id = 'bsvg'; bsvg.setAttribute('tabindex', '0'); bsvg.setAttribute('hidden', ''); stage.insertBefore(bsvg, $('#svg').nextSibling);
  bsvg.innerHTML = '<defs><filter id="bglow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2"/></filter></defs><g id="bworld"><g id="bboard"></g><g id="bparts"></g><g id="bwires"></g><g id="bover"></g></g>';
  const world = $('#bworld', bsvg), gBoard = $('#bboard', bsvg), gParts = $('#bparts', bsvg), gWires = $('#bwires', bsvg), gOver = $('#bover', bsvg);
  const V = A.BV = { view: { tx: 60, ty: 40, sc: 22 }, sel: new Set(), mouse: [0, 0], drag: null, draft: null, live: null, rot: 0 };
  A.mode = 'sch';
  const applyV = () => { const v = V.view; world.setAttribute('transform', `translate(${v.tx} ${v.ty}) scale(${v.sc})`); $('#stZoom').textContent = Math.round(v.sc / 22 * 100) + '%'; };
  A.bfit = () => { const r = bsvg.getBoundingClientRect(); let x0 = -2, y0 = -2, x1 = B.N + 3, y1 = 19; B.insts().forEach(i => { if (!i.bb) return; const b = B.bbox(i); x0 = Math.min(x0, b.x0 - 1); y0 = Math.min(y0, b.y0 - 1); x1 = Math.max(x1, b.x1 + 1); y1 = Math.max(y1, b.y1 + 1); });
    (A.doc.bsup || []).forEach(s => { x0 = Math.min(x0, s.x - 2); y0 = Math.min(y0, s.y - 5); x1 = Math.max(x1, s.x + 5); y1 = Math.max(y1, s.y + 2); });
    const w = x1 - x0, h = y1 - y0, sc = Math.max(4, Math.min(40, Math.min((r.width - 20) / w, (r.height - 20) / h))); V.view = { sc, tx: (r.width - w * sc) / 2 - x0 * sc, ty: (r.height - h * sc) / 2 - y0 * sc }; applyV(); };

  /* ---------- drawing the board ---------- */
  let boardKey = '';
  function drawBoard() { const N = B.N; if (boardKey === N) return; boardKey = N; let holes = '', t = '';
    for (let x = 1; x <= N; x++) { [...B.rows.top, ...B.rows.bot].forEach(y => holes += `M${x - .17} ${y - .17}h.34v.34h-.34z`); if (x % 5 === 0 || x === 1) { t += `<text x="${x}" y="2.25" class="bn">${x}</text><text x="${x}" y="15.4" class="bn">${x}</text>`; } }
    B.railY.forEach((y, ri) => { for (let x = 1; x <= N; x++) if (x % 6 !== 0) holes += `M${x - .17} ${y - .17}h.34v.34h-.34z`; });
    'abcde'.split('').forEach((c, i) => t += `<text x=".15" y="${3.2 + i}" class="bn">${c}</text>`); 'fghij'.split('').forEach((c, i) => t += `<text x=".15" y="${10.2 + i}" class="bn">${c}</text>`);
    gBoard.innerHTML = `<rect x="-.1" y="-1" width="${N + 1.2}" height="19.2" rx=".7" fill="#ece9df" stroke="#b9b5a6" stroke-width=".12"/><rect x=".2" y="8.1" width="${N + .6}" height="1.8" rx=".3" fill="#dcd8cb"/>` +
      `<path d="M.6 -.45H${N + .4}" stroke="#d33" stroke-width=".12"/><path d="M.6 1.45H${N + .4}" stroke="#25c" stroke-width=".12"/><path d="M.6 15.55H${N + .4}" stroke="#25c" stroke-width=".12"/><path d="M.6 17.45H${N + .4}" stroke="#d33" stroke-width=".12"/>` +
      `<text x="-.3" y=".3" class="bn" fill="#d33">+</text><text x="-.3" y="1.3" class="bn" fill="#25c">−</text><text x="-.3" y="16.3" class="bn" fill="#25c">−</text><text x="-.3" y="17.3" class="bn" fill="#d33">+</text><path d="${holes}" fill="#3a3a3a"/>${t}`; }

  /* ---------- part looks ---------- */
  const CB = ['#111', '#7b3f00', '#d62d20', '#f08a00', '#f0d000', '#1a9b3a', '#1c64d8', '#8a3fd0', '#888', '#f4f4f4'];
  function bands(v) { let r = A.parseValue(v, 1000); if (!(r > 0)) r = 1000; let e = Math.floor(Math.log10(r)) - 1; let m = Math.round(r / Math.pow(10, e)); if (m >= 100) { m = Math.round(m / 10); e++; } if (m < 10) { m *= 10; e--; } return [CB[Math.floor(m / 10) % 10], CB[m % 10], e >= 0 && e <= 9 ? CB[e] : e === -1 ? '#d4af37' : '#c0c0c0']; }
  const LEDC = { RED: '#ff2a2a', GREEN: '#25d84a', BLUE: '#3a7bff', YELLOW: '#ffd21a', WHITE: '#f4f4f4', ORANGE: '#ff8a1a', AMBER: '#ffb21a' };
  const ledColor = inst => { const v = String(inst.value || '').toUpperCase(); for (const k in LEDC) if (v.includes(k)) return LEDC[k]; return LEDC.RED; };
  const BOARDC = { ARDUINO_UNO: '#0b7a8c', ARDUINO_NANO: '#1b5fb5', ESP32_DEVKIT: '#1b1b1f', ESP32_C3: '#1b1b1f', PICO: '#1f8a42', STM32_BLUEPILL: '#1a3fa0' };
  const led = (cx, cy, col, on, r) => `<circle cx="${cx}" cy="${cy}" r="${r || .22}" fill="${on ? col : '#3a3a3a'}" stroke="#111" stroke-width=".05"/>` + (on ? `<circle cx="${cx}" cy="${cy}" r="${(r || .22) * 3}" fill="${col}" opacity=".5" filter="url(#bglow)"/>` : '');
  B.look = (inst, live) => { const d = A.def(inst.def), k = B.kind(d), L = B.legsOf(d), el = live && live.el; let g = '';
    const wire = (x1, y1, x2, y2) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="#b5b5b5" stroke-width=".14" stroke-linecap="round"/>`; const txt = (x, y, t, sz, c, a) => `<text x="${x}" y="${y}" font-size="${sz || .55}" fill="${c || '#222'}" text-anchor="${a || 'middle'}" dominant-baseline="central" class="bt">${esc(t)}</text>`;
    if (k === 'res') { const b = bands(inst.value); g += wire(0, 0, 4, 0) + `<rect x=".7" y="-.42" width="2.6" height=".84" rx=".35" fill="#e2c28f" stroke="#a9885a" stroke-width=".05"/>` + [1.2, 1.65, 2.1].map((x, i) => `<rect x="${x}" y="-.42" width=".2" height=".84" fill="${b[i]}"/>`).join('') + `<rect x="2.7" y="-.42" width=".2" height=".84" fill="#d4af37"/>`; }
    else if (k === 'diode' || k === 'axial') { const zen = inst.def === 'D_ZENER'; g += wire(0, 0, 4, 0) + `<rect x=".8" y="-.4" width="2.4" height=".8" rx=".15" fill="${k === 'axial' ? '#5a7fb5' : zen ? '#7a7a7a' : '#1a1a1a'}"/>` + (k === 'diode' ? `<rect x="2.6" y="-.4" width=".25" height=".8" fill="#ddd"/>` : '') + txt(2, -.9, inst.value || '', .45, '#444'); }
    else if (k === 'led') { const col = ledColor(inst), on = el && !el.dead && (el.lum || 0) > .02, lum = el ? el.lum || 0 : 0;
      g += wire(0, 0, 0, -.9) + wire(1, 0, 1, -.6) + `<path d="M-.4 -.7h1.8v-.7a.9.9 0 0 0 -.9 -.9a.9.9 0 0 0 -.9 .9z" fill="${col}" opacity="${on ? 1 : .55}" stroke="#0003" stroke-width=".05"/><rect x="-.4" y="-.75" width="1.8" height=".18" fill="${col}" opacity=".8"/>` + (on ? `<circle cx=".5" cy="-1.5" r="${1.3 + lum * 1.6}" fill="${col}" opacity="${(.25 + lum * .6).toFixed(2)}" filter="url(#bglow)"/>` : '') + (el && el.dead ? txt(.5, -2.9, 'Popped!', .55, '#e03c31') : '') + `<rect x="1.32" y="-2.1" width=".12" height="1.35" fill="#0006"/>` + txt(-.62, -.15, '+', .5, '#111') + txt(1.62, -.15, '−', .5, '#111') + (el && !el.dead && A.Sim && A.Sim.v && el.n && (A.Sim.v[el.n[0]] - A.Sim.v[el.n[1]]) < -.5 ? txt(.5, -3.5, 'Backwards! Flip it', .5, '#ff8a00') : ''); }
    else if (k === 'elec') g += `<rect x="-.7" y="-2.7" width="2.4" height="2.5" rx=".35" fill="#2a3b66"/><rect x="1.2" y="-2.7" width=".5" height="2.5" fill="#cfd6e6"/>` + wire(0, 0, 0, -.2) + wire(1, 0, 1, -.2) + txt(.4, -1.45, inst.value || '', .42, '#fff') + txt(1.45, -1.45, '−', .5, '#223');
    else if (k === 'ceramic') g += wire(0, 0, 0, -.7) + wire(2, 0, 2, -.7) + `<ellipse cx="1" cy="-1.5" rx=".95" ry="1" fill="#e5a53a" stroke="#a9742a" stroke-width=".05"/>` + txt(1, -1.5, inst.value || '', .4, '#533');
    else if (k === 'buzzer') g += `<circle cx="1" cy="-1.7" r="1.5" fill="#1c1c1c" stroke="#000" stroke-width=".06"/><circle cx="1" cy="-1.7" r=".28" fill="#555"/>` + txt(.1, -2.7, '+', .55, '#fff') + wire(0, 0, 0, -.3) + wire(2, 0, 2, -.3) + (el && el.on ? `<circle cx="1" cy="-1.7" r="2.2" fill="none" stroke="#ffd21a" stroke-width=".12" opacity=".8"/>` : '');
    else if (k === 'to92') g += `<path d="M-.5 -.2V-1.3a1.5 1.5 0 0 1 3 0V-.2z" fill="#1d1d1d" stroke="#000" stroke-width=".05"/>` + L.map((l, i) => wire(l.x, l.y, l.x, -.2)).join('') + txt(1, -1.2, (inst.value || '').slice(0, 7), .42, '#ddd') + L.map((l, i) => txt(l.x, .55, (d.pins.find(p => p.n === l.pin) || {}).name || l.pin, .38, '#555')).join('');
    else if (k === 'pot') g += `<rect x="-.55" y="-2.8" width="3.1" height="2.6" rx=".3" fill="#2465b0"/><circle cx="1" cy="-1.5" r=".85" fill="#d8d8d8" stroke="#888" stroke-width=".06"/><path d="M1 -1.5V-2.2" stroke="#444" stroke-width=".14"/>` + L.map(l => wire(l.x, l.y, l.x, -.2)).join('');
    else if (k === 'push') { const dn = live && live.sw; g += `<rect x="-.35" y="-.35" width="2.7" height="3.7" rx=".3" fill="#2e2e33"/><circle cx="1" cy="1.5" r=".95" fill="${dn ? '#8a1f1f' : '#d03a3a'}" stroke="#000" stroke-width=".06"/>`; }
    else if (k === 'dip' || k === 'seg') { const h = L.length / 2, w = Math.max(...L.map(l => l.x)); const seg = k === 'seg';
      g += `<rect x="-.4" y=".35" width="${w + .8}" height="2.3" rx=".15" fill="${seg ? '#1c1c1c' : '#20242b'}"/>` + (seg ? `<text x="${w / 2}" y="1.5" font-size="1.4" fill="#f33" text-anchor="middle" dominant-baseline="central" class="bt">8.</text>` : `<circle cx=".2" cy="1.5" r=".2" fill="#555"/>` + txt(w / 2 + .1, 1.5, (inst.value || d.name || '').slice(0, 14), Math.min(.6, 3.2 * (w + 1) / Math.max(8, (inst.value || d.name || '').length * 4.5)), '#cfd6e3'));
      g += L.map(l => `<rect x="${l.x - .1}" y="${l.y === 0 ? 0 : 2.6}" width=".2" height=".4" fill="#c9c9c9"/>`).join(''); }
    else if (k === 'board') { const w = Math.max(...L.map(l => l.x)) + 2, col = BOARDC[inst.def] || '#1f5a3a', m = live && live.mcu || {};
      g += `<rect x="0" y="0" width="${w}" height="12" rx=".5" fill="${col}" stroke="#0006" stroke-width=".08"/><rect x=".4" y=".35" width="${w - .8}" height="1.3" fill="#111"/><rect x=".4" y="10.35" width="${w - .8}" height="1.3" fill="#111"/>`;
      L.forEach(l => { g += `<circle cx="${l.x}" cy="${l.y}" r=".3" fill="#caa84a"/>` + `<text x="${l.x}" y="${l.y < 6 ? 2.0 : 10.0}" font-size=".42" fill="#eee" text-anchor="${l.y < 6 ? 'start' : 'end'}" dominant-baseline="central" transform="rotate(-90 ${l.x} ${l.y < 6 ? 2.0 : 10.0})" class="bt">${esc((d.pins.find(p => p.n === l.pin) || {}).name || l.pin)}</text>`; });
      const cx = w / 2; g += `<rect x="${cx - 1.6}" y="4.2" width="3.2" height="3.2" rx=".2" fill="#222"/><text x="${cx}" y="5.8" font-size=".5" fill="#ccc" text-anchor="middle" class="bt">${esc((inst.value || d.name).slice(0, 10))}</text>`;
      if (/ARDUINO/.test(inst.def)) g += `<rect x="${w - 3.2}" y="-.6" width="2.6" height="2.2" fill="#c8ccd2"/>` + led(w - 2, 3.4, '#2fe05a', live && live.on, .2) + txt(w - 2, 4.1, 'ON', .35, '#fff') + led(w - 3.3, 3.4, '#ffa51a', m.L, .2) + txt(w - 3.3, 4.1, 'L', .35, '#fff') + led(w - 4.6, 3.4, '#ffd21a', m.TX, .2) + txt(w - 4.6, 4.1, 'TX', .35, '#fff') + led(w - 5.9, 3.4, '#ffd21a', m.RX, .2) + txt(w - 5.9, 4.1, 'RX', .35, '#fff');
      else g += `<rect x="${cx - 1.2}" y="-.7" width="2.4" height="1.6" fill="#c8ccd2"/>` + led(1.2, 6, '#ff3b30', live && live.on, .2) + txt(1.2, 6.7, 'PWR', .35, '#fff') + led(1.2, 8, '#2f7bff', m.L, .2) + txt(1.2, 8.7, 'IO2', .35, '#fff');
      g += txt(cx, 11.2, inst.def === 'ARDUINO_UNO' ? 'Arduino Uno' : (d.name || '').slice(0, 18), .5, '#fff'); }
    else if (k === 'battery') g += `<rect x="-.4" y="-3.6" width="3.2" height="3.4" rx=".3" fill="#2b2b2f"/><rect x="-.4" y="-3.6" width="3.2" height=".9" fill="#d4af37"/>` + txt(1.2, -1.4, inst.value || '', .6, '#fff') + `<circle cx="0" cy="0" r=".25" fill="#d33"/><circle cx="2" cy="0" r=".25" fill="#222"/>` + wire(0, 0, 0, -.2) + wire(2, 0, 2, -.2);
    else if (k === 'motor') { const a = live && live.ang || 0; g += `<circle cx="1" cy="-2.2" r="2" fill="#8c9099" stroke="#444" stroke-width=".08"/><g transform="translate(1 -2.2) rotate(${a})"><path d="M-1.4 0H1.4M0 -1.4V1.4" stroke="#222" stroke-width=".28" stroke-linecap="round"/></g>` + wire(0, 0, 0, -.2) + wire(2, 0, 2, -.2); }
    else if (k === 'free') g += `<rect x="-.5" y="-3" width="${Math.max(...L.map(l => l.x)) + 1}" height="2.8" rx=".3" fill="#5b6572"/>` + L.map(l => wire(l.x, l.y, l.x, -.2)).join('') + txt(Math.max(...L.map(l => l.x)) / 2, -1.6, (d.name || '').slice(0, 12), .5, '#fff');
    else { const n = L.length, w = n - 1; g += `<rect x="-.6" y="-2.6" width="${w + 1.2}" height="2.4" rx=".25" fill="${/Display/.test(d.cat) ? '#1b4a8f' : '#1d6a46'}"/>` + txt(w / 2, -1.7, (inst.value || d.name || '').slice(0, 16), Math.min(.55, 1.7 * (w + 1.2) / Math.max(6, (inst.value || d.name || '').length * 2)), '#fff') + L.map(l => `<circle cx="${l.x}" cy="${l.y - .2}" r=".16" fill="#caa84a"/>` + `<text x="${l.x}" y="-.7" font-size=".36" fill="#fff" text-anchor="middle" class="bt">${esc((d.pins.find(p => p.n === l.pin) || {}).name || l.pin).slice(0, 4)}</text>`).join(''); }
    return g; };
  const legDots = inst => B.legPos(inst).map(l => `<circle cx="${l.x}" cy="${l.y}" r=".2" fill="#cfcfcf" stroke="#777" stroke-width=".05"/>`).join('');

  /* ---------- parts, supplies and jumper wires ---------- */
  const lens = { '+': '#d33', '-': '#222' };
  function supSVG(s) { return `<g data-s="${s.id}" class="bsup${V.sel.has('s:' + s.id) ? ' sel' : ''}"><rect x="${s.x - .5}" y="${s.y - 3.7}" width="3.4" height="3.6" rx=".35" fill="#2b2b2f" stroke="#000" stroke-width=".06"/><rect x="${s.x - .5}" y="${s.y - 3.7}" width="3.4" height="1" fill="#d4af37"/><text x="${s.x + 1.2}" y="${s.y - 1.5}" font-size=".7" fill="#fff" text-anchor="middle" dominant-baseline="central" class="bt">${s.volts} V</text><text x="${s.x + 1.2}" y="${s.y - 2.7}" font-size=".42" fill="#222" text-anchor="middle" dominant-baseline="central" class="bt">BATTERY</text>` +
    `<circle cx="${s.x}" cy="${s.y}" r=".3" fill="#d33"/><text x="${s.x}" y="${s.y + .8}" font-size=".5" fill="#d33" text-anchor="middle" class="bt">+</text><circle cx="${s.x + 2}" cy="${s.y}" r=".3" fill="#222"/><text x="${s.x + 2}" y="${s.y + .8}" font-size=".5" fill="#222" text-anchor="middle" class="bt">−</text></g>`; }
  function jumperPath(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < .01) return `M${a[0]} ${a[1]}`; const lift = Math.min(3.2, .5 + L * .22), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = -dy / L, ny = dx / L, s = (ny > 0 ? -1 : 1) * 1; return `M${a[0]} ${a[1]}Q${(mx + nx * lift * s).toFixed(2)} ${(my + ny * lift * s).toFixed(2)} ${b[0]} ${b[1]}`; }
  const JC = ['#2f6fdd', '#f2c200', '#2fa84f', '#ff8a1f', '#9b4fd0', '#19b5c9'];
  B.jcolor = (j, n) => j.color || JC[n % JC.length];
  function wiresSVG() { let o = ''; (A.doc.bw || []).forEach((j, i) => { const c = B.jcolor(j, i), sel = V.sel.has('j:' + j.id), d = jumperPath(j.a, j.b); const lv = V.live && V.live.vj && V.live.vj[j.id];
      o += `<g data-j="${j.id}"><path d="${d}" stroke="transparent" stroke-width="1" fill="none" class="hitj"/>${sel ? `<path d="${d}" stroke="#fff" stroke-width=".6" fill="none" opacity=".9"/>` : ''}<path d="${d}" stroke="#0004" stroke-width=".46" fill="none" transform="translate(.08 .1)"/><path d="${d}" stroke="${c}" stroke-width=".36" fill="none" stroke-linecap="round"/>` +
        (lv ? `<path d="${d}" stroke="#fff" stroke-width=".12" fill="none" stroke-dasharray=".5 .9" stroke-dashoffset="${(-lv.ph).toFixed(2)}" opacity=".85"/>` : '') +
        `<circle cx="${j.a[0]}" cy="${j.a[1]}" r=".27" fill="${c}" stroke="#0006" stroke-width=".06"/><circle cx="${j.b[0]}" cy="${j.b[1]}" r=".27" fill="${c}" stroke="#0006" stroke-width=".06"/></g>`; }); return o; }
  B.draw = () => { drawBoard(); let p = ''; const live = V.live;
    (A.doc.bsup || []).forEach(s => p += supSVG(s));
    B.insts().forEach(inst => { if (!inst.bb) return; const bb = inst.bb, sel = V.sel.has(inst.id), lv = live ? live.of(inst) : null, bx = B.bbox(inst);
      p += `<g data-id="${inst.id}" class="bpart${sel ? ' sel' : ''}"><rect x="${bx.x0}" y="${bx.y0}" width="${bx.x1 - bx.x0}" height="${bx.y1 - bx.y0}" fill="transparent" class="hitp"/><g transform="translate(${bb.x} ${bb.y}) rotate(${(bb.rot || 0) * 90})">${B.look(inst, lv)}</g>${legDots(inst)}` +
        `<text x="${(bx.x0 + bx.x1) / 2}" y="${bx.y0 - .35}" font-size=".6" fill="#333" text-anchor="middle" class="bt bref">${esc(inst.ref)}</text>` + (sel ? `<rect x="${bx.x0 - .1}" y="${bx.y0 - .1}" width="${bx.x1 - bx.x0 + .2}" height="${bx.y1 - bx.y0 + .2}" fill="none" stroke="#d8731a" stroke-width=".14" stroke-dasharray=".4 .3"/>` : '') + '</g>'; });
    gParts.innerHTML = p; gWires.innerHTML = wiresSVG(); drawOver(); };
  function drawOver() { let o = ''; const [mx, my] = V.mouse;
    if (A.mode === 'build' && S.placing) { const df = A.def(S.placing); if (df) { const inst = { id: 'ghost', def: S.placing, ref: A.nextRef(df.ref || 'U'), value: df.value || df.name, bb: { x: mx, y: my, rot: V.rot } }; o += `<g opacity=".6" transform="translate(${mx} ${my}) rotate(${V.rot * 90})">${B.look(inst, null)}</g>`; } }
    if (V.draft) { const a = V.draft.a, b = V.mouse; o += `<path d="${jumperPath(a, b)}" stroke="#d8731a" stroke-width=".36" fill="none" stroke-linecap="round" opacity=".85"/><circle cx="${a[0]}" cy="${a[1]}" r=".3" fill="#d8731a"/>`; }
    if (V.hover) o += `<circle cx="${V.hover[0]}" cy="${V.hover[1]}" r=".34" fill="none" stroke="#d8731a" stroke-width=".1"/>`;
    gOver.innerHTML = o; }
  let raf = 0; B.render = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (A.mode === 'build') B.draw(); }); };

  /* ---------- pointer interaction ---------- */
  const toG = (cx, cy) => { const r = bsvg.getBoundingClientRect(), v = V.view; return [(cx - r.left - v.tx) / v.sc, (cy - r.top - v.ty) / v.sc]; };
  const snapPt = (gx, gy) => { const x = Math.round(gx), y = Math.round(gy); // prefer free leg terminals and supplies
    let best = null, bd = .7; B.insts().forEach(i => i.bb && B.legPos(i).forEach(l => { if (!B.holeStrip(l.x, l.y)) { const d = Math.hypot(l.x - gx, l.y - gy); if (d < bd) { bd = d; best = [l.x, l.y]; } } }));
    (A.doc.bsup || []).forEach(s => B.supLegs(s).forEach(l => { const d = Math.hypot(l.x - gx, l.y - gy); if (d < bd) { bd = d; best = [l.x, l.y]; } })); return best || [x, y]; };
  const onHole = (p) => !!B.holeStrip(p[0], p[1]) || B.insts().some(i => i.bb && B.legPos(i).some(l => l.x === p[0] && l.y === p[1])) || (A.doc.bsup || []).some(s => B.supLegs(s).some(l => l.x === p[0] && l.y === p[1]));
  let pan = null;
  bsvg.addEventListener('contextmenu', e => e.preventDefault());
  bsvg.addEventListener('wheel', e => { e.preventDefault(); const v = V.view, r = bsvg.getBoundingClientRect(); const mouseWheel = Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY) && !e.deltaX;
    if (e.ctrlKey || e.metaKey || mouseWheel) { const mx = e.clientX - r.left, my = e.clientY - r.top, ns = Math.max(4, Math.min(80, v.sc * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0018)))), k = ns / v.sc; v.tx = mx - (mx - v.tx) * k; v.ty = my - (my - v.ty) * k; v.sc = ns; } else { v.tx -= e.deltaX; v.ty -= e.deltaY; } applyV(); }, { passive: false });
  const sel1 = () => { const k = [...V.sel][0]; return k; };
  A.bselect = (ids) => { V.sel = new Set(ids); S.sel = new Set([...V.sel].filter(k => !k.includes(':'))); A.renderProps && A.renderProps(); buildProps(); B.render(); };
  function buildProps() { const k = sel1(); if (A.mode !== 'build' || !k || !k.includes(':')) return; const b = $('#propBody');
    if (k.startsWith('j:')) { const j = (A.doc.bw || []).find(x => 'j:' + x.id === k); if (!j) return; b.innerHTML = `<p><b>Jumper wire</b></p><div class="row"><label>Colour</label><span>${[...JC, '#d33', '#222', '#fff'].map(c => `<button class="swatch" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</span></div><button id="bjDel" class="danger">Delete wire</button>`;
      b.querySelectorAll('.swatch').forEach(s => s.onclick = () => { j.color = s.dataset.c; A.commit(); }); $('#bjDel').onclick = bdelete; }
    else if (k.startsWith('s:')) { const s = (A.doc.bsup || []).find(x => 's:' + x.id === k); if (!s) return; b.innerHTML = `<p><b>Battery / supply</b></p><div class="row"><label>Volts</label><input id="bsV" value="${s.volts}"></div><p class="note">Its + terminal is red, − is black. Connect − to the blue rail.</p><button id="bsDel" class="danger">Delete</button>`;
      $('#bsV').onchange = e => { s.volts = Math.max(.1, +e.target.value || 5); A.commit(); }; $('#bsDel').onclick = bdelete; } }
  function bdelete() { const d = A.doc; V.sel.forEach(k => { if (k.startsWith('j:')) d.bw = d.bw.filter(j => 'j:' + j.id !== k); else if (k.startsWith('s:')) d.bsup = d.bsup.filter(s => 's:' + s.id !== k); else { d.parts = d.parts.filter(p => p.id !== k); } }); V.sel = new Set(); S.sel = new Set(); A.commit(); A.renderProps(); }
  A.bdelete = bdelete;
  const hitOf = t => { const g = t.closest && t.closest('[data-id],[data-j],[data-s]'); if (!g) return null; if (g.dataset.id) return g.dataset.id === 'ghost' ? null : g.dataset.id; if (g.dataset.j) return 'j:' + g.dataset.j; return 's:' + g.dataset.s; };
  bsvg.addEventListener('pointerdown', e => { bsvg.focus({ preventScroll: true }); bsvg.setPointerCapture(e.pointerId);
    if (e.button === 1 || e.button === 2 || S.space) { pan = { x: e.clientX, y: e.clientY, tx: V.view.tx, ty: V.view.ty, right: e.button === 2, moved: false }; return; } if (e.button !== 0) return;
    const [gx, gy] = toG(e.clientX, e.clientY), sp = snapPt(gx, gy); V.mouse = sp;
    if (V.draft) { finishJumper(sp); return; }
    if (S.tool === 'place' && S.placing) { const df = A.def(S.placing), inst = A.placePart(S.placing, 10 + A.doc.parts.length, 10, 0, 0); inst.bb = { x: sp[0], y: sp[1], rot: V.rot }; A.doc.master = 'build'; A.commit(); A.bselect([inst.id]); return; }
    const id = hitOf(e.target);
    if (id && S.tool !== 'wire') { if (A.simPointer && !id.includes(':') && A.simPointer(id, 'down')) return; if (!V.sel.has(id) && !e.shiftKey) A.bselect([id]); else if (e.shiftKey) { V.sel.has(id) ? V.sel.delete(id) : V.sel.add(id); A.bselect([...V.sel]); }
      if (!id.startsWith('j:')) V.drag = { type: 'move', x0: gx, y0: gy, moved: false, orig: null, id }; return; }
    if (onHole(sp) && !id) { V.draft = { a: sp, t0: Date.now(), x0: e.clientX, y0: e.clientY, drag: true }; B.render(); return; }
    if (S.tool === 'wire' && onHole(sp)) { V.draft = { a: sp, drag: false }; B.render(); return; }
    A.bselect([]); });
  function finishJumper(b) { const a = V.draft.a; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < .5) { V.draft = null; B.render(); return; } if (!onHole(b)) { A.toast('Drop the wire end on a hole or a pin', 1600); V.draft = null; B.render(); return; }
    const d = A.doc; d.bw = d.bw || []; const j = { id: 'j' + (d.seq++), a: a.slice(), b: b.slice() }; d.bw.push(j); const c = B.connectivity(); const g = c.groups.find(gr => gr.some(k => { const t = k[0]; return false; }));
    const ra = c.find(B.target(a[0], a[1])); const has = (pre) => c.groups.some(gr => gr.some(k => k.startsWith(pre)) && c.find(gr[0]) === ra);
    const tag = c.groups.find(gr => c.find(gr[0]) === ra) || []; const sups = {}; (d.bsup || []).forEach(s => sups[s.id] = s);
    if (tag.some(k => k.startsWith('U:') && k.endsWith(':-'))) j.color = '#222'; else if (tag.some(k => k.startsWith('U:') && k.endsWith(':+'))) j.color = '#d33'; else j.color = JC[(d.bw.length - 1) % JC.length];
    V.draft = null; d.master = 'build'; A.commit(); A.bselect(['j:' + j.id]); }
  bsvg.addEventListener('pointermove', e => { if (pan) { const dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (Math.abs(dx) + Math.abs(dy) > 3) pan.moved = true; V.view.tx = pan.tx + dx; V.view.ty = pan.ty + dy; applyV(); return; }
    const [gx, gy] = toG(e.clientX, e.clientY); V.mouse = snapPt(gx, gy); V.hover = (!V.drag && onHole(V.mouse) && (S.tool === 'wire' || V.draft || true)) ? V.mouse : null; $('#stPos').textContent = V.mouse.join(', ');
    const d = V.drag; if (d && d.type === 'move') { if (!d.moved && Math.abs(gx - d.x0) + Math.abs(gy - d.y0) < .5) return; if (!d.orig) { d.orig = []; V.sel.forEach(k => { const p = A.doc.parts.find(x => x.id === k); if (p && p.bb) d.orig.push([p.bb, p.bb.x, p.bb.y]); const s = (A.doc.bsup || []).find(x => 's:' + x.id === k); if (s) d.orig.push([s, s.x, s.y]); }); }
      d.moved = true; const dx = Math.round(gx - d.x0), dy = Math.round(gy - d.y0); d.orig.forEach(([o, x, y]) => { o.x = x + dx; o.y = y + dy; }); B.render(); return; }
    drawOver(); });
  bsvg.addEventListener('pointerup', e => { if (pan) { pan = null; return; } if (A.simPointer) A.simPointer(null, 'up');
    if (V.draft && V.draft.drag && Math.hypot(e.clientX - V.draft.x0, e.clientY - V.draft.y0) > 6) { const [gx, gy] = toG(e.clientX, e.clientY); finishJumper(snapPt(gx, gy)); }
    else if (V.draft && V.draft.drag) { V.draft.drag = false; }
    const d = V.drag; V.drag = null; if (d && d.moved) { A.doc.master = 'build'; A.commit(); } });
  bsvg.addEventListener('dblclick', e => { const id = hitOf(e.target); if (id && !id.includes(':')) { const i = $('#pVal'); if (i) { i.focus(); i.select(); } } });
  A.buildKey = (e, k) => { if (A.mode !== 'build') return false;
    if (k === 'escape') { if (V.draft) V.draft = null; else if (S.placing || S.tool !== 'select') A.setTool('select'); else A.bselect([]); B.render(); return true; }
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); bdelete(); return true; }
    if (k === 'r') { if (S.placing) { V.rot = (V.rot + 1) % 4; drawOver(); return true; } V.sel.forEach(id => { const p = A.doc.parts.find(x => x.id === id); if (p && p.bb) p.bb.rot = ((p.bb.rot || 0) + 1) % 4; }); A.doc.master = 'build'; A.commit(); return true; }
    if (k === 'w') { A.setTool('wire'); return true; } if (k === 's') { A.setTool('select'); return true; } if (k === 'f' || k === 'home') { A.bfit(); return true; }
    if (k === 'a') { const q = $('#q'); if (q) { q.focus(); q.select(); } return true; }
    if (k.startsWith('arrow')) { const dx = k === 'arrowleft' ? -1 : k === 'arrowright' ? 1 : 0, dy = k === 'arrowup' ? -1 : k === 'arrowdown' ? 1 : 0; let ch = false; V.sel.forEach(id => { const p = A.doc.parts.find(x => x.id === id); if (p && p.bb) { p.bb.x += dx; p.bb.y += dy; ch = true; } }); if (ch) { e.preventDefault(); A.doc.master = 'build'; A.commit(); } return true; }
    return false; };
  $('#bFit').onclick = () => A.mode === 'build' ? A.bfit() : A.fit();
  A.on(what => { if (A._syncing) return; if (A.mode === 'build') { if (what === 'load') { V.sel = new Set(); setTimeout(A.bfit, 20); } B.render(); } });
  /* stage-level controls */
  A.setMode = async (m) => { if (m === A.mode) return; A.simStop && A.simState && A.simState.active && A.simStop(); V.draft = null; V.sel = new Set(); S.sel = new Set();
    if (m === 'build') { if (A.doc.master !== 'build') A.buildFromSch(); A.mode = 'build'; } else { if (A.doc.master === 'build') await A.schFromBuild(); A.mode = 'sch'; }
    $('#svg').toggleAttribute('hidden', A.mode === 'build'); bsvg.toggleAttribute('hidden', A.mode !== 'build'); document.body.dataset.mode = A.mode; document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === A.mode));
    $('#hint').textContent = A.mode === 'build' ? 'Drag from any hole to run a jumper wire. Pick a part on the left to place it. Click a part to move it. R rotates.' : '';
    if (A.mode === 'build') { applyV(); setTimeout(A.bfit, 10); B.render(); } else { A.render(); A.fit(); } A.renderProps(); };
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => A.setMode(b.dataset.mode));
  new ResizeObserver(() => { if (A.mode === 'build') applyV(); }).observe(stage);
})();
