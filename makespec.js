/* Import a circuit from MakeSpec (github.com/Ed13S/MakeSpec).
   MakeSpec sends { format: "makespec-circuit", version: 1, title, explanation,
     components: [{ id, name, kind, pins: [...] }],
     connections: [{ net, from_component, from_pin, to_component, to_pin, notes }] }.
   Each component is matched to a library part by its name (a resistor becomes the resistor symbol, an
   "ESP32 DevKitC" the ESP32 DevKit, ...). Anything unknown becomes a generic box that carries the pin
   names MakeSpec used, so no connection is lost. Pins are matched by number, name or a common alias.
   Entry points: "#makespec=<base64url JSON>" on the page address, or pasting the JSON into the AI
   dialog's "Make a circuit" reply box. Importing from the address opens a NEW project, so nothing is overwritten. */
(function () {
  const A = window.App, $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FORMAT = 'makespec-circuit', MAX_COMPONENTS = 80, MAX_CONNECTIONS = 500;

  /* name -> library part. First match wins, so specific parts come before general ones.
     The third value marks parts whose two (or more) pins are interchangeable. */
  const RULES = [
    [/esp32[-\s]?c3|supermini/i, 'ESP32_C3'],
    [/esp32|esp-wroom|esp-32/i, 'ESP32_DEVKIT'],
    [/arduino\s*uno|\buno\b/i, 'ARDUINO_UNO'],
    [/arduino\s*nano|\bnano\b/i, 'ARDUINO_NANO'],
    [/dht\s?(11|22)|am2302/i, 'DHT11'],
    [/mpu[-\s]?6050/i, 'MPU6050'],
    [/ds3231/i, 'RTC_DS3231'],
    [/hc[-\s]?sr04|ultrasonic/i, 'HC_SR04'],
    [/1602|16\s?x\s?2/i, 'LCD1602'],
    [/oled|ssd1306/i, 'OLED_I2C'],
    [/relay\s*(module|board)/i, 'RELAY_MOD'],
    [/relay/i, 'RELAY'],
    [/lm35\b/i, 'LM35'], [/ne555|\b555\b/i, 'NE555'], [/lm358/i, 'LM358'], [/lm741|\b741\b/i, 'LM741'],
    [/lm393/i, 'LM393'], [/lm386/i, 'LM386'], [/mcp3008/i, 'MCP3008'], [/mcp4725/i, 'DAC_MCP4725'],
    [/ams1117|\b1117\b/i, 'REG_AMS1117'], [/lm317/i, 'REG_ADJ'], [/\b78\d\d\b|regulator|\bldo\b/i, 'REG_LINEAR'],
    [/op-?amp/i, 'OPAMP'], [/comparator/i, 'COMP'],
    [/potentiometer|\bpot\b/i, 'POT'],
    [/\bldr\b|photo-?resistor/i, 'LDR', true],
    [/thermistor|\bntc\b/i, 'NTC', true],
    [/resistor|\bohms?\b|[Ωω]/i, 'R', true],
    [/electrolytic|polari[sz]ed/i, 'CP'],
    [/capacitor|\bcap\b/i, 'C', true],
    [/inductor|\bcoil\b/i, 'L', true],
    [/crystal|oscillator/i, 'XTAL', true],
    [/schottky/i, 'D_SCHOTTKY'], [/zener/i, 'D_ZENER'],
    [/\bled\b/i, 'LED'], [/diode|1n4\d{3}/i, 'D'],
    [/darlington|tip12\d/i, 'Q_DARL_NPN'],
    [/pnp|bc557|2n3906/i, 'Q_PNP'],
    [/p-?channel|p-?mosfet/i, 'Q_PMOS'],
    [/mosfet|n-?channel|irlz|\birf\w+/i, 'Q_NMOS'],
    [/npn|transistor|2n2222|bc547|2n3904/i, 'Q_NPN'],
    [/servo/i, 'SERVO'], [/motor/i, 'MOTOR'], [/buzzer|piezo/i, 'BUZZER'], [/speaker/i, 'SPEAKER'], [/lamp|bulb/i, 'LAMP', true],
    [/push|button|tactile|momentary/i, 'SW_PUSH', true], [/spdt/i, 'SW_SPDT'], [/switch/i, 'SW', true],
    [/battery|\bcell\b|18650|li-?po|li-?ion|\baaa?\b/i, 'BAT'],
    [/supply|\busb\b|adapter|adaptor|dc jack|power source/i, 'VDC']
  ];
  const KIND_REF = { controller: 'U', sensor: 'U', actuator: 'M', display: 'DS', power: 'PS', passive: 'Z', connector: 'J', other: 'U' };

  const SUPPLY = /^(\+|vcc|vdd|vs|\+vs|v\+|vin|vbus|vbat|vref|\+?\d+(\.\d+)?v\d*|3v3)\d*$/i;
  const GROUND = /^(gnd|agnd|dgnd|pgnd|vss|v-|0v|ground|-|vee)\d*$/i;
  const ALIAS = { anode: 'a', cathode: 'k', positive: '+', negative: '-', plus: '+', minus: '-', wiper: 'w', signal: 'sig', pwm: 'sig',
    output: 'out', input: 'in', base: 'b', collector: 'c', emitter: 'e', gate: 'g', drain: 'd', source: 's' };
  const GENERIC_TOKENS = new Set(['gpio', 'pin', 'io', 'd', 'a']);
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9+\-]/g, '');
  const toks = s => String(s).toLowerCase().split(/[^a-z0-9+\-]+/).filter(Boolean);
  const canonV = s => String(s).toLowerCase().replace(/^\+/, '').replace(/(\d+)\.(\d+)v/, '$1v$2');

  function supplyScore(label, pinName){
    const l = canonV(norm(label)), p = canonV(norm(pinName));
    if (l === p) return 4;
    if (/^(5v|vbus|vin|usb)$/.test(l) && /^(vin|vbus|5v)$/.test(p)) return 3;
    if (/^(vcc|vdd)$/.test(l) && /^(vcc|vdd)$/.test(p)) return 2;
    if (!/\d/.test(l) && SUPPLY.test(pinName) && !/\d/.test(p)) return 1;
    return 0;
  }

  function resolveLabel(def, label, taken){
    const pins = def.pins, L = String(label).trim(), nl = norm(L), free = p => !taken.has(p.n);
    let c;
    if (/^\d+$/.test(L)){ c = pins.find(p => p.n === L && free(p)); if (c) return c; }
    const exact = pins.filter(p => norm(p.name) === nl);
    c = exact.find(free); if (c) return c;
    const lt = toks(L).map(t => ALIAS[t] || t);
    c = pins.find(p => free(p) && lt.includes(norm(p.name))); if (c) return c;
    c = pins.find(p => free(p) && toks(p.name).some(t => !GENERIC_TOKENS.has(t) && lt.includes(t))); if (c) return c;
    if (SUPPLY.test(L)){
      const cands = pins.filter(p => free(p) && SUPPLY.test(p.name)).map(p => ({ p, s: supplyScore(L, p.name) })).sort((a, b) => b.s - a.s);
      if (cands.length && cands[0].s > 0) return cands[0].p;
      if (cands.length === 1) return cands[0].p;
    }
    if (GROUND.test(L)){ c = pins.find(p => free(p) && GROUND.test(p.name)); if (c) return c; }
    return null;
  }

  function mapPins(def, comp, symmetric){
    const labels = comp.labels.filter(l => comp.usedLabels.has(l)), out = new Map(), taken = new Set();
    if (symmetric){
      if (labels.length > def.pins.length) return null;
      if (labels.every(l => /^\d+$/.test(l) && def.pins.some(p => p.n === l))){ labels.forEach(l => out.set(l, l)); return out; }
      labels.forEach((l, i) => out.set(l, def.pins[i].n));
      return out;
    }
    for (const l of labels){ const p = resolveLabel(def, l, taken); if (!p) return null; out.set(l, p.n); taken.add(p.n); }
    return out;
  }

  function pickDef(comp){
    for (const [re, id, sym] of RULES) if (re.test(comp.name) && A.def(id)) return { id, sym: !!sym };
    if (comp.kind === 'connector'){ const n = comp.labels.length, id = 'CONN_' + n; if (A.def(id)) return { id, sym: true }; }
    if (comp.kind === 'power' && A.def('VDC')) return { id: 'VDC', sym: false };
    return null;
  }

  function valueFor(id, name){
    let m;
    if (/^(R|R_US|POT|RTRIM|NTC|LDR)$/.test(id)){
      m = /(\d+(?:\.\d+)?)\s*([kKMG]?)\s*(?:ohms?|[Ωω])/i.exec(name) || /(\d+(?:\.\d+)?)\s*([kKM])\b/.exec(name);
      if (m) return m[1] + (m[2] === 'M' ? 'M' : m[2].toLowerCase());
    } else if (/^(C|CP|CVAR)$/.test(id)){
      m = /(\d+(?:\.\d+)?)\s*([pnuµm])?\s*F\b/i.exec(name);
      if (m) return m[1] + (m[2] ? (m[2] === 'µ' ? 'u' : m[2].toLowerCase()) : '');
    } else if (/^(L|LCORE)$/.test(id)){
      m = /(\d+(?:\.\d+)?)\s*([nuµm])?\s*H\b/i.exec(name);
      if (m) return m[1] + (m[2] ? (m[2] === 'µ' ? 'u' : m[2].toLowerCase()) : '');
    } else if (id === 'LED'){
      m = /\b(red|green|blue|yellow|white|orange)\b/i.exec(name);
      if (m) return m[1].toUpperCase();
    } else if (id === 'BAT' || id === 'VDC'){
      m = /(\d+(?:\.\d+)?)\s*V\b/i.exec(name);
      if (m) return m[1] + 'V';
    }
    return undefined;
  }

  const canonNet = n => { n = String(n || '').trim(); if (/^(gnd|ground|0v)$/i.test(n)) return 'GND'; return n.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_+\-.]/g, '').slice(0, 20); };
  const POWERISH = /^(GND|VCC|VDD|VSS|VIN|VBUS|VBAT|[+-]?\d+(\.\d+)?V\d*|[+-]?3V3)$/i;

  /* MakeSpec circuit -> WireFrame spec (the same format the AI assistant produces) */
  A.fromMakeSpec = (circuit) => {
    let comps = (circuit.components || []).filter(c => c && c.id != null).slice(0, MAX_COMPONENTS).map(c => ({
      id: String(c.id), name: String(c.name || c.id), kind: String(c.kind || 'other'),
      labels: [], usedLabels: new Set(), pinsListed: (Array.isArray(c.pins) ? c.pins : []).map(String) }));
    const byId = new Map(comps.map(c => [c.id, c]));
    const conns = (circuit.connections || []).slice(0, MAX_CONNECTIONS).filter(k => k && byId.has(String(k.from_component)) && byId.has(String(k.to_component)) && k.from_pin != null && k.to_pin != null)
      .map(k => ({ net: canonNet(k.net), a: String(k.from_component), ap: String(k.from_pin), b: String(k.to_component), bp: String(k.to_pin) }));
    if (!comps.length || !conns.length) throw new Error('That MakeSpec circuit has no connections.');
    const addLabel = (c, l) => { if (!c.labels.includes(l)) c.labels.push(l); };
    comps.forEach(c => c.pinsListed.forEach(l => addLabel(c, l)));
    conns.forEach(k => { const a = byId.get(k.a), b = byId.get(k.b); addLabel(a, k.ap); addLabel(b, k.bp); a.usedLabels.add(k.ap); b.usedLabels.add(k.bp); });

    comps = comps.filter(c => c.labels.length);
    const refCount = {}, nextRef = pre => { refCount[pre] = (refCount[pre] || 0) + 1; return pre + refCount[pre]; };
    const newParts = [], generic = [];
    comps.forEach(c => {
      const hit = pickDef(c);
      if (hit){
        const def = A.def(hit.id), map = mapPins(def, c, hit.sym);
        if (map){ c.partId = hit.id; c.ref = nextRef(def.ref || 'U'); c.pinOf = map; c.value = valueFor(hit.id, c.name); return; }
      }
      // generic box: supply pins on top, ground at the bottom, the rest split left and right
      const used = c.labels.slice(), top = [], bottom = [], rest = [];
      c.pinOf = new Map();
      used.forEach((l, i) => c.pinOf.set(l, String(i + 1)));
      used.forEach(l => { const entry = c.pinOf.get(l) + ':' + l; if (GROUND.test(l)) bottom.push(entry); else if (SUPPLY.test(l)) top.push(entry); else rest.push(entry); });
      const half = Math.ceil(rest.length / 2);
      c.ref = nextRef(KIND_REF[c.kind] || 'U'); c.partId = 'MS:' + c.id.replace(/\W+/g, '_');
      newParts.push({ id: c.partId, name: c.name, ref: c.ref.replace(/\d+$/, ''), value: c.name, sides: { l: rest.slice(0, half), r: rest.slice(half), t: top, b: bottom } });
      generic.push(c.name);
    });

    // nets: join every pair of pins that a connection ties together, plus groups sharing a power name
    const parent = new Map(), find = x => { while (parent.get(x) !== x){ parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const key = (cid, l) => cid + '\u0001' + l, add = x => { if (!parent.has(x)) parent.set(x, x); };
    const union = (x, y) => { add(x); add(y); parent.set(find(x), find(y)); };
    conns.forEach(k => union(key(k.a, k.ap), key(k.b, k.bp)));
    const firstWithName = new Map();
    conns.forEach(k => { if (k.net && POWERISH.test(k.net)){ const f = firstWithName.get(k.net.toUpperCase()); if (f) union(f, key(k.a, k.ap)); else firstWithName.set(k.net.toUpperCase(), key(k.a, k.ap)); } });
    const groups = new Map();
    const pinRef = (cid, l) => { const c = byId.get(cid); return c.ref + '.' + c.pinOf.get(l); };
    conns.forEach(k => {
      const g = find(key(k.a, k.ap)); if (!groups.has(g)) groups.set(g, { pins: new Set(), names: {} });
      const grp = groups.get(g); grp.pins.add(pinRef(k.a, k.ap)); grp.pins.add(pinRef(k.b, k.bp));
      if (k.net) grp.names[k.net] = (grp.names[k.net] || 0) + 1;
    });
    const usedNames = new Set(), nets = [];
    groups.forEach(grp => {
      if (grp.pins.size < 2) return;
      let name = Object.keys(grp.names).sort((x, y) => grp.names[y] - grp.names[x])[0];
      if (name && !POWERISH.test(name)){ let n = name, i = 2; while (usedNames.has(n.toUpperCase())) n = name + '_' + i++; name = n; }
      if (name) usedNames.add(name.toUpperCase());
      nets.push({ name, pins: [...grp.pins] });
    });

    // layout: the most-connected part (the controller) in the middle, its neighbours alternating left and right
    const deg = new Map(comps.map(c => [c.id, 0]));
    conns.forEach(k => { deg.set(k.a, deg.get(k.a) + 1); deg.set(k.b, deg.get(k.b) + 1); });
    const hub = comps.slice().sort((x, y) => (deg.get(y.id) - deg.get(x.id)) || ((y.kind === 'controller') - (x.kind === 'controller')))[0];
    const order = [hub], seen = new Set([hub.id]);
    for (let i = 0; i < order.length; i++){
      const cur = order[i];
      conns.forEach(k => { const o = k.a === cur.id ? k.b : (k.b === cur.id ? k.a : null); if (o && !seen.has(o)){ seen.add(o); order.push(byId.get(o)); } });
    }
    comps.forEach(c => { if (!seen.has(c.id)) order.push(c); });
    const parts = order.map((c, i) => {
      const slot = i === 0 ? { col: 1, row: 0 } : { col: i % 2 ? 0 : 2, row: Math.floor((i - 1) / 2) };
      const p = { ref: c.ref, part: c.partId, col: slot.col, row: slot.row, rot: 0 };
      if (c.value !== undefined) p.value = c.value;
      return p;
    });
    const warnings = generic.map(n => `“${n}” is not in the parts library, so it is a generic box with the pins MakeSpec listed.`);
    const expl = String(circuit.explanation || '').trim();
    return { title: String(circuit.title || 'MakeSpec circuit').slice(0, 80), newParts, parts, nets,
      _fromMakeSpec: true, notes: ((expl ? expl.slice(0, 500) + ' ' : '') + (warnings.length ? warnings.join(' ') : '')).trim(), _warnings: warnings };
  };

  /* pins MakeSpec left unconnected are unused on purpose (most of an ESP32's pins, say), so mark them no-connect instead of raising ERC errors */
  A.markUnusedPinsNC = () => {
    const nc = A.doc.nc = A.doc.nc || [];
    A.nets().forEach(n => { if (n.pins.length === 1 && !n.wires.length && !n.labels.length && !n.powerPins.length) nc.push({ id: A.id('q'), x: n.pins[0].x, y: n.pins[0].y }); });
    A.commit();
  };

  const valid = c => c && typeof c === 'object' && c.format === FORMAT && Array.isArray(c.components) && Array.isArray(c.connections);

  /* open a MakeSpec circuit as a new project */
  A.importMakeSpec = async (circuit) => {
    if (!valid(circuit)) throw new Error('That is not a MakeSpec circuit.');
    const spec = A.fromMakeSpec(circuit);
    A.projects.newProject(spec.title);
    const res = await A.buildFromSpec(spec, { replace: true });
    A.markUnusedPinsNC(); A.fit(); A.runCheck();
    const m = $('#msgs');
    if (m) m.insertAdjacentHTML('afterbegin', `<div class="msg ok">Imported “${esc(spec.title)}” from MakeSpec.${spec.notes ? ' ' + esc(spec.notes) : ''}</div>` + (res.warnings || []).map(w => `<div class="msg bad">${esc(w)}</div>`).join(''));
    A.toast('Imported from MakeSpec');
    return res;
  };

  A.importFromHash = async () => {
    const m = /^#makespec=([A-Za-z0-9_\-]+)$/.exec(location.hash);
    if (!m) return false;
    history.replaceState(null, '', location.pathname + location.search);
    try {
      const json = decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))));
      await A.importMakeSpec(JSON.parse(json));
    } catch (e) { A.toast('Could not open the MakeSpec circuit: ' + e.message, 4000); return false; }
    return true;
  };

  addEventListener('hashchange', () => { A.importFromHash(); });
  A.isMakeSpecCircuit = valid;
})();
