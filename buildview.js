/* WireFrame Build view (part 2): drawing, interaction, mode switch. */
(function () {
  const A = window.App, B = A.B, $ = (s, r) => (r || document).querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NS = 'http://www.w3.org/2000/svg', stage = $('#stage'), S = A.S;
  const bsvg = document.createElementNS(NS, 'svg'); bsvg.id = 'bsvg'; bsvg.setAttribute('tabindex', '0'); bsvg.setAttribute('hidden', ''); stage.insertBefore(bsvg, $('#svg').nextSibling);
  bsvg.innerHTML = '<defs><filter id="bglow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2"/></filter></defs><g id="bworld"><g id="bboard"></g><g id="bwback"></g><g id="bparts"></g><g id="bwires"></g><g id="bover"></g></g>';
  const world = $('#bworld', bsvg), gBoard = $('#bboard', bsvg), gParts = $('#bparts', bsvg), gWires = $('#bwires', bsvg), gBack = $('#bwback', bsvg), gOver = $('#bover', bsvg);
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
      const dome = 'M-.45 -.75 V-1.95 A.95 .95 0 0 1 1.45 -1.95 V-.75 Z';
      g += wire(0, 0, 0, -.8) + `<path d="M1 0 V-.3 L.78 -.55 V-.8" fill="none" stroke="#9a9a9a" stroke-width=".16" stroke-linecap="round" stroke-linejoin="round"/>`
        + `<ellipse cx=".5" cy="-.75" rx="1.05" ry=".3" fill="#000" opacity=".28"/><path d="${dome}" fill="${col}"/>`
        + (on ? `<path d="${dome}" fill="#fff" opacity="${(.12 + lum * .25).toFixed(2)}"/><ellipse cx=".15" cy="-2" rx=".22" ry=".6" fill="#fff" opacity=".35"/>` : `<path d="${dome}" fill="#000" opacity=".42"/><ellipse cx=".15" cy="-2" rx=".18" ry=".5" fill="#fff" opacity=".12"/>`)
        + `<ellipse cx=".5" cy="-.75" rx="1.05" ry=".28" fill="${col}" opacity=".85"/><ellipse cx=".5" cy="-.75" rx="1.05" ry=".28" fill="#fff" opacity=".22"/><rect x="1.37" y="-.95" width=".1" height=".35" fill="#0006"/>`
        + (on ? `<circle cx=".5" cy="-1.7" r="${1.5 + lum * 1.8}" fill="${col}" opacity="${(.25 + lum * .6).toFixed(2)}" filter="url(#bglow)"/>` : '')
        + (el && el.dead ? txt(.5, -3.4, 'Popped!', .55, '#e03c31') : '')
        + txt(-.62, -.15, '+', .5, '#111') + txt(1.62, -.15, '−', .5, '#111')
        + (el && !el.dead && A.Sim && A.Sim.v && el.n && (A.Sim.v[el.n[0]] - A.Sim.v[el.n[1]]) < -.5 ? txt(.5, -3.5, 'Backwards! Flip it', .5, '#ff8a00') : ''); }
    else if (k === 'elec') g += `<rect x="-.7" y="-2.7" width="2.4" height="2.5" rx=".35" fill="#2a3b66"/><rect x="1.2" y="-2.7" width=".5" height="2.5" fill="#cfd6e6"/>` + wire(0, 0, 0, -.2) + wire(1, 0, 1, -.2) + txt(.4, -1.45, inst.value || '', .42, '#fff') + txt(1.45, -1.45, '−', .5, '#223');
    else if (k === 'ceramic') g += wire(0, 0, 0, -.7) + wire(2, 0, 2, -.7) + `<ellipse cx="1" cy="-1.5" rx=".95" ry="1" fill="#e5a53a" stroke="#a9742a" stroke-width=".05"/>` + txt(1, -1.5, inst.value || '', .4, '#533');
    else if (k === 'buzzer') g += `<circle cx="1" cy="-1.7" r="1.5" fill="#1c1c1c" stroke="#000" stroke-width=".06"/><circle cx="1" cy="-1.7" r=".28" fill="#555"/>` + txt(.1, -2.7, '+', .55, '#fff') + wire(0, 0, 0, -.3) + wire(2, 0, 2, -.3) + (el && el.on ? `<circle cx="1" cy="-1.7" r="2.2" fill="none" stroke="#ffd21a" stroke-width=".12" opacity=".8"/>` : '');
    else if (k === 'to220') { const w = Math.max(...L.map(l => l.x)); g += `<rect x="-.6" y="-3.6" width="${w + 1.2}" height="1" fill="#aeb4bc" stroke="#555" stroke-width=".05"/><circle cx="${w / 2}" cy="-3.1" r=".25" fill="#eee"/><rect x="-.6" y="-2.6" width="${w + 1.2}" height="2.4" fill="#1d1d1d"/>` + L.map(l => wire(l.x, l.y, l.x, -.2)).join('') + txt(w / 2, -1.3, (d.name || '').slice(0, 10), .4, '#fff'); }
    else if (k === 'sip') { const w = Math.max(...L.map(l => l.x)); g += `<rect x="-.5" y="-1.6" width="${w + 1}" height="1.4" rx=".15" fill="#222831"/>` + L.map(l => wire(l.x, l.y, l.x, -.2)).join('') + txt(w / 2, -.8, (inst.value || d.name || '').slice(0, 12), .4, '#fff'); }
    else if (k === 'to92') g += `<path d="M-.5 -.2V-1.3a1.5 1.5 0 0 1 3 0V-.2z" fill="#1d1d1d" stroke="#000" stroke-width=".05"/>` + L.map((l, i) => wire(l.x, l.y, l.x, -.2)).join('') + txt(1, -1.2, (inst.value || '').slice(0, 7), .42, '#ddd') + L.map((l, i) => txt(l.x, .55, (d.pins.find(p => p.n === l.pin) || {}).name || l.pin, .38, '#555')).join('');
    else if (k === 'pot') g += `<rect x="-.55" y="-2.8" width="3.1" height="2.6" rx=".3" fill="#2465b0"/><circle cx="1" cy="-1.5" r=".85" fill="#d8d8d8" stroke="#888" stroke-width=".06"/><path d="M1 -1.5V-2.2" stroke="#444" stroke-width=".14"/>` + L.map(l => wire(l.x, l.y, l.x, -.2)).join('');
    else if (k === 'toggle' || k === 'spdt') { const w = Math.max(...L.map(l => l.x)), sp = k === 'spdt', pos = sp ? ((inst.sim && inst.sim.pos) ? 1 : 0) : ((live && live.sw !== undefined ? live.sw : (inst.sim && inst.sim.on)) ? 1 : 0), lx = sp ? (pos ? w * .75 : w * .25) : (pos ? w * .72 : w * .28);
      g += `<rect x="-.5" y="-2.7" width="${w + 1}" height="2.5" rx=".3" fill="#2b2f36" stroke="#000" stroke-width=".06"/><rect x=".15" y="-2.05" width="${w - .3}" height="1.2" rx=".5" fill="#111"/><rect x="${lx - .45}" y="-2.3" width=".9" height="1.7" rx=".3" fill="${pos ? '#2fbf5a' : '#c9ccd2'}" stroke="#555" stroke-width=".05"/>` + L.map(l => wire(l.x, l.y, l.x, -.2)).join('') + txt(w / 2, -3.2, sp ? (pos ? 'NC' : 'NO') : (pos ? 'ON' : 'OFF'), .5, pos ? '#2fbf5a' : '#9aa0a8'); }
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
    else { const n = L.length, w = n - 1; g += `<rect x="-.6" y="-2.6" width="${w + 1.2}" height="2.4" rx=".25" fill="${/Display/.test(d.cat) ? '#1b4a8f' : '#1d6a46'}"/>` + txt(w / 2, -1.7, (inst.value || d.name || '').slice(0, 16), Math.min(.55, 1.7 * (w + 1.2) / Math.max(6, (inst.value || d.name || '').length * 2)), '#fff') + L.map(l => `<circle cx="${l.x}" cy="${l.y - .2}" r=".16" fill="#caa84a"/>` + `<text x="${l.x}" y="-.7" font-size=".36" fill="#fff" text-anchor="middle" class="bt">${esc((d.pins.find(p => p.n === l.pin) || {}).name || l.pin).slice(0, 4)}</text>`).join(''); g += L.map(l => txt(l.x, -.5, String((d.pins.find(p => p.n === l.pin) || {}).name || l.pin).slice(0, 4), .42, '#fff')).join(''); }
    return g; };
  const pinName = (inst, n) => { const d = A.def(inst.def) || {}, p = (d.pins || []).find(q => String(q.n) === String(n)) || {}; return 'Pin ' + n + (p.name && p.name !== String(n) ? ' · ' + p.name : '') + ' of ' + (inst.ref || d.name || ''); };
  /* breadboard-style picture for the parts list */
  A.thumbBuild = d => { try { const L = B.legsOf(d), k = B.kind(d); if (!L.length) return null; const mx = Math.max(...L.map(l => l.x)), my = Math.max(...L.map(l => l.y)), big = k === 'board', inst = { def: d.id, value: d.value, ref: '' };
      const g = B.look(inst, null) + L.map(l => `<circle cx="${l.x}" cy="${l.y}" r=".22" fill="#cfcfcf" stroke="#777" stroke-width=".05"/>`).join(''); const y0 = big ? -1 : -4.2, h = my - y0 + 1.2, w = mx + 2.4;
      return `<svg viewBox="-1.2 ${y0} ${w} ${h}" preserveAspectRatio="xMidYMid meet" class="bthumb">${g}</svg>`; } catch (e) { return null; } };
  const legDots = inst => B.legPos(inst).map(l => `<circle cx="${l.x}" cy="${l.y}" r=".2" fill="#cfcfcf" stroke="#777" stroke-width=".05"><title>${esc(pinName(inst, l.pin))}</title></circle>`).join('');

  /* ---------- parts, supplies and jumper wires ---------- */
  const lens = { '+': '#d33', '-': '#222' };
  function supSVG(s) { return `<g data-s="${s.id}" class="bsup${V.sel.has('s:' + s.id) ? ' sel' : ''}"><rect x="${s.x - .5}" y="${s.y - 3.7}" width="3.4" height="3.6" rx=".35" fill="#2b2b2f" stroke="#000" stroke-width=".06"/><rect x="${s.x - .5}" y="${s.y - 3.7}" width="3.4" height="1" fill="#d4af37"/><text x="${s.x + 1.2}" y="${s.y - 1.5}" font-size=".7" fill="#fff" text-anchor="middle" dominant-baseline="central" class="bt">${s.volts} V</text><text x="${s.x + 1.2}" y="${s.y - 2.7}" font-size=".42" fill="#222" text-anchor="middle" dominant-baseline="central" class="bt">BATTERY</text>` +
    `<circle cx="${s.x}" cy="${s.y}" r=".3" fill="#d33"/><text x="${s.x}" y="${s.y + .8}" font-size=".5" fill="#d33" text-anchor="middle" class="bt">+</text><circle cx="${s.x + 2}" cy="${s.y}" r=".3" fill="#222"/><text x="${s.x + 2}" y="${s.y + .8}" font-size=".5" fill="#222" text-anchor="middle" class="bt">−</text></g>`; }
  function jumperPath(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < .01) return `M${a[0]} ${a[1]}`; const lift = Math.min(3.2, .5 + L * .22), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = -dy / L, ny = dx / L, s = (ny > 0 ? -1 : 1) * 1; return `M${a[0]} ${a[1]}Q${(mx + nx * lift * s).toFixed(2)} ${(my + ny * lift * s).toFixed(2)} ${b[0]} ${b[1]}`; }
  /* bendable jumpers: j.via = [[x,y],...] gives a polyline with rounded corners; no j.via = the old arc */
  B.jPts = (j, r) => { const P = [j.a, ...(j.via || []), j.b], out = [P[0]]; r = r == null ? .5 : r;
    for (let i = 1; i < P.length - 1; i++) { const p = P[i], u = [P[i - 1][0] - p[0], P[i - 1][1] - p[1]], w = [P[i + 1][0] - p[0], P[i + 1][1] - p[1]], lu = Math.hypot(...u), lw = Math.hypot(...w); if (lu < .01 || lw < .01) { out.push(p); continue; }
      const rr = Math.min(r, lu / 2, lw / 2), p1 = [p[0] + u[0] / lu * rr, p[1] + u[1] / lu * rr], p2 = [p[0] + w[0] / lw * rr, p[1] + w[1] / lw * rr]; for (let k = 0; k <= 6; k++) { const t = k / 6, q = 1 - t; out.push([q * q * p1[0] + 2 * q * t * p[0] + t * t * p2[0], q * q * p1[1] + 2 * q * t * p[1] + t * t * p2[1]]); } }
    out.push(P[P.length - 1]); return out; };
  const jPath = j => j.via ? 'M' + B.jPts(j).map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L') : jumperPath(j.a, j.b);
  B.jPath = jPath;
  const segHit = (p, q, ex) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(2, Math.ceil(L * 4)); for (let k = 0; k <= n; k++) { const t = k / n, x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t; if (B.insts().some(i => { if (!i.bb || ex.has(i.id)) return false; const b = B.bbox(i); return x > b.x0 + .05 && x < b.x1 - .05 && y > b.y0 + .05 && y < b.y1 - .05; })) return true; } return false; };
  B.autoRoute = j => { const ex = new Set(); B.insts().forEach(i => { if (!i.bb) return; const L = B.legPos(i); [j.a, j.b].forEach(p => { if (L.some(l => l.x === p[0] && l.y === p[1])) ex.add(i.id); }); });
    const a = j.a, b = j.b, cands = [[], [[a[0], b[1]]], [[b[0], a[1]]]]; for (let k = 1; k <= 16; k++) [k, -k].forEach(o => { cands.push([[a[0], a[1] + o], [b[0], a[1] + o]], [[a[0] + o, a[1]], [a[0] + o, b[1]]]); });
    let best = null, bl = 1e9; cands.forEach(v => { const P = [a, ...v, b]; let ok = true, L = 0; for (let i = 0; i < P.length - 1 && ok; i++) { if (segHit(P[i], P[i + 1], ex)) ok = false; L += Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); } if (ok && L < bl - .01) { bl = L; best = v; } });
    if (best) j.via = best.map(p => p.slice()); else delete j.via; return !!best; };
  A.tidyWires = () => { const w = A.doc.bw || []; let n = 0; w.forEach(j => { if (B.autoRoute(j)) n++; }); A.doc.master = 'build'; A.commit(); A.toast('Tidied ' + w.length + ' wire' + (w.length === 1 ? '' : 's') + (n < w.length ? ' (' + (w.length - n) + ' had no clear path and keep their arc)' : ''), 2600); };
  const JC = ['#2f6fdd', '#f2c200', '#2fa84f', '#ff8a1f', '#9b4fd0', '#19b5c9'];
  B.jcolor = (j, n) => j.color || JC[n % JC.length];
  function wiresSVG(mode) { let o = ''; (A.doc.bw || []).forEach((j, i) => { if (mode === 'back' ? !j.back : j.back) return; const c = B.jcolor(j, i), sel = V.sel.has('j:' + j.id), d = jPath(j); const lv = V.live && V.live.vj && V.live.vj[j.id];
      o += `<g data-j="${j.id}"><path d="${d}" stroke="transparent" stroke-width="1" fill="none" class="hitj"/>${sel ? `<path d="${d}" stroke="#fff" stroke-width=".6" fill="none" opacity=".9"/>` : ''}<path d="${d}" stroke="#0004" stroke-width=".46" fill="none" transform="translate(.08 .1)"/><path d="${d}" stroke="${c}" stroke-width=".36" fill="none" stroke-linecap="round"/>` +
        (lv ? `<path d="${d}" stroke="#fff" stroke-width=".12" fill="none" stroke-dasharray=".5 .9" stroke-dashoffset="${(-lv.ph).toFixed(2)}" opacity=".85"/>` : '') +
        `<circle cx="${j.a[0]}" cy="${j.a[1]}" r=".27" fill="${c}" stroke="#0006" stroke-width=".06"/><circle cx="${j.b[0]}" cy="${j.b[1]}" r=".27" fill="${c}" stroke="#0006" stroke-width=".06"/></g>`; });
    if (mode !== 'back') (A.doc.bw || []).forEach(j => { if (!V.sel.has('j:' + j.id) || V.draft) return; const P = [j.a, ...(j.via || []), j.b]; o += `<g data-jh="${j.id}">`;
      for (let i = 0; i < P.length - 1; i++) { const m = [(P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2]; o += `<circle class="jm" data-i="${i}" cx="${m[0]}" cy="${m[1]}" r=".42" fill="#ffffffcc" stroke="#d8731a" stroke-width=".14"/>`; }
      (j.via || []).forEach((p, i) => o += `<circle class="jv" data-i="${i}" cx="${p[0]}" cy="${p[1]}" r=".48" fill="#fff" stroke="#d8731a" stroke-width=".18"/>`); o += '</g>'; }); return o; }
  B.draw = () => { drawBoard(); let p = ''; const live = V.live;
    (A.doc.bsup || []).forEach(s => p += supSVG(s));
    B.insts().forEach(inst => { if (!inst.bb) return; const bb = inst.bb, sel = V.sel.has(inst.id), lv = live ? live.of(inst) : null, bx = B.bbox(inst);
      p += `<g data-id="${inst.id}" class="bpart${sel ? ' sel' : ''}"><rect x="${bx.x0}" y="${bx.y0}" width="${bx.x1 - bx.x0}" height="${bx.y1 - bx.y0}" fill="transparent" class="hitp"/><g transform="translate(${bb.x} ${bb.y}) rotate(${(bb.rot || 0) * 90})">${B.look(inst, lv)}</g>${legDots(inst)}` +
        `<text x="${(bx.x0 + bx.x1) / 2}" y="${bx.y0 - .35}" font-size=".6" fill="#333" text-anchor="middle" class="bt bref">${esc(inst.ref)}</text>` + (sel ? `<rect x="${bx.x0 - .1}" y="${bx.y0 - .1}" width="${bx.x1 - bx.x0 + .2}" height="${bx.y1 - bx.y0 + .2}" fill="none" stroke="#d8731a" stroke-width=".14" stroke-dasharray=".4 .3"/>` : '') + '</g>'; });
    gParts.innerHTML = p; gBack.innerHTML = wiresSVG('back'); gWires.innerHTML = wiresSVG(); drawOver(); };
  function drawOver() { let o = ''; const [mx, my] = V.mouse;
    if (A.mode === 'build' && S.placing) { const df = A.def(S.placing); if (df) { const inst = { id: 'ghost', def: S.placing, ref: A.nextRef(df.ref || 'U'), value: df.value || df.name, bb: { x: mx, y: my, rot: V.rot } }; o += `<g opacity=".6" transform="translate(${mx} ${my}) rotate(${V.rot * 90})">${B.look(inst, null)}</g>`; } }
    if (V.draft) { const dr = V.draft, end = dr.free || V.mouse, tj = { a: dr.a, b: end, via: (dr.via || []).slice() }, gd = dr.guide || [];
      gd.forEach(g => o += g.x != null ? `<path d="M${g.x} -500V500" stroke="#3b7dff" stroke-width=".06" opacity=".7"/>` : `<path d="M-500 ${g.y}H500" stroke="#3b7dff" stroke-width=".06" opacity=".7"/>`);
      o += `<path d="${B.jPath(tj)}" stroke="#d8731a" stroke-width=".36" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/><circle cx="${dr.a[0]}" cy="${dr.a[1]}" r=".3" fill="#d8731a"/>` + (dr.via || []).map(p => `<circle cx="${p[0]}" cy="${p[1]}" r=".25" fill="#fff" stroke="#d8731a" stroke-width=".1"/>`).join(''); }
    if (V.guide) { const g = V.guide, st = 'stroke="#3b7dff" stroke-width=".07" opacity=".85"'; if (g.k === '90') o += `<path d="M-500 ${g.p[1]}H500M${g.p[0]} -500V500" ${st}/><rect x="${g.p[0] - .45}" y="${g.p[1] - .45}" width=".9" height=".9" fill="none" ${st}/>`; else { const dx = g.b[0] - g.a[0], dy = g.b[1] - g.a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L * 500, uy = dy / L * 500; o += `<path d="M${g.a[0] - ux} ${g.a[1] - uy}L${g.b[0] + ux} ${g.b[1] + uy}" ${st}/>`; } }
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
  A.bsel = () => V.sel; A.bjump = id => { const inst = A.doc.parts.find(p => p.id === id); if (!inst || !inst.bb) return; const b = B.bbox(inst), r = bsvg.getBoundingClientRect(), v = V.view, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; v.sc = Math.max(v.sc, 16); v.tx = r.width / 2 - cx * v.sc; v.ty = r.height / 2 - cy * v.sc; applyV(); B.render(); };
  A.bselect = (ids) => { V.sel = new Set(ids); S.sel = new Set([...V.sel].filter(k => !k.includes(':'))); A.renderProps && A.renderProps(); buildProps(); B.render(); };
  function buildProps() { const k = sel1(); if (A.mode !== 'build' || !k || !k.includes(':')) return; const b = $('#propBody');
    if (k.startsWith('j:')) { const j = (A.doc.bw || []).find(x => 'j:' + x.id === k); if (!j) return; b.innerHTML = `<p><b>Jumper wire</b></p><div class="row"><label>Colour</label><span>${[...JC, '#d33', '#222', '#fff'].map(c => `<button class="swatch" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</span></div><p class="note">Drag the wire itself or the orange dots to bend it; a cross shows a 90° corner and a line a straight 180°. Double-click a corner to remove it.</p><div class="row"><button id="bjStr">Straight</button><button id="bjAuto">Auto-route</button><button id="bjArc">Arc</button></div><div class="row"><button id="bjZ">${j.back ? 'Bring in front of parts' : 'Send behind parts'}</button></div><button id="bjDel" class="danger">Delete wire</button>`;
      $('#bjStr').onclick = () => { j.via = []; A.doc.master = 'build'; A.commit(); }; $('#bjAuto').onclick = () => { if (!B.autoRoute(j)) A.toast('No clear path around the parts', 1800); A.doc.master = 'build'; A.commit(); }; $('#bjZ').onclick = () => { j.back = !j.back; A.doc.master = 'build'; A.commit(); }; $('#bjArc').onclick = () => { delete j.via; A.doc.master = 'build'; A.commit(); };
      b.querySelectorAll('.swatch').forEach(s => s.onclick = () => { j.color = s.dataset.c; A.commit(); }); $('#bjDel').onclick = bdelete; }
    else if (k.startsWith('s:')) { const s = (A.doc.bsup || []).find(x => 's:' + x.id === k); if (!s) return; b.innerHTML = `<p><b>Battery / supply</b></p><div class="row"><label>Volts</label><input id="bsV" value="${s.volts}"></div><p class="note">Its + terminal is red, − is black. Connect − to the blue rail.</p><button id="bsDel" class="danger">Delete</button>`;
      $('#bsV').onchange = e => { s.volts = Math.max(.1, +e.target.value || 5); A.commit(); }; $('#bsDel').onclick = bdelete; } }
  function bdelete() { const d = A.doc; V.sel.forEach(k => { if (k.startsWith('j:')) d.bw = d.bw.filter(j => 'j:' + j.id !== k); else if (k.startsWith('s:')) d.bsup = d.bsup.filter(s => 's:' + s.id !== k); else { d.parts = d.parts.filter(p => p.id !== k); } }); V.sel = new Set(); S.sel = new Set(); A.commit(); A.renderProps(); }
  A.bdelete = bdelete;
  A._V = V; A._onHole = onHole;
  const hitOf = t => { const g = t.closest && t.closest('[data-id],[data-j],[data-s]'); if (!g) return null; if (g.dataset.id) return g.dataset.id === 'ghost' ? null : g.dataset.id; if (g.dataset.j) return 'j:' + g.dataset.j; return 's:' + g.dataset.s; };
  bsvg.addEventListener('pointerdown', e => { bsvg.focus({ preventScroll: true }); bsvg.setPointerCapture(e.pointerId);
    if (e.button === 1 || e.button === 2 || S.space) { pan = { x: e.clientX, y: e.clientY, tx: V.view.tx, ty: V.view.ty, right: e.button === 2, moved: false }; return; } if (e.button !== 0) return;
    const [gx, gy] = toG(e.clientX, e.clientY), sp = snapPt(gx, gy); V.mouse = sp;
    if (V.draft) { if (onHole(sp)) finishJumper(sp); else { if (V.draft.free) V.draft.via.push(V.draft.free.slice()); V.draft.drag = false; B.render(); } return; }
    if (S.tool === 'place' && S.placing) { const df = A.def(S.placing), inst = A.placePart(S.placing, 10 + A.doc.parts.length, 10, 0, 0); inst.bb = { x: sp[0], y: sp[1], rot: V.rot }; A.doc.master = 'build'; A.commit(); A.bselect([inst.id]); return; }
    if (V.drag && V.drag.follow) { V.drag = null; V.guide = null; A.doc.master = 'build'; A.commit(); return; }
    const hv = e.target.closest && e.target.closest('.jv,.jm'); if (hv) { const j = (A.doc.bw || []).find(x => x.id === hv.parentNode.dataset.jh); if (j) { let i = +hv.dataset.i; if (hv.classList.contains('jm')) { const P = [j.a, ...(j.via || []), j.b]; j.via = j.via || []; j.via.splice(i, 0, [Math.round((P[i][0] + P[i + 1][0]) ), Math.round((P[i][1] + P[i + 1][1]))].map(v => v / 2)); } V.drag = { type: 'via', j, i, moved: false }; return; } }
    const wb = e.target.closest && e.target.closest('[data-j]'); if (wb && !e.shiftKey && S.tool !== 'wire' && e.button === 0) { const j = (A.doc.bw || []).find(x => x.id === wb.dataset.j); if (j && V.sel.has('j:' + j.id)) { /* grab a selected wire anywhere to bend it */ const [px, py] = toG(e.clientX, e.clientY), P = [j.a, ...(j.via || []), j.b]; let bi = 0, bd = 1e9; for (let i = 0; i < P.length - 1; i++) { const ax = P[i][0], ay = P[i][1], dx = P[i + 1][0] - ax, dy = P[i + 1][1] - ay, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)), d = Math.hypot(ax + dx * t - px, ay + dy * t - py); if (d < bd) { bd = d; bi = i; } } j.via = j.via || []; j.via.splice(bi, 0, [Math.round(px * 2) / 2, Math.round(py * 2) / 2]); V.drag = { type: 'via', j, i: bi, moved: false }; return; } }
    let id = hitOf(e.target);
    if (id && id.startsWith('j:') && document.elementsFromPoint) { /* a wire lying over a push button must not block it */ for (const el of document.elementsFromPoint(e.clientX, e.clientY)) { const g = el.closest && el.closest('[data-id]'); const pi = g && g.dataset.id !== 'ghost' && (A.doc.parts.find(p => p.id === g.dataset.id)); if (pi && pi.def === 'SW_PUSH') { id = pi.id; break; } } }
    if (id && S.tool !== 'wire') { if (A.simPointer && !id.includes(':') && A.simPointer(id, 'down')) return; if (!V.sel.has(id) && !e.shiftKey) A.bselect([id]); else if (e.shiftKey) { V.sel.has(id) ? V.sel.delete(id) : V.sel.add(id); A.bselect([...V.sel]); }
      if (!id.startsWith('j:')) V.drag = { type: 'move', x0: gx, y0: gy, moved: false, orig: null, id }; return; }
    if (onHole(sp) && !id) { V.draft = { a: sp, via: [], t0: Date.now(), x0: e.clientX, y0: e.clientY, drag: true }; B.render(); return; }
    if (S.tool === 'wire' && onHole(sp)) { V.draft = { a: sp, via: [], drag: false }; B.render(); return; }
    A.bselect([]); });
  function finishJumper(b) { const a = V.draft.a, via = V.draft.via || []; if (!via.length && Math.hypot(a[0] - b[0], a[1] - b[1]) < .5) { V.draft = null; B.render(); return; } if (!onHole(b)) { A.toast('Drop the wire end on a hole or a pin', 1600); V.draft = null; B.render(); return; }
    const d = A.doc; d.bw = d.bw || []; const j = { id: 'j' + (d.seq++), a: a.slice(), b: b.slice() }; if (via.length) j.via = via.map(p => p.slice()); d.bw.push(j); const c = B.connectivity(); const g = c.groups.find(gr => gr.some(k => { const t = k[0]; return false; }));
    const ra = c.find(B.target(a[0], a[1])); const has = (pre) => c.groups.some(gr => gr.some(k => k.startsWith(pre)) && c.find(gr[0]) === ra);
    const tag = c.groups.find(gr => c.find(gr[0]) === ra) || []; const sups = {}; (d.bsup || []).forEach(s => sups[s.id] = s);
    if (tag.some(k => k.startsWith('U:') && k.endsWith(':-'))) j.color = '#222'; else if (tag.some(k => k.startsWith('U:') && k.endsWith(':+'))) j.color = '#d33'; else j.color = JC[(d.bw.length - 1) % JC.length];
    if (!via.length) B.autoRoute(j); V.draft = null; d.master = 'build'; A.commit(); A.bselect(['j:' + j.id]); }
  bsvg.addEventListener('pointermove', e => { if (pan) { const dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (Math.abs(dx) + Math.abs(dy) > 3) pan.moved = true; V.view.tx = pan.tx + dx; V.view.ty = pan.ty + dy; applyV(); return; }
    const [gx, gy] = toG(e.clientX, e.clientY); V.mouse = snapPt(gx, gy);
    if (V.draft) { const dr = V.draft, last = (dr.via && dr.via.length ? dr.via[dr.via.length - 1] : dr.a); dr.guide = []; if (onHole(V.mouse)) dr.free = null; else { let x = gx, y = gy; if (Math.abs(gx - last[0]) < .7) { x = last[0]; dr.guide.push({ x }); } if (Math.abs(gy - last[1]) < .7) { y = last[1]; dr.guide.push({ y }); } dr.free = [x, y]; } } V.hover = (!V.drag && onHole(V.mouse) && (S.tool === 'wire' || V.draft || true)) ? V.mouse : null; $('#stPos').textContent = V.mouse.join(', ');
    const d = V.drag; if (d && d.type === 'via') { d.moved = true; const j = d.j, P = [j.a, ...j.via, j.b], pv = P[d.i], nx = P[d.i + 2]; let x = gx, y = gy; V.guide = null;
      const c1 = [pv[0], nx[1]], c2 = [nx[0], pv[1]], dd = c => Math.hypot(c[0] - gx, c[1] - gy), cs = [c1, c2].sort((p, q) => dd(p) - dd(q))[0];
      const ux = nx[0] - pv[0], uy = nx[1] - pv[1], L2 = ux * ux + uy * uy, t = L2 ? ((gx - pv[0]) * ux + (gy - pv[1]) * uy) / L2 : 0, pr = [pv[0] + ux * t, pv[1] + uy * t];
      if (dd(cs) < .6) { [x, y] = cs; V.guide = { k: '90', p: cs }; } else if (L2 && Math.hypot(pr[0] - gx, pr[1] - gy) < .45 && t > 0 && t < 1) { [x, y] = pr; V.guide = { k: '180', a: pv, b: nx }; }
      const sh = snapPt(gx, gy); if (onHole(sh) && Math.hypot(sh[0] - gx, sh[1] - gy) < .45) { [x, y] = sh; V.guide = null; }
      j.via[d.i] = [x, y]; B.render(); return; }
    if (d && d.type === 'move') { if (!d.moved && Math.abs(gx - d.x0) + Math.abs(gy - d.y0) < .5) return; if (!d.orig) { d.orig = []; V.sel.forEach(k => { const p = A.doc.parts.find(x => x.id === k); if (p && p.bb) d.orig.push([p.bb, p.bb.x, p.bb.y]); const s = (A.doc.bsup || []).find(x => 's:' + x.id === k); if (s) d.orig.push([s, s.x, s.y]); }); }
      d.moved = true; const dx = Math.round(gx - d.x0), dy = Math.round(gy - d.y0); d.orig.forEach(([o, x, y]) => { o.x = x + dx; o.y = y + dy; }); B.render(); return; }
    drawOver(); });
  bsvg.addEventListener('pointerup', e => { if (pan) { const was = pan; pan = null; if (was.right && !was.moved && !V.draft && !S.placing) A.ctxShow(e, 'build'); return; } if (A.simPointer) A.simPointer(null, 'up');
    if (V.draft && V.draft.drag && Math.hypot(e.clientX - V.draft.x0, e.clientY - V.draft.y0) > 6) { const [gx, gy] = toG(e.clientX, e.clientY), q = snapPt(gx, gy); if (onHole(q)) finishJumper(q); else { if (V.draft.free) V.draft.via.push(V.draft.free.slice()); V.draft.drag = false; B.render(); } }
    else if (V.draft && V.draft.drag) { V.draft.drag = false; }
    const d = V.drag; if (d && d.type === 'via' && !d.moved && !d.follow) { d.follow = true; return; } V.drag = null; V.guide = null; if (d && d.moved) { A.doc.master = 'build'; A.commit(); } });
  bsvg.addEventListener('dblclick', e => { const hv = e.target.closest && e.target.closest('.jv'); if (hv) { const j = (A.doc.bw || []).find(x => x.id === hv.parentNode.dataset.jh); if (j) { j.via.splice(+hv.dataset.i, 1); A.doc.master = 'build'; A.commit(); } return; } const id = hitOf(e.target); if (id && !id.includes(':')) { const i = $('#pVal'); if (i) { i.focus(); i.select(); } } });
  A.buildKey = (e, k) => { if (A.mode !== 'build') return false;
    if (k === 'escape') { if (V.draft) V.draft = null; else if (S.placing || S.tool !== 'select') A.setTool('select'); else A.bselect([]); B.render(); return true; }
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); bdelete(); return true; }
    if (k === 'r') { if (S.placing) { V.rot = (V.rot + 1) % 4; drawOver(); return true; } V.sel.forEach(id => { const p = A.doc.parts.find(x => x.id === id); if (p && p.bb) p.bb.rot = ((p.bb.rot || 0) + 1) % 4; }); A.doc.master = 'build'; A.commit(); return true; }
    if (k === 'w') { A.setTool('wire'); return true; } if (k === 's') { A.setTool('select'); return true; } if (k === 'f' || k === 'home') { A.bfit(); return true; }
    if (k === 'a') { e.preventDefault(); A.libOpen(!document.body.classList.contains('libopen')); return true; }
    if (k === 'p') { e.preventDefault(); const c = [...document.querySelectorAll('#cats [data-cat]')].find(b => /Power|Source/.test(b.dataset.cat)); A.libOpen(true); if (c) c.click(); return true; }
    if (k === 'i') { A.propsOpen && A.propsOpen(!document.body.classList.contains('propsopen')); return true; }
    if (k.startsWith('arrow')) { const dx = k === 'arrowleft' ? -1 : k === 'arrowright' ? 1 : 0, dy = k === 'arrowup' ? -1 : k === 'arrowdown' ? 1 : 0; let ch = false; V.sel.forEach(id => { const p = A.doc.parts.find(x => x.id === id); if (p && p.bb) { p.bb.x += dx; p.bb.y += dy; ch = true; } }); if (ch) { e.preventDefault(); A.doc.master = 'build'; A.commit(); } return true; }
    return false; };
  $('#bFit').onclick = () => A.mode === 'build' ? A.bfit() : A.fit();
  A.on(what => { if (A._syncing) return; if (A.mode === 'build') { if (what === 'load') { V.sel = new Set(); setTimeout(A.bfit, 20); } B.render(); } });
  /* stage-level controls */
  A.setMode = async (m) => { if (m === A.mode) return; A.simStop && A.simState && A.simState.active && A.simStop(); V.draft = null; V.sel = new Set(); S.sel = new Set();
    const keep = JSON.stringify(A.exportDoc());
    try { if (m === 'build') { if (A.doc.master !== 'build') A.buildFromSch(); A.mode = 'build'; } else { if (A.doc.master === 'build') await A.schFromBuild(); A.mode = 'sch'; } }
    catch (err) { /* never get stuck in a view: put the sheet back as it was and switch anyway */ console.error(err); try { A.importDoc(JSON.parse(keep)); } catch (e2) {} A.mode = m; A._syncing = false; A.toast('Could not convert between the views (' + (err && err.message || 'error') + '). Your circuit was kept as it was.', 4500); }
    $('#svg').toggleAttribute('hidden', A.mode === 'build'); bsvg.toggleAttribute('hidden', A.mode !== 'build'); document.body.dataset.mode = A.mode; A.refreshLib && A.refreshLib(); document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === A.mode));
    $('#hint').textContent = A.mode === 'build' ? 'Drag from any hole to run a jumper wire. Pick a part on the left to place it. Click a part to move it. R rotates.' : '';
    if (A.mode === 'build') { applyV(); setTimeout(A.bfit, 10); B.render(); } else { A.render(); A.fit(); } A.renderProps(); };
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => A.setMode(b.dataset.mode));
  new ResizeObserver(() => { if (A.mode === 'build') applyV(); }).observe(stage);
})();
