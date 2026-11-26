/* WireFrame simulator: nodal analysis (backward-Euler companion models + Newton iteration).
   Works on the same net list the schematic uses, so every view of a circuit simulates the same way. */
(function () {
  const A = window.App, VT = 0.02585, GMIN = 1e-12, OFF = 1e-12;
  /* "4k7" "10u" "100n" "2.2k" "1M" "9V" "330R" -> number */
  const MULT = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, meg: 1e6, Meg: 1e6, MEG: 1e6, R: 1 };
  function num(s, dflt) { if (s === undefined || s === null) return dflt; s = String(s).trim(); const m = /^([+-]?\d*\.?\d+)\s*(meg|Meg|MEG|[pnuµmkKMGR])?(\d*)/.exec(s); if (!m) return dflt; let v = parseFloat(m[1]); const u = m[2];
    if (u && m[3]) v = parseFloat(m[1] + '.' + m[3]); if (u && MULT[u] !== undefined) v *= MULT[u]; return isFinite(v) ? v : dflt; }
  A.parseValue = num;
  A.railVolts = (nm) => { nm = String(nm || '').trim(); if (/^(VCC|VDD|VBUS|VIN)$/i.test(nm)) return 5; if (/^VEE$/i.test(nm)) return -5; if (/^VBAT$/i.test(nm)) return 3.7; const m = /^([+-]?)(\d+)(?:[.V](\d+))?V?$/i.exec(nm.replace(/^\+/, '+')); if (!m) return null; const v = parseFloat(m[2] + (m[3] ? '.' + m[3] : '')); return isFinite(v) ? (m[1] === '-' ? -v : v) : null; };

  /* ---- which library parts can be simulated, and how ---- */
  const byName = (inst, names) => { const pins = A.pinsOf(inst); return names.map(n => { const p = pins.find(q => (q.name || '').toUpperCase() === n) || pins.find(q => q.n === n); return p ? p.n : null; }); };
  const M = {
    R: { t: 'R', pins: ['1', '2'] }, R_US: { t: 'R', pins: ['1', '2'] }, RTRIM: { t: 'R', pins: ['1', '2'] }, POT: { t: 'POT', pins: ['1', '2', '3'] }, LDR: { t: 'LDR', pins: ['1', '2'] }, NTC: { t: 'NTC', pins: ['1', '2'] },
    C: { t: 'C', pins: ['1', '2'] }, CP: { t: 'C', pins: ['1', '2'] }, CVAR: { t: 'C', pins: ['1', '2'] }, L: { t: 'L', pins: ['1', '2'] }, LCORE: { t: 'L', pins: ['1', '2'] }, FUSE: { t: 'FUSE', pins: ['1', '2'] },
    D: { t: 'D', pins: ['1', '2'] }, D_SCHOTTKY: { t: 'D', pins: ['1', '2'], p: { is: 1e-7, n: 1.05 } }, D_ZENER: { t: 'ZD', pins: ['1', '2'] }, LED: { t: 'LED', pins: ['1', '2'] }, PHOTODIODE: { t: 'D', pins: ['1', '2'] },
    BAT: { t: 'V', pins: ['1', '2'] }, VDC: { t: 'V', pins: ['1', '2'] }, VAC: { t: 'VAC', pins: ['1', '2'] },
    SW: { t: 'SW', pins: ['1', '2'] }, SW_PUSH: { t: 'SW', pins: ['1', '2'], momentary: true }, SW_SPDT: { t: 'SPDT', pins: ['1', '2', '3'] },
    RELAY: { t: 'RELAY', pins: ['1', '2', '3', '4', '5'] }, MOTOR: { t: 'MOTOR', pins: ['1', '2'] }, LAMP: { t: 'LAMP', pins: ['1', '2'] }, SPEAKER: { t: 'R', pins: ['1', '2'], r: 8 }, BUZZER: { t: 'BUZZ', pins: ['1', '2'] },
    VM: { t: 'VM', pins: ['1', '2'] }, AM: { t: 'AM', pins: ['1', '2'] },
    Q_NPN: { t: 'BJT', s: 1, pins: ['2', '1', '3'] }, Q_PNP: { t: 'BJT', s: -1, pins: ['2', '1', '3'] }, Q_DARL_NPN: { t: 'BJT', s: 1, pins: ['2', '1', '3'], p: { is: 1e-24, bf: 1500 } }, Q_DARL_PNP: { t: 'BJT', s: -1, pins: ['2', '1', '3'], p: { is: 1e-24, bf: 1500 } },
    Q_NMOS: { t: 'MOS', s: 1, pins: ['2', '1', '3'] }, Q_PMOS: { t: 'MOS', s: -1, pins: ['2', '1', '3'] },
    OPAMP: { t: 'OA', pins: ['1', '2', '3', '4', '5'] }, COMP: { t: 'OA', pins: ['1', '2', '3', '4', '5'], comp: true },
    G_AND: { t: 'GATE', f: 'and', pins: ['1', '2', '3'] }, G_NAND: { t: 'GATE', f: 'nand', pins: ['1', '2', '3'] }, G_OR: { t: 'GATE', f: 'or', pins: ['1', '2', '3'] }, G_NOR: { t: 'GATE', f: 'nor', pins: ['1', '2', '3'] }, G_XOR: { t: 'GATE', f: 'xor', pins: ['1', '2', '3'] }, G_XNOR: { t: 'GATE', f: 'xnor', pins: ['1', '2', '3'] },
    G_NOT: { t: 'GATE', f: 'not', pins: ['1', '2'] }, G_BUF: { t: 'GATE', f: 'buf', pins: ['1', '2'] }, G_SCHMITT: { t: 'GATE', f: 'not', pins: ['1', '2'] },
    BRIDGE: { t: 'MACRO', pins: ['1', '2', '3', '4'], parts: [{ as: 'D', pins: ['1', '3'] }, { as: 'D', pins: ['2', '3'] }, { as: 'D', pins: ['4', '1'] }, { as: 'D', pins: ['4', '2'] }] },
    NE555: { t: '555', pins: ['1', '2', '3', '4', '5', '6', '7', '8'] }, REG_LINEAR: { t: 'REG', pins: ['1', '2', '3'] }, AMS1117: { t: 'REG', pins: ['3', '1', '2'] }
  };
  const quad = (f, g, vcc, gnd) => ({ t: 'QUAD', f, gates: g, vcc, gnd });
  M['74HC00'] = quad('nand', [[1, 2, 3], [4, 5, 6], [9, 10, 8], [12, 13, 11]], '14', '7'); M['74HC08'] = quad('and', [[1, 2, 3], [4, 5, 6], [9, 10, 8], [12, 13, 11]], '14', '7');
  M['74HC32'] = quad('or', [[1, 2, 3], [4, 5, 6], [9, 10, 8], [12, 13, 11]], '14', '7'); M['74HC86'] = quad('xor', [[1, 2, 3], [4, 5, 6], [9, 10, 8], [12, 13, 11]], '14', '7');
  M['74HC02'] = quad('nor', [[2, 3, 1], [5, 6, 4], [8, 9, 10], [11, 12, 13]], '14', '7'); M['74HC04'] = quad('not', [[1, 2], [3, 4], [5, 6], [9, 8], [11, 10], [13, 12]], '14', '7');
  // KiCad-library parts, matched by name so pin numbering differences do not matter
  const KI = [[/^Device:R(_US|_Small(_US)?)?$/, { t: 'R', pins: ['1', '2'] }], [/^Device:(C|C_Small|C_Polarized(_US)?)$/, { t: 'C', pins: ['1', '2'] }], [/^Device:(L|L_Small|L_Core.*)$/, { t: 'L', pins: ['1', '2'] }],
    [/^Device:LED.*$/, { t: 'LED', pins: ['2', '1'], byName: ['A', 'K'] }], [/^(Device|Diode):(D|1N4148.*|1N400\d|D_Small|D_Schottky.*|1N5819.*)$/, { t: 'D', byName: ['A', 'K'] }], [/^Device:D_Zener.*$/, { t: 'ZD', byName: ['A', 'K'] }],
    [/^Device:Battery.*$/, { t: 'V', pins: ['1', '2'] }], [/^Device:Q_NPN.*$/, { t: 'BJT', s: 1, byName: ['C', 'B', 'E'] }], [/^Device:Q_PNP.*$/, { t: 'BJT', s: -1, byName: ['C', 'B', 'E'] }],
    [/^Transistor_FET:.*$/, { t: 'MOS', byName: ['D', 'G', 'S'], auto: true }], [/^Transistor_BJT:.*$/, { t: 'BJT', byName: ['C', 'B', 'E'], auto: true }],
    [/^Switch:SW_(Push|SPST).*$/, { t: 'SW', pins: ['1', '2'] }], [/^Motor:Motor_DC$/, { t: 'MOTOR', pins: ['1', '2'] }], [/^Device:(Buzzer|Speaker)$/, { t: 'BUZZ', pins: ['1', '2'] }], [/^Device:Lamp$/, { t: 'LAMP', pins: ['1', '2'] }],
    [/^Device:R_Potentiometer.*$/, { t: 'POT', pins: ['1', '2', '3'] }], [/^Device:Fuse.*$/, { t: 'FUSE', pins: ['1', '2'] }]];
  /* Parts made by the AI or by hand can say how they behave: sim: { as: "NE555", pins: ["<this part's pin for model pin 1>", ...] } (pin number or name). */
  A.simTable = () => Object.keys(M).filter(k => !M[k].gates && A.LIB[k]).map(k => { const d = A.LIB[k]; return k + ' = ' + M[k].t + ' [' + M[k].pins.map(n => { const p = d.pins.find(q => q.n === n); return p ? (p.name || n) : n; }).join(', ') + ']'; }).join('\n');
  function custom(inst, d) { const sm = d.sim; if (!sm || !M[sm.as] || M[sm.as].gates) return null; const base = M[sm.as], pins = (sm.pins || []).slice(0, base.pins.length).map(x => { const p = d.pins.find(q => String(q.n) === String(x)) || d.pins.find(q => (q.name || '').toUpperCase() === String(x).toUpperCase()); return p ? p.n : null; });
    if (pins.length < base.pins.length || pins.some(x => !x)) return null; return Object.assign({}, base, { pins }); }
  /* parts made of other parts (App.def.sub = [{as:'D', pins:['1','~a'], value:'1N4007'}...]); '~name' pins are internal nodes */
  const bridgeOf = (inst, d) => { if (!/bridge|^DB1\d\d|^KBP|^GBU|^MB\d/i.test(inst.def + ' ' + d.name) || /H-?bridge|driver/i.test(d.name + ' ' + (d.desc || ''))) return null; const pl = d.pins.find(p => p.name === '+'), mi = d.pins.find(p => p.name === '-'), ac = d.pins.filter(p => /^(~|AC)/i.test(p.name || '')); if (!pl || !mi || ac.length !== 2) return null;
    return { t: 'MACRO', pins: d.pins.map(p => p.n), parts: [[ac[0].n, pl.n], [ac[1].n, pl.n], [mi.n, ac[0].n], [mi.n, ac[1].n]].map(pp => ({ as: 'D', pins: pp })) }; };
  A.simModel = (inst) => { const d = A.def(inst.def); if (!d) return null; if (d.sub && d.sub.length) return { t: 'MACRO', pins: d.pins.map(p => p.n), parts: d.sub }; if (!M[inst.def]) { const br = bridgeOf(inst, d); if (br) return br; } if (A.isMCU && A.isMCU(inst)) return { t: 'MCU', pins: d.pins.map(p => p.n) }; const cm = d.sim && custom(inst, d); if (cm) return cm; let m = M[inst.def] || (d.of && M[d.of]);
    if (!m) { const hit = KI.find(([re]) => re.test(inst.def)); if (hit) { m = Object.assign({}, hit[1]); if (m.byName) { const nm = byName(inst, m.byName); if (nm.every(Boolean)) m.pins = nm; else m = null; }
        if (m && m.auto) { const isP = /PNP|PMOS|P-Channel|Q_P/i.test(inst.def + ' ' + (d.desc || '')); m.s = isP ? -1 : 1; } } }
    return m || null; };
  A.simulatable = (inst) => !!A.simModel(inst) || (A.def(inst.def) || {}).power || (inst.ref || '').startsWith('#');

  /* ---- build ---- */
  const Sim = A.Sim = { running: false, t: 0, els: [], nodes: 0, v: [], pinI: {}, info: {}, errors: [], warnings: [], speed: 1 };
  const isGndName = n => /^(GND|AGND|DGND|PGND|VSS|0V|0)$/i.test(n || '');
  Sim.build = () => {
    const nets = A.nets(), pinNode = {}, E = Sim.els = [], err = Sim.errors = [], warn = Sim.warnings = [];
    let gnd = nets.findIndex(n => isGndName(n.name) && (n.powerPins.length || n.labels.length));
    if (gnd < 0) { const src = A.doc.parts.find(p => { const m = A.simModel(p); return m && m.t === 'V'; }); if (src) { const pin = A.pinsOf(src).find(q => q.n === A.simModel(src).pins[1]); gnd = nets.findIndex(n => n.pins.includes(pin) || n.pins.some(q => q.inst === src && q.n === pin.n)); if (gnd >= 0) warn.push('No ground symbol found, so the negative side of ' + src.ref + ' is used as 0 V. Add a GND symbol to be sure.'); } }
    if (gnd < 0) { const mcu = A.doc.parts.find(p => { const m = A.simModel(p); return m && m.t === 'MCU'; }); if (mcu) { const gp = A.pinsOf(mcu).find(q => /^GND$/i.test(q.name || '')); if (gp) { gnd = nets.findIndex(n => n.pins.some(q => q.inst === mcu && q.n === gp.n)); if (gnd >= 0) warn.push('The board\'s GND pin is 0 volts. The board is powered over USB (5 V and 3.3 V pins are live).'); } } }
    if (gnd < 0) { err.push('Add a ground (GND) symbol so the simulator knows where 0 volts is.'); }
    let k = 1; const nodeOf = new Map(); nets.forEach((n, i) => nodeOf.set(i, i === gnd ? 0 : k++)); Sim.nodes = k;
    nets.forEach((n, i) => n.pins.concat(n.powerPins).forEach(p => pinNode[p.inst.id + ':' + p.n] = nodeOf.get(i)));
    const alone = (inst, pn) => { const ni = pinNode[inst.id + ':' + pn]; const net = nets[[...nodeOf.entries()].find(([, v]) => v === ni)[0]]; return net.pins.length + net.powerPins.length <= 1 && !net.wires.length && !net.labels.length; };
    const nodeFloat = () => k++;
    Sim.names = []; nets.forEach((n, i) => Sim.names[nodeOf.get(i)] = n.name);
    A.doc.parts.forEach(inst0 => { const d = A.def(inst0.def); if (!d || d.power || (inst0.ref || '').startsWith('#')) return; const m0 = A.simModel(inst0); if (!m0) { warn.push(`${inst0.ref} (${d.name}) is not simulated yet and is treated as not connected.`); return; }
      const inner = {}; (m0.t === 'MACRO' ? m0.parts.map(sp => ({ m: Object.assign({}, M[sp.as], { pins: sp.pins }), v: sp.value })) : [{ m: m0 }]).forEach(sp => { const m = sp.m; const inst = sp.v !== undefined ? Object.assign({}, inst0, { value: sp.v, sim: inst0.sim || (inst0.sim = {}) }) : inst0;
      const nd = pn => { if (String(pn)[0] === '~') { if (inner[pn] === undefined) inner[pn] = nodeFloat(); return inner[pn]; } const x = pinNode[inst.id + ':' + pn]; return x === undefined ? 0 : x; };
      const el = { inst, m, t: m.t, n: (m.pins || []).map(nd), keys: (m.pins || []).map(pn => inst.id + ':' + pn), st: {}, val: inst.value };
      const st = inst.sim || (inst.sim = {});
      switch (m.t) {
        case 'R': el.r = Math.max(1e-3, num(inst.value, m.r || 1000)); break;
        case 'POT': el.r = Math.max(10, num(inst.value, 10000)); break;
        case 'LDR': case 'NTC': break;
        case 'C': el.c = Math.max(1e-15, num(inst.value, 1e-7)); el.st.v = 0; break;
        case 'L': el.l = Math.max(1e-9, num(inst.value, 1e-3)); el.st.i = 0; break;
        case 'V': el.vs = num(inst.value, 5); el.rint = 0.1; break;
        case 'VAC': { const vs0 = String(inst.value || ''), mh = /([\d.]+)\s*(k|M)?\s*Hz/i.exec(vs0), mv = /([\d.]+)\s*(m)?\s*V/i.exec(vs0.replace(mh ? mh[0] : '', '')) || (mh ? null : /([\d.]+)/.exec(vs0)); el.amp = (mv ? +mv[1] : 5) * (mv && mv[2] ? 1e-3 : 1) * Math.SQRT2; el.f = mh ? +mh[1] * (/k/i.test(mh[2] || '') ? 1e3 : /M/.test(mh[2] || '') ? 1e6 : 1) : 50; if (/pk|peak/i.test(inst.value || '')) el.amp /= Math.SQRT2; el.rint = 0.1; break; }
        case 'D': el.is = (m.p && m.p.is) || 1e-12; el.nn = (m.p && m.p.n) || 1.9; break;
        case 'ZD': el.vz = Math.max(1, num(String(inst.value || '5.1').replace(/V(\d)/i, '.$1'), 5.1)); break;
        case 'LED': { const c = (inst.value || '').toUpperCase(); const vf = /BLUE|WHITE/.test(c) ? 3.0 : /GREEN/.test(c) ? 2.1 : /YELLOW|ORANGE/.test(c) ? 2.0 : /IR/.test(c) ? 1.3 : 1.85; el.nn = 2; el.is = 0.01 / Math.exp(vf / (el.nn * VT)); el.vf = vf; el.color = /BLUE/.test(c) ? '#4aa8ff' : /GREEN/.test(c) ? '#46e06a' : /YELLOW/.test(c) ? '#ffe14a' : /ORANGE/.test(c) ? '#ffa43a' : /WHITE/.test(c) ? '#fff6dc' : /IR/.test(c) ? '#ff4040' : '#ff3b3b'; el.burn = 0; break; }
        case 'SW': st.on = st.on !== undefined ? st.on : (inst.state === 1); break;
        case 'SPDT': st.pos = st.pos || 0; break;
        case 'RELAY': el.vr = Math.max(1, num(inst.value, 5)); el.rc = Math.max(20, el.vr * el.vr / 0.36); st.on = false; break;
        case 'MOTOR': el.r = 8; el.w = 0; el.ke = Math.max(1, num(inst.value, 6)) / 600; break;
        case 'LAMP': el.r = 25; el.rated = Math.max(1, num(inst.value, 6)); break;
        case 'BUZZ': el.r = 42; break;
        case 'FUSE': el.rate = Math.max(0.01, num(inst.value, 1)); el.heat = 0; el.blown = false; break;
        case 'VM': el.r = 1e7; break; case 'AM': el.r = 1e-3; break;
        case 'BJT': el.s = m.s; el.is = (m.p && m.p.is) || 1e-14; el.bf = (m.p && m.p.bf) || 150; el.br = 3; el.vl = [0, 0]; break;
        case 'MOS': el.s = m.s; { const big = /IRF|IRL|FQ|STP|BUZ/i.test(inst.value || ''); el.vth = big ? 3 : 2; el.kp = big ? 5 : 0.15; } el.vl = 0; break;
        case 'OA': { const pu = (j) => alone(inst, m.pins[j]); el.floatRails = pu(3) && pu(4); if (el.floatRails) warn.push(inst.ref + ' has no power pins connected, so it runs on +/-12 V.'); el.gain = 1000; break; }
        case 'GATE': el.f = m.f; el.out = 0; break;
        case 'MCU': el.mcu = A.mcuFor(inst); break;
        case 'QUAD': el.vn = nd(m.vcc); el.gn = nd(m.gnd); el.gg = m.gates.map(g => g.map(pn => nd(String(pn)))); el.gk = m.gates.map(g => g.map(pn => inst.id + ':' + pn)); el.outv = m.gates.map(() => false); el.n = []; el.keys = []; break;
        case '555': el.q = false; el.out = 0; break;
        case 'REG': { const nm = (inst.value || '') + ' ' + d.name; const mm = /(78|79)(\d\d)|(\d)[.V](\d)/.exec(nm); el.vset = /3\.3|33/.test(nm) ? 3.3 : /7812|12/.test(nm) ? 12 : /7809|9V/.test(nm) ? 9 : /7806|6V/.test(nm) ? 6 : 5; el.drop = 1.5; el.vo = 0; break; }
      }
      E.push(el); }); });
    Sim.nodes = k;
    // power symbols named like a voltage act as an ideal supply unless a real source already drives that net
    const rail = A.railVolts;
    const railNotes = []; nets.forEach((net, i) => { const nd = nodeOf.get(i); if (nd === 0 || !net.powerPins.length) return; const vv = rail(net.name); if (vv === null) return; if (E.some(e => (e.t === 'V' || e.t === 'VAC') && e.n.includes(nd))) return;
      const pp = net.powerPins[0]; E.push({ inst: pp.inst, m: { t: 'V' }, t: 'V', n: [nd, 0], keys: [pp.inst.id + ':1', pp.inst.id + ':gnd'], st: {}, vs: vv, rint: 0.05, rail: true }); railNotes.push(net.name + ' = ' + vv + ' V'); });
    if (railNotes.length) Sim.notes = ['Power symbols supply voltage: ' + railNotes.join(', ') + '.']; else Sim.notes = [];
    Sim.v = new Array(Sim.nodes).fill(0); Sim.t = 0; Sim.pinI = {}; Sim.info = {}; Sim.E = E;
    Sim.pinNode = pinNode;
    return err.length === 0;
  };

  /* ---- solver ---- */
  function solve(Mx, b, n) { for (let i = 0; i < n; i++) { let p = i, mx = Math.abs(Mx[i][i]); for (let r = i + 1; r < n; r++) { const a = Math.abs(Mx[r][i]); if (a > mx) { mx = a; p = r; } }
      if (mx < 1e-30) { Mx[i][i] = 1e-12; } else if (p !== i) { const t = Mx[p]; Mx[p] = Mx[i]; Mx[i] = t; const tb = b[p]; b[p] = b[i]; b[i] = tb; }
      const piv = Mx[i][i]; for (let r = i + 1; r < n; r++) { const f = Mx[r][i] / piv; if (f === 0) continue; const Ri = Mx[i], Rr = Mx[r]; for (let c = i; c < n; c++) Rr[c] -= f * Ri[c]; b[r] -= f * b[i]; } }
    const x = new Array(n); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= Mx[i][c] * x[c]; x[i] = s / Mx[i][i]; } return x; }
  const pnjlim = (vnew, vold, vt, vcrit) => { if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) { if (vold > 0) { const arg = 1 + (vnew - vold) / vt; vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit; } else vnew = vt * Math.log(vnew / vt); } return vnew; };
  const expl = x => Math.exp(Math.min(x, 60));
  const sat = (x) => Math.max(-1, Math.min(1, x));

  function stepOnce(dt) {
    const N = Sim.nodes - 1, Mx = []; for (let i = 0; i < N; i++) Mx.push(new Array(N).fill(0)); const b = new Array(N).fill(0), v = Sim.v, vp = Sim.vprev, E = Sim.els;
    const G = (a, c, g) => { if (a > 0) Mx[a - 1][a - 1] += g; if (c > 0) Mx[c - 1][c - 1] += g; if (a > 0 && c > 0) { Mx[a - 1][c - 1] -= g; Mx[c - 1][a - 1] -= g; } };
    const I = (a, i) => { if (a > 0) b[a - 1] += i; };               // current injected INTO node a
    const src = (a, ref, vt, rout) => { const g = 1 / rout; G(a, ref, g); I(a, g * vt); I(ref, -g * vt); };   // Thevenin source a-ref
    const nl = (nodes, I0, J, v0) => { for (let i = 0; i < nodes.length; i++) { const ni = nodes[i]; if (ni <= 0) continue; let c = -I0[i]; for (let j = 0; j < nodes.length; j++) { const nj = nodes[j]; c += J[i][j] * v0[j]; if (nj > 0) Mx[ni - 1][nj - 1] += J[i][j]; } b[ni - 1] += c; } };
    for (let i = 1; i < Sim.nodes; i++) Mx[i - 1][i - 1] += GMIN;
    for (const e of E) { const [a, c, d3] = e.n;
      switch (e.t) {
        case 'R': G(a, c, 1 / e.r); break; case 'VM': case 'AM': G(a, c, 1 / e.r); break; case 'LAMP': case 'BUZZ': G(a, c, 1 / e.r); break;
        case 'POT': { const x = Math.max(0.01, Math.min(0.99, (e.inst.sim.pos !== undefined ? e.inst.sim.pos : 0.5))); G(a, d3, 1 / Math.max(1, e.r * x)); G(d3, c, 1 / Math.max(1, e.r * (1 - x))); break; }
        case 'LDR': { const l = e.inst.sim.light !== undefined ? e.inst.sim.light : 0.5; G(a, c, 1 / (200 + 1e6 * Math.pow(1 - l, 3))); break; }
        case 'NTC': { const t = e.inst.sim.temp !== undefined ? e.inst.sim.temp : 0.5; G(a, c, 1 / (Math.max(200, num(e.inst.value, 10000) * Math.exp(-4 * (t - 0.5))))); break; }
        case 'FUSE': G(a, c, e.blown ? OFF : 1 / 0.02); break;
        case 'C': { const g = e.c / dt; G(a, c, g); I(a, g * e.st.v); I(c, -g * e.st.v); break; }
        case 'L': { const g = dt / e.l; G(a, c, g); I(a, -e.st.i); I(c, e.st.i); break; }
        case 'V': { const g = 1 / e.rint; G(a, c, g); I(a, g * e.vs); I(c, -g * e.vs); break; }
        case 'VAC': { const vs = e.amp * Math.sin(2 * Math.PI * e.f * Sim.t); const g = 1 / e.rint; G(a, c, g); I(a, g * vs); I(c, -g * vs); break; }
        case 'SW': G(a, c, e.inst.sim.on ? 1000 : OFF); break;
        case 'SPDT': G(a, c, e.inst.sim.pos ? OFF : 1000); G(a, d3, e.inst.sim.pos ? 1000 : OFF); break;
        case 'MOTOR': { const g = 1 / e.r, emf = e.ke * e.w; G(a, c, g); I(a, -g * emf); I(c, g * emf); break; }
        case 'RELAY': { G(e.n[0], e.n[1], 1 / e.rc); const on = e.inst.sim.on; G(e.n[2], e.n[3], on ? 20 : OFF); G(e.n[2], e.n[4], on ? OFF : 20); break; }
        case 'D': case 'LED': { const vt = e.nn * VT, vcrit = vt * Math.log(vt / (Math.SQRT2 * e.is)); let vd = (v[a] - v[c]); vd = pnjlim(vd, e.vl === undefined ? 0 : e.vl, vt, vcrit); e.vl = vd; const ex = expl(vd / vt), id = e.is * (ex - 1), g = e.is * ex / vt + GMIN;
          const ieq = id - g * vd; I(a, -ieq); I(c, ieq); G(a, c, g); break; }
        case 'ZD': { const vt = 1.0 * VT, vcrit = vt * Math.log(vt / (Math.SQRT2 * 1e-12)); let vd = v[a] - v[c]; const vlast = e.vl === undefined ? 0 : e.vl; vd = Math.max(vlast - 0.5, Math.min(vlast + 0.5, vd)); if (vd > 0.3) vd = pnjlim(vd, Math.max(vlast, 0.3), vt, vcrit); e.vl = vd;
          const is = 1e-12, nf = 1.0, ef = expl(vd / (nf * VT)), er = expl((-vd - e.vz) / 0.03); const id = is * (ef - 1) - 5e-3 * er, g = is * ef / (nf * VT) + 5e-3 * er / 0.03 + GMIN; const ieq = id - g * vd; I(a, -ieq); I(c, ieq); G(a, c, g); break; }
        case 'BJT': { const [nc, nb, ne] = e.n, s = e.s; let vbe = s * (v[nb] - v[ne]), vbc = s * (v[nb] - v[nc]); const vc = VT * Math.log(VT / (Math.SQRT2 * e.is)); vbe = pnjlim(vbe, e.vl[0], VT, vc); vbc = pnjlim(vbc, e.vl[1], VT, vc); e.vl = [vbe, vbc];
          const ef = expl(vbe / VT), er = expl(vbc / VT), If = e.is * (ef - 1), Ir = e.is * (er - 1), gf = e.is * ef / VT + GMIN, gr = e.is * er / VT + GMIN;
          const Ic = If - Ir - Ir / e.br, Ib = If / e.bf + Ir / e.br; const dIc_be = gf, dIc_bc = -gr - gr / e.br, dIb_be = gf / e.bf, dIb_bc = gr / e.br;
          // terminal currents into device (C,B,E), jacobian wrt node voltages (C,B,E); vbe=s(vb-ve), vbc=s(vb-vc)
          const Jc = [-dIc_bc, dIc_be + dIc_bc, -dIc_be], Jb = [-dIb_bc, dIb_be + dIb_bc, -dIb_be], Je = [-(Jc[0] + Jb[0]), -(Jc[1] + Jb[1]), -(Jc[2] + Jb[2])];
          const ve0 = v[ne], vb0 = ve0 + s * vbe, vc0 = vb0 - s * vbc; nl([nc, nb, ne], [s * Ic, s * Ib, -s * (Ic + Ib)], [Jc, Jb, Je], [vc0, vb0, ve0]); break; }
        case 'MOS': { const [nd_, ng, ns] = e.n, s = e.s; let dn = nd_, sn = ns; if (s * (v[dn] - v[sn]) < 0) { dn = ns; sn = nd_; } const vgs = s * (v[ng] - v[sn]), vds = s * (v[dn] - v[sn]), vov = vgs - e.vth * 1; let id = 0, gm = 0, gds = 1e-9;
          if (vov > 0) { const lam = 0.02; if (vds < vov) { id = e.kp * (vov * vds - vds * vds / 2) * (1 + lam * vds); gm = e.kp * vds * (1 + lam * vds); gds = e.kp * (vov - vds) * (1 + lam * vds) + e.kp * (vov * vds - vds * vds / 2) * lam + 1e-9; } else { id = e.kp / 2 * vov * vov * (1 + lam * vds); gm = e.kp * vov * (1 + lam * vds); gds = e.kp / 2 * vov * vov * lam + 1e-9; } }
          const Jd = [gds, gm, -(gds + gm)]; const nodes = [dn, ng, sn];
          nl(nodes, [s * id + 0, 0, -s * id], [[Jd[0], Jd[1], Jd[2]], [0, 0, 0], [-Jd[0], -Jd[1], -Jd[2]]], [v[dn], v[ng], v[sn]]); I(ng, 0); break; }
        case 'OA': { const [ni, np, no, nvp, nvn] = e.n; const hi = e.floatRails ? 12 : v[nvp] - 0.8, lo = e.floatRails ? -12 : v[nvn] + 0.1 + (e.inst.def === 'COMP' ? 0 : 0); const mid = (hi + lo) / 2, half = Math.max(0.05, (hi - lo) / 2);
          const vd = v[np] - v[ni], th = Math.tanh(e.gain * vd / half), vt = mid + half * th, dvt = e.gain * (1 - th * th); const rout = 75, g = 1 / rout;
          nl([no, np, ni], [g * (v[no] - vt), -g * (v[no] - vt) * 0, 0], [[g, -g * dvt, g * dvt], [0, 0, 0], [0, 0, 0]], [v[no], v[np], v[ni]]); break; }
        case 'MCU': { const mc = e.mcu; if (!mc) break; mc.pins.forEach(pp => { const nd_ = e.n[pp.idx]; pp.r = 0; if (!nd_) return; if (pp.role === 'v5') { pp.vt = 5; pp.r = 0.5; } else if (pp.role === 'v33') { pp.vt = 3.3; pp.r = 1; } else if (pp.role === 'gpio') { if (pp.mode === 1) { pp.vt = mc.level(pp); pp.r = 25; } else if (pp.mode === 2) { pp.vt = mc.vhigh; pp.r = 40000; } else { G(nd_, 0, 1e-9); return; } } else return; src(nd_, 0, pp.vt, pp.r); }); break; }
        case 'GATE': { const pv = Sim.vprev; const hi = 5, th = 2.5, ina = pv[e.n[0]] > th, inb = e.n.length > 2 ? pv[e.n[1]] > th : false; let o; switch (e.f) { case 'and': o = ina && inb; break; case 'nand': o = !(ina && inb); break; case 'or': o = ina || inb; break; case 'nor': o = !(ina || inb); break; case 'xor': o = ina !== inb; break; case 'xnor': o = ina === inb; break; case 'not': o = !ina; break; default: o = ina; }
          e.n.slice(0, -1).forEach(ni => G(ni, 0, 1e-8)); src(e.n[e.n.length - 1], 0, o ? hi : 0, 60); e.outv = o; break; }
        case 'QUAD': { const pv = Sim.vprev, hi = Math.max(0, pv[e.vn] - pv[e.gn]), th = hi / 2;
          e.gg.forEach((gt, k) => { const ina = pv[gt[0]] - pv[e.gn] > th, inb = gt.length > 2 ? pv[gt[1]] - pv[e.gn] > th : false; let o;
            switch (e.m.f) { case 'and': o = ina && inb; break; case 'nand': o = !(ina && inb); break; case 'or': o = ina || inb; break; case 'nor': o = !(ina || inb); break; case 'xor': o = ina !== inb; break; default: o = !ina; }
            e.outv[k] = o; gt.slice(0, -1).forEach(ni => G(ni, e.gn, 1e-8)); src(gt[gt.length - 1], e.gn, o && hi > 1 ? hi : 0, 60); }); G(e.vn, e.gn, 1 / 20000); break; }
        case '555': { const [ng, ntr, nout, nrst, ncv, nth, ndis, nvcc] = e.n; const pv = Sim.vprev; G(nvcc, ncv, 1 / 5000); G(ncv, ng, 1 / 10000);
          const vcc = pv[nvcc] - pv[ng]; const cv = (pv[ncv] - pv[ng]) || (2 / 3 * vcc);
          if (vcc > 3) { if (pv[nrst] - pv[ng] < 0.7) e.q = false; else { if (pv[ntr] - pv[ng] < cv / 2) e.q = true; else if (pv[nth] - pv[ng] > cv) e.q = false; } } else e.q = false;
          src(nout, ng, e.q && vcc > 3 ? vcc - 1.5 : (vcc > 3 ? 0.1 : 0), 20); if (!e.q) G(ndis, ng, 1 / 10); break; }
        case 'REG': { const [nin, ngn, nout] = e.n; const pv = Sim.vprev; const vi = pv[nin] - pv[ngn]; const tgt = Math.max(0, Math.min(e.vset, vi - e.drop)); src(nout, ngn, tgt, 0.2); I(nin, -(e.iout || 0) - 0.005); I(ngn, (e.iout || 0) + 0.005); break; }
      } }
    const x = solve(Mx, b, N); return x;
  }
  /* terminal currents (into each pin) for animation and meters, computed from the converged solution */
  function report(dt) {
    const v = Sim.v, vp = Sim.vprev, P = Sim.pinI = {}; const add = (k, i) => P[k] = (P[k] || 0) + i; const info = Sim.info;
    for (const e of Sim.els) { const [a, c, d3] = e.n, [ka, kc, kd] = e.keys; let i = 0;
      switch (e.t) {
        case 'R': case 'LAMP': case 'BUZZ': case 'VM': case 'AM': i = (v[a] - v[c]) / e.r; add(ka, i); add(kc, -i); break;
        case 'FUSE': i = (v[a] - v[c]) * (e.blown ? OFF : 50); add(ka, i); add(kc, -i); break;
        case 'POT': { const x = Math.max(0.01, Math.min(0.99, e.inst.sim.pos !== undefined ? e.inst.sim.pos : 0.5)); const i1 = (v[a] - v[d3]) / Math.max(1, e.r * x), i2 = (v[d3] - v[c]) / Math.max(1, e.r * (1 - x)); add(ka, i1); add(kd, i2 - i1); add(kc, -i2); break; }
        case 'LDR': case 'NTC': i = (v[a] - v[c]) * (e.t === 'LDR' ? 1 / (200 + 1e6 * Math.pow(1 - (e.inst.sim.light !== undefined ? e.inst.sim.light : .5), 3)) : 1e-4); add(ka, i); add(kc, -i); break;
        case 'C': i = e.c / dt * ((v[a] - v[c]) - e.st.v); add(ka, i); add(kc, -i); break;
        case 'L': i = e.st.i; add(ka, i); add(kc, -i); break;
        case 'V': i = -(e.vs - (v[a] - v[c])) / e.rint; add(ka, i); add(kc, -i); info[e.inst.id] = { i: -i, v: v[a] - v[c] }; break;
        case 'VAC': { const vs = e.amp * Math.sin(2 * Math.PI * e.f * Sim.t); i = -(vs - (v[a] - v[c])) / e.rint; add(ka, i); add(kc, -i); break; }
        case 'SW': i = (v[a] - v[c]) * (e.inst.sim.on ? 1000 : OFF); add(ka, i); add(kc, -i); break;
        case 'SPDT': { const i1 = (v[a] - v[c]) * (e.inst.sim.pos ? OFF : 1000), i2 = (v[a] - v[d3]) * (e.inst.sim.pos ? 1000 : OFF); add(ka, i1 + i2); add(kc, -i1); add(kd, -i2); break; }
        case 'MOTOR': i = (v[a] - v[c] - e.ke * e.w) / e.r; add(ka, i); add(kc, -i); break;
        case 'RELAY': { i = (v[a] - v[c]) / e.rc; add(ka, i); add(kc, -i); const on = e.inst.sim.on; const i1 = (v[e.n[2]] - v[e.n[3]]) * (on ? 20 : OFF), i2 = (v[e.n[2]] - v[e.n[4]]) * (on ? OFF : 20); add(e.keys[2], i1 + i2); add(e.keys[3], -i1); add(e.keys[4], -i2); break; }
        case 'D': case 'LED': { const vt = e.nn * VT, vd = v[a] - v[c]; i = e.is * (expl(vd / vt) - 1); add(ka, i); add(kc, -i); break; }
        case 'ZD': { const vd = v[a] - v[c]; i = 1e-12 * (expl(vd / VT) - 1) - 5e-3 * expl((-vd - e.vz) / 0.03); add(ka, i); add(kc, -i); break; }
        case 'BJT': { const [nc, nb, ne] = e.n, s = e.s, vbe = s * (v[nb] - v[ne]), vbc = s * (v[nb] - v[nc]); const If = e.is * (expl(vbe / VT) - 1), Ir = e.is * (expl(vbc / VT) - 1), Ic = If - Ir - Ir / e.br, Ib = If / e.bf + Ir / e.br; add(e.keys[0], s * Ic); add(e.keys[1], s * Ib); add(e.keys[2], -s * (Ic + Ib)); info[e.inst.id] = { ic: s * Ic, ib: s * Ib, vce: Math.abs(v[nc] - v[ne]) }; break; }
        case 'MOS': { const [nd_, ng, ns] = e.n, s = e.s; let dn = nd_, sn = ns; if (s * (v[dn] - v[sn]) < 0) { dn = ns; sn = nd_; } const vgs = s * (v[ng] - v[sn]), vds = s * (v[dn] - v[sn]), vov = vgs - e.vth; let id = 0; if (vov > 0) id = vds < vov ? e.kp * (vov * vds - vds * vds / 2) * (1 + 0.02 * vds) : e.kp / 2 * vov * vov * (1 + 0.02 * vds); const sgn = dn === nd_ ? 1 : -1; add(e.keys[0], sgn * s * id); add(e.keys[2], -sgn * s * id); info[e.inst.id] = { id: sgn * s * id }; break; }
        case 'OA': { const no = e.n[2], hi = e.floatRails ? 12 : v[e.n[3]] - 0.8, lo = e.floatRails ? -12 : v[e.n[4]] + 0.1, mid = (hi + lo) / 2, half = Math.max(0.05, (hi - lo) / 2), vt = mid + half * Math.tanh(e.gain * (v[e.n[1]] - v[e.n[0]]) / half); i = (v[no] - vt) / 75; add(e.keys[2], i); break; }
        case 'QUAD': { const hi = Math.max(0, v[e.vn] - v[e.gn]); e.gg.forEach((gt, k) => { const no = gt[gt.length - 1], ii = (v[no] - v[e.gn] - (e.outv[k] && hi > 1 ? hi : 0)) / 60; add(e.gk[k][gt.length - 1], ii); add(e.keys[0] || e.gk[0][0], 0); }); break; }
        case 'MCU': { const mc = e.mcu; if (mc) mc.pins.forEach(pp => { if (pp.r) add(e.keys[pp.idx], (v[e.n[pp.idx]] - pp.vt) / pp.r); }); break; }
        case 'GATE': { const no = e.n[e.n.length - 1]; i = (v[no] - (e.outv ? 5 : 0)) / 60; add(e.keys[e.keys.length - 1], i); break; }
        case '555': { const nout = e.n[2], vcc = v[e.n[7]] - v[e.n[0]]; i = (v[nout] - v[e.n[0]] - (e.q && vcc > 3 ? vcc - 1.5 : (vcc > 3 ? .1 : 0))) / 20; add(e.keys[2], i); add(e.keys[0], -i); const ic = (v[e.n[7]] - v[e.n[4]]) / 5000; add(e.keys[7], ic); add(e.keys[4], -ic + (v[e.n[4]] - v[e.n[0]]) / 10000); add(e.keys[0], -(v[e.n[4]] - v[e.n[0]]) / 10000); if (!e.q) { const di = (v[e.n[6]] - v[e.n[0]]) / 10; add(e.keys[6], di); add(e.keys[0], -di); } break; }
        case 'REG': { const nout = e.n[2], vi = v[e.n[0]] - v[e.n[1]]; const tgt = Math.max(0, Math.min(e.vset, vi - e.drop)); i = (v[nout] - v[e.n[1]] - tgt) / 0.2; e.iout = -i; add(e.keys[2], i); add(e.keys[0], -e.iout + 0.005); add(e.keys[1], -0.005 + e.iout); break; }
      }
    }
  }
  /* advance one internal step; returns false if Newton failed to converge */
  function advance(dt) {
    Sim.vprev = Sim.v.slice(); let ok = false, x;
    const v0 = Sim.v.slice();
    for (let it = 0; it < 60; it++) { x = stepOnce(dt); let md = 0; for (let i = 1; i < Sim.nodes; i++) { const nv = x[i - 1], d = Math.abs(nv - Sim.v[i]); md = Math.max(md, d / (1e-4 * Math.abs(nv) + 1e-6)); Sim.v[i] = nv; } if (md < 1 && it > 0) { ok = true; break; } }
    if (!ok) { Sim.v = v0; }
    for (const e of Sim.els) { const v = Sim.v, [a, c] = e.n; if (e.t === 'C') e.st.v = v[a] - v[c]; else if (e.t === 'L') e.st.i += dt / e.l * (v[a] - v[c]);
      else if (e.t === 'MOTOR') { const i = (v[a] - v[c] - e.ke * e.w) / e.r; e.w += dt * (e.ke * i - 2e-6 * e.w) / 2e-6; e.w = Math.max(-3000, Math.min(3000, e.w)); }
      else if (e.t === 'RELAY') { const vc = v[a] - v[c]; if (!e.inst.sim.on && vc > 0.7 * e.vr) e.inst.sim.on = true; else if (e.inst.sim.on && vc < 0.25 * e.vr) e.inst.sim.on = false; }
      else if (e.t === 'LED') { const vd = v[a] - v[c], i = e.is * (expl(vd / (e.nn * VT)) - 1); e.i = i; e.burn = i > 0.06 ? e.burn + dt : Math.max(0, e.burn - dt * .2); if (e.burn > 0.3 && !e.dead) { e.dead = true; Sim.events.push({ type: 'led', inst: e.inst }); } e.lum = e.lum === undefined ? 0 : e.lum; e.lum += (Math.min(1, Math.max(0, i / 0.02)) - e.lum) * Math.min(1, dt / 0.012); }
      else if (e.t === 'FUSE') { const i = Math.abs(v[a] - v[c]) * (e.blown ? OFF : 50); if (i > e.rate * 1.5 && !e.blown) { e.heat += dt * (i / e.rate) ; if (e.heat > 0.4) { e.blown = true; Sim.events.push({ type: 'fuse', inst: e.inst }); } } else e.heat = Math.max(0, e.heat - dt); }
      else if (e.t === 'LAMP') { const vv = v[a] - v[c]; e.lum = e.lum === undefined ? 0 : e.lum; e.lum += (Math.min(1.3, (vv / e.rated) * (vv / e.rated)) - e.lum) * Math.min(1, dt / 0.08); }
    }
    Sim.t += dt; return ok; }
  Sim.events = [];
  /* advance the simulation by `seconds` of circuit time */
  Sim.run = (seconds) => { const steps = Math.min(240, Math.max(1, Math.ceil(seconds / 40e-6))), dt = seconds / steps; let bad = 0; for (let i = 0; i < steps; i++) { if (!advance(dt)) { bad++; if (!advance(dt / 2) || !advance(dt / 2)) { /* give up on this step */ } } } report(Math.max(dt, 1e-9)); Sim.bad = bad; };
  Sim.reset = () => { Sim.events = []; A.doc.parts.forEach(p => { if (p.sim) { const keep = { pos: p.sim.pos, light: p.sim.light, temp: p.sim.temp }; p.sim = keep; } }); Sim.build(); };
  Sim.nodeV = (key) => { const n = Sim.pinNode[key]; return n === undefined ? 0 : Sim.v[n]; };
})();
