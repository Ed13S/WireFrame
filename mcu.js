/* WireFrame: Arduino-style sketches for the board parts (Uno, Nano, ESP32, Pico...), with a Serial Monitor.
   The sketch is C/C++-like text that is translated to JavaScript coroutines and run in step with the simulator clock. */
(function () {
  const A = window.App, $ = (s, r) => (r || document).querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const IDS = new Set(['ARDUINO_UNO', 'ARDUINO_NANO', 'ESP32_DEVKIT', 'ESP32_C3', 'PICO', 'STM32_BLUEPILL']);
  A.isMCU = inst => IDS.has(inst.def);
  const MC = A.mcu = { active: false, sk: {}, sel: null };
  const family = id => /UNO|NANO/.test(id) ? 'avr' : /ESP32/.test(id) ? 'esp' : id === 'PICO' ? 'pico' : 'stm';
  const BUILTIN = { ARDUINO_UNO: 13, ARDUINO_NANO: 13, ESP32_DEVKIT: 2, ESP32_C3: 8, PICO: 25, STM32_BLUEPILL: 45 };

  /* ---------- pin table ---------- */
  function pinTable(inst) { const d = A.def(inst.def), fam = family(inst.def), pins = [], byNum = {};
    d.pins.forEach((p, idx) => { const nm = String(p.name || '').toUpperCase(), toks = nm.split('/'); let role = 'nc', num = null;
      if (nm === 'GND') role = 'gnd'; else if (/^(5V|VBUS)$/.test(nm)) role = 'v5'; else if (/^(3V3|3\.3V)$/.test(nm)) role = 'v33'; else if (/^(VIN|VSYS|VBAT|EN|RESET|RST|RUN|AREF|3V3EN)$/.test(nm)) role = 'x';
      else toks.forEach(t => { let m; if ((m = /^D(\d+)$/.exec(t))) { num = +m[1]; role = 'gpio'; } else if ((m = /^A(\d+)$/.exec(t))) { num = 14 + +m[1]; role = 'gpio'; } else if ((m = /^GPIO(\d+)$/.exec(t)) || (m = /^GP(\d+)$/.exec(t))) { num = +m[1]; role = 'gpio'; } else if ((m = /^P([A-C])(\d+)$/.exec(t))) { num = (t.charCodeAt(1) - 65) * 16 + +m[2]; role = 'gpio'; } });
      const e = { idx, n: p.n, name: p.name, role, num, mode: 0, out: 0, pwm: -1, tone: 0 }; pins.push(e); if (num !== null && role === 'gpio') byNum[num] = e; });
    return { pins, byNum }; }
  /* ---------- the sim element ---------- */
  A.mcuFor = inst => { const sk = MC.sk[inst.id] || (MC.sk[inst.id] = newSketchState(inst)); return sk.hw; };
  function newSketchState(inst) { const t = pinTable(inst), fam = family(inst.def), vhigh = fam === 'avr' ? 5 : 3.3;
    const hw = { pins: t.pins, vhigh, level(pp) { const T = A.Sim.t; if (pp.tone > 0) return (T * pp.tone) % 1 < .5 ? vhigh : 0; if (pp.pwm >= 0) { const f = fam === 'avr' ? 490 : 1000; return ((T * f) % 1) < pp.pwm ? vhigh : 0; } return pp.out ? vhigh : 0; } };
    return { inst, hw, byNum: t.byNum, fam, virt: {}, serial: [], rx: [], gen: null, wake: 0, err: null, lastTx: -1, lastRx: -1, baud: 0, src: null }; }
  A.mcuLive = inst => { const sk = MC.sk[inst.id]; if (!sk) return {}; const T = A.Sim.t, led = BUILTIN[inst.def], pe = sk.byNum[led], L = pe ? (pe.pwm >= 0 ? pe.pwm > .1 : !!pe.out) : !!sk.virt[led]; return { L, TX: T - sk.lastTx < .06 && sk.lastTx >= 0, RX: T - sk.lastRx < .06 && sk.lastRx >= 0 }; };

  /* ---------- translate a sketch to JavaScript ---------- */
  const TYPES = '(?:unsigned\\s+)?(?:int|long|short|byte|word|char|bool|boolean|float|double|String|uint8_t|uint16_t|uint32_t|uint64_t|int8_t|int16_t|int32_t|int64_t|size_t)';
  const INTS = '(?:unsigned\\s+)?(?:int|long|short|byte|word|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t)';
  function matchParen(s, i) { let d = 0, q = null; for (let k = i; k < s.length; k++) { const c = s[k]; if (q) { if (c === '\\') k++; else if (c === q) q = null; continue; } if (c === '"' || c === "'") { q = c; continue; } if (c === '(') d++; else if (c === ')') { d--; if (!d) return k; } } return -1; }
  function stripComments(s) { let o = '', i = 0, q = null; while (i < s.length) { const c = s[i], n = s[i + 1]; if (q) { o += c; if (c === '\\') { o += n || ''; i += 2; continue; } if (c === q) q = null; i++; continue; } if (c === '"' || c === "'") { q = c; o += c; i++; continue; } if (c === '/' && n === '/') { while (i < s.length && s[i] !== '\n') i++; continue; } if (c === '/' && n === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; } o += c; i++; } return o; }
  function wrapCalls(code, names, builtins) { let out = code; const all = names.concat(builtins); all.forEach(nm => { const re = new RegExp('(^|[^\\w.$])' + nm + '\\s*\\(', 'g'); let m, res = '', last = 0; re.lastIndex = 0;
      while ((m = re.exec(out))) { const start = m.index + m[1].length; const before = out.slice(0, start); if (/function\*\s*$/.test(before)) continue; const open = out.indexOf('(', start); const close = matchParen(out, open); if (close < 0) break; res += out.slice(last, start) + '(yield* ' + out.slice(start, close + 1) + ')'; last = close + 1; re.lastIndex = close + 1; }
      out = res + out.slice(last); }); return out; }
  function addTicks(code) { let out = '', i = 0; const re = /\b(for|while|do)\b/g; let m, last = 0; while ((m = re.exec(code))) { let k = m.index + m[1].length; if (m[1] === 'do') { while (/\s/.test(code[k])) k++; if (code[k] === '{') { out += code.slice(last, k + 1) + ' yield* __tick();'; last = k + 1; re.lastIndex = k + 1; } continue; }
      while (/\s/.test(code[k])) k++; if (code[k] !== '(') continue; const close = matchParen(code, k); if (close < 0) continue; let j = close + 1; while (/\s/.test(code[j])) j++;
      if (code[j] === '{') { out += code.slice(last, j + 1) + ' yield* __tick();'; last = j + 1; re.lastIndex = j + 1; } else if (code[j] === ';' && m[1] === 'while') { out += code.slice(last, j) + '{ yield* __tick(); }'; last = j + 1; re.lastIndex = j + 1; } } return out + code.slice(last); }
  A.compileSketch = (src) => { let s = stripComments(src);
    s = s.replace(/^\s*#include[^\n]*$/gm, '').replace(/^\s*#define\s+(\w+)\s+([^\n]+)$/gm, 'const $1 = $2;').replace(/\bF\s*\(\s*("(?:[^"\\]|\\.)*")\s*\)/g, '$1');
    const fnames = []; s = s.replace(new RegExp('(^|[;}\\n])\\s*(?:static\\s+|inline\\s+)?(void|' + TYPES + ')\\s+(\\w+)\\s*\\(([^)]*)\\)\\s*\\{', 'g'), (m0, pre, ty, name, params) => { fnames.push(name); const ps = params.split(',').map(p => p.trim()).filter(p => p && p !== 'void').map(p => p.replace(/=.*$/, '').replace(/&/g, '').replace(/\[\]/g, '').trim().split(/\s+/).pop().replace(/^\*+/, '')).join(', '); return pre + '\nfunction* ' + name + '(' + ps + ') {'; });
    // integer declarations truncate; then plain declarations
    s = s.replace(new RegExp('\\b(?:const\\s+)?' + INTS + '\\s+(\\w+)\\s*=\\s*([^;,{}]+);', 'g'), (m0, n, v) => 'let ' + n + ' = Math.trunc(' + v + ');');
    s = s.replace(new RegExp('\\b(?:const\\s+)?(?:volatile\\s+)?' + TYPES + '\\s+(\\w+)\\s*\\[([^\\]]*)\\]\\s*=\\s*\\{([^}]*)\\}\\s*;', 'g'), 'let $1 = [$3];');
    s = s.replace(new RegExp('\\b(?:const\\s+)?(?:volatile\\s+)?' + TYPES + '\\s+(\\w+)\\s*\\[([^\\]]*)\\]\\s*;', 'g'), 'let $1 = new Array(Math.max(1, $2)).fill(0);');
    s = s.replace(new RegExp('\\b(?:const\\s+)?(?:volatile\\s+)?' + TYPES + '\\s+(\\w+)\\s*([=;,])', 'g'), (m0, n, t) => 'let ' + n + (t === ';' ? ' = 0;' : t === ',' ? ' = 0,' : ' ='));
    s = s.replace(/\(\s*(?:int|long|byte|short|unsigned\s+int|unsigned\s+long)\s*\)\s*(\w+(?:\.\w+)*(?:\([^()]*\))?)/g, 'Math.trunc($1)').replace(/\(\s*(?:float|double|char|bool)\s*\)\s*/g, '').replace(/\.length\(\)/g, '.length').replace(/\bunsigned\b/g, '');
    s = addTicks(s); s = wrapCalls(s, fnames, ['delay', 'delayMicroseconds', 'yieldNow']);
    return { code: s, fnames }; };
  const CONSTS = ['HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'LED_BUILTIN', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'PI', 'DEC', 'HEX', 'BIN', 'OCT', 'SDA', 'SCL', 'TX', 'RX', 'LSBFIRST', 'MSBFIRST', 'RISING', 'FALLING', 'CHANGE'];
  function instantiate(sk) { const inst = sk.inst, T = () => A.Sim.t, fam = sk.fam, vh = sk.hw.vhigh, adcMax = fam === 'esp' || fam === 'stm' ? 4095 : 1023;
    const pin = n => sk.byNum[n | 0], nodeV = pe => { const nd = A.Sim.els.find(e => e.inst === inst); return nd ? A.Sim.v[nd.n[pe.idx]] : 0; };
    const fmt = (v, b) => { if (typeof v === 'number') { if (b === 16 || b === 'HEX') return Math.trunc(v).toString(16).toUpperCase(); if (b === 2 || b === 'BIN') return Math.trunc(v).toString(2); if (b === 8) return Math.trunc(v).toString(8); if (!Number.isInteger(v)) return v.toFixed(typeof b === 'number' && b >= 0 && b < 10 && b !== 16 && b !== 8 && b !== 2 ? b : 2); } return String(v); };
    const put = (txt) => { sk.lastTx = T(); sk.serial.push(txt); MC.dirty = true; };
    const Serial = { begin: b => { sk.baud = b; }, print: (v, b) => put(fmt(v, b)), println: (v, b) => put((v === undefined ? '' : fmt(v, b)) + '\n'), write: v => put(typeof v === 'number' ? String.fromCharCode(v) : String(v)), printf: (f, ...a) => { let i = 0; put(String(f).replace(/%[-+0 #]*\d*(?:\.\d+)?[dilufsxXc%]/g, m => m === '%%' ? '%' : fmt(a[i++]))); }, flush() { }, available: () => sk.rx.length, read: () => sk.rx.length ? sk.rx.shift() : -1, parseInt: () => { const t = sk.rx.splice(0).map(c => String.fromCharCode(c)).join(''); return parseInt(t) || 0; }, readString: () => sk.rx.splice(0).map(c => String.fromCharCode(c)).join(''), setTimeout() { } };
    let seed = 1; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const rt = { HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, LED_BUILTIN: BUILTIN[inst.def], PI: Math.PI, DEC: 10, HEX: 16, BIN: 2, OCT: 8, SDA: 18, SCL: 19, TX: 1, RX: 3, LSBFIRST: 0, MSBFIRST: 1, RISING: 1, FALLING: 2, CHANGE: 3, Serial,
      pinMode: (p, m) => { const e = pin(p); if (e) { e.mode = m === 1 ? 1 : m === 2 ? 2 : 0; e.pwm = -1; e.tone = 0; } else sk.virt[p] = sk.virt[p] || 0; },
      digitalWrite: (p, v) => { const e = pin(p); if (e) { e.out = v ? 1 : 0; e.pwm = -1; if (e.mode === 0) e.mode = e.mode; if (e.mode === 2) e.mode = 2; } else sk.virt[p] = v ? 1 : 0; },
      digitalRead: p => { const e = pin(p); if (!e) return 0; if (e.mode === 1) return e.out ? 1 : 0; return nodeV(e) > vh * .5 ? 1 : 0; },
      analogRead: p => { p = p | 0; if (fam === 'avr' && p < 8) p += 14; const e = pin(p); if (!e) return 0; const v = Math.max(0, Math.min(vh, nodeV(e))); return Math.round(v / vh * adcMax); },
      analogWrite: (p, v) => { const e = pin(p); if (e) { e.mode = 1; e.pwm = Math.max(0, Math.min(255, v)) / 255; e.tone = 0; } else sk.virt[p] = v > 0 ? 1 : 0; }, analogReadResolution() { }, analogWriteResolution() { },
      ledcSetup: () => 0, ledcAttachPin: (p, ch) => { sk.ledc = sk.ledc || {}; sk.ledc[ch] = p; const e = pin(p); if (e) e.mode = 1; }, ledcWrite: (ch, v) => { const p = sk.ledc && sk.ledc[ch] !== undefined ? sk.ledc[ch] : ch, e = pin(p); if (e) { e.pwm = Math.max(0, Math.min(255, v)) / 255; } },
      tone: (p, f) => { const e = pin(p); if (e) { e.mode = 1; e.tone = f; } }, noTone: p => { const e = pin(p); if (e) e.tone = 0; },
      millis: () => Math.floor(T() * 1000), micros: () => Math.floor(T() * 1e6), random: (a, b) => b === undefined ? Math.floor(rnd() * a) : a + Math.floor(rnd() * (b - a)), randomSeed: s => { seed = (s | 0) || 1; },
      map: (x, a, b, c, d) => Math.trunc((x - a) * (d - c) / (b - a) + c), constrain: (x, a, b) => Math.min(b, Math.max(a, x)), min: Math.min, max: Math.max, abs: Math.abs, sqrt: Math.sqrt, pow: Math.pow, sin: Math.sin, cos: Math.cos, tan: Math.tan, floor: Math.floor, ceil: Math.ceil, round: Math.round, log: Math.log, exp: Math.exp, atan2: Math.atan2, sq: x => x * x, isnan: Number.isNaN, lowByte: x => x & 255, highByte: x => (x >> 8) & 255, bitRead: (x, b) => (x >> b) & 1, bitWrite: (x, b, v) => v ? x | (1 << b) : x & ~(1 << b), bit: b => 1 << b, F: s => s, String: v => String(v), int: v => Math.trunc(v), float: v => +v, byte: v => v & 255, char: v => String.fromCharCode(v),
      attachInterrupt() { }, detachInterrupt() { }, digitalPinToInterrupt: p => p, yield: () => { }, noInterrupts() { }, interrupts() { },
      *delay(ms) { yield Math.max(0, ms) * 1000; }, *delayMicroseconds(us) { yield Math.max(0, us); }, *__tick() { yield 3; } };
    for (let i = 0; i < 8; i++) rt['A' + i] = 14 + i; ['PA', 'PB', 'PC'].forEach((P, k) => { for (let b = 0; b < 16; b++) rt[P + b] = k * 16 + b; });
    const c = A.compileSketch(A.doc.code && A.doc.code[inst.id] || ''); const names = Object.keys(rt);
    const factory = new Function(...names, c.code + '\n;return { setup: typeof setup === "function" ? setup : null, loop: typeof loop === "function" ? loop : null };');
    return factory(...names.map(n => rt[n])); }
  function* run(prog) { if (prog.setup) yield* prog.setup(); if (!prog.loop) return; for (;;) { yield* prog.loop(); yield 1; } }

  MC.start = () => { MC.stop(true); MC.active = false; const mcus = A.doc.parts.filter(A.isMCU); if (!mcus.length) return;
    mcus.forEach(inst => { const sk = MC.sk[inst.id] || (MC.sk[inst.id] = newSketchState(inst)); sk.serial = []; sk.rx = []; sk.err = null; sk.wake = 0; sk.lastTx = sk.lastRx = -1; sk.hw.pins.forEach(p => { p.mode = 0; p.out = 0; p.pwm = -1; p.tone = 0; }); sk.virt = {};
      try { sk.prog = instantiate(sk); sk.gen = run(sk.prog); } catch (e) { sk.err = 'Sketch error: ' + e.message; sk.gen = null; sk.serial.push(sk.err + '\n'); } });
    MC.active = true; MC.dirty = true; MC.render(); };
  MC.stop = (quiet) => { MC.active = false; Object.values(MC.sk).forEach(sk => { sk.gen = null; sk.hw && sk.hw.pins.forEach(p => { p.mode = 0; p.out = 0; p.pwm = -1; p.tone = 0; }); }); if (!quiet) MC.render(); };
  MC.tick = () => { const T = A.Sim.t; Object.values(MC.sk).forEach(sk => { if (!sk.gen) return; let n = 0; if (sk.wake < T - .005) sk.wake = T - .005;
      while (sk.gen && sk.wake <= T && n++ < 4000) { let r; try { r = sk.gen.next(); } catch (e) { sk.serial.push('Runtime error: ' + e.message + '\n'); sk.err = e.message; sk.gen = null; MC.dirty = true; break; } if (r.done) { sk.gen = null; sk.serial.push('(sketch finished)\n'); MC.dirty = true; break; } sk.wake += (+r.value || 0) * 1e-6; } }); };
  const run0 = A.Sim.run; A.Sim.run = function (sec) { if (!MC.active) return run0.call(this, sec); let left = sec; while (left > 1e-9) { const c = Math.min(.0004, left); run0.call(this, c); left -= c; MC.tick(); } };

  /* ---------- sketches shown to students ---------- */
  const TEMPL = { 'Blink': `// Blink the on-board LED\nvoid setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  Serial.println("LED on");\n  delay(500);\n  digitalWrite(LED_BUILTIN, LOW);\n  Serial.println("LED off");\n  delay(500);\n}\n`,
    'Button controls LED': `const int BUTTON = 2;\nconst int LED = 13;\n\nvoid setup() {\n  pinMode(BUTTON, INPUT_PULLUP);   // button joins pin 2 to GND\n  pinMode(LED, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int pressed = (digitalRead(BUTTON) == LOW);\n  digitalWrite(LED, pressed);\n  Serial.print("pressed = ");\n  Serial.println(pressed);\n  delay(100);\n}\n`,
    'Read a sensor (analog)': `void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int raw = analogRead(A0);\n  float volts = raw * 5.0 / 1023.0;\n  Serial.print("A0 = ");\n  Serial.print(raw);\n  Serial.print("  (");\n  Serial.print(volts);\n  Serial.println(" V)");\n  delay(250);\n}\n`,
    'Fade an LED (PWM)': `const int LED = 9;\n\nvoid setup() {\n  pinMode(LED, OUTPUT);\n}\n\nvoid loop() {\n  for (int b = 0; b <= 255; b += 5) {\n    analogWrite(LED, b);\n    delay(20);\n  }\n  for (int b = 255; b >= 0; b -= 5) {\n    analogWrite(LED, b);\n    delay(20);\n  }\n}\n`,
    'Hello Serial': `void setup() {\n  Serial.begin(115200);\n  Serial.println("Hello from WireFrame!");\n}\n\nint count = 0;\n\nvoid loop() {\n  count++;\n  Serial.print("count = ");\n  Serial.println(count);\n  delay(1000);\n}\n` };
  A.sketchTemplates = TEMPL;

  /* ---------- panel ---------- */
  const panel = document.createElement('div'); panel.id = 'codePanel'; panel.hidden = true; $('#stage').appendChild(panel);
  panel.innerHTML = `<div class="cp-head"><b>Code &amp; Serial Monitor</b><select id="cpBoard" aria-label="Board"></select><select id="cpTpl" aria-label="Example sketch"><option value="">Example sketches…</option>${Object.keys(TEMPL).map(k => `<option>${esc(k)}</option>`).join('')}</select><span class="grow"></span><button id="cpClose" class="small">Close</button></div>
    <div class="cp-body"><div class="cp-col"><div class="cp-sub">Sketch (Arduino C/C++ style) <span class="muted">· press Reset to run changes</span></div><textarea id="cpCode" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea></div>
    <div class="cp-col"><div class="cp-sub">Serial Monitor <button id="cpClear" class="small">Clear</button></div><pre id="cpOut" aria-live="off"></pre><div class="cp-send"><input id="cpIn" placeholder="Send to the board…" autocomplete="off"><button id="cpSend" class="small">Send</button></div></div></div>`;
  const sel = () => { const id = $('#cpBoard').value; return A.doc.parts.find(p => p.id === id); };
  MC.fill = () => { const sb = $('#cpBoard'), mcus = A.doc.parts.filter(A.isMCU); const cur = sb.value; sb.innerHTML = mcus.map(p => `<option value="${p.id}">${esc(p.ref)} · ${esc(A.def(p.def).name)}</option>`).join(''); if (mcus.find(p => p.id === cur)) sb.value = cur; MC.load(); };
  MC.load = () => { const p = sel(); if (!p) { $('#cpCode').value = ''; return; } A.doc.code = A.doc.code || {}; if (A.doc.code[p.id] === undefined) A.doc.code[p.id] = TEMPL.Blink; $('#cpCode').value = A.doc.code[p.id]; MC.dirty = true; MC.render(); };
  MC.render = () => { const p = sel(), sk = p && MC.sk[p.id], o = $('#cpOut'); if (!o) return; const txt = sk ? sk.serial.join('') : ''; if (o.textContent !== txt) { const bottom = o.scrollTop + o.clientHeight >= o.scrollHeight - 8; o.textContent = txt.slice(-20000); if (bottom) o.scrollTop = o.scrollHeight; } MC.dirty = false; };
  setInterval(() => { if (MC.dirty && !panel.hidden) MC.render(); }, 120);
  $('#cpBoard').onchange = MC.load; $('#cpClose').onclick = () => { panel.hidden = true; };
  $('#cpCode').oninput = e => { const p = sel(); if (p) { A.doc.code[p.id] = e.target.value; A.autosave(); } };
  $('#cpCode').onkeydown = e => { e.stopPropagation(); if (e.key === 'Tab') { e.preventDefault(); const t = e.target, s = t.selectionStart; t.value = t.value.slice(0, s) + '  ' + t.value.slice(t.selectionEnd); t.selectionStart = t.selectionEnd = s + 2; t.oninput(e); } };
  $('#cpTpl').onchange = e => { const p = sel(), t = TEMPL[e.target.value]; if (p && t) { A.doc.code[p.id] = t; $('#cpCode').value = t; A.autosave(); } e.target.value = ''; };
  $('#cpClear').onclick = () => { const p = sel(), sk = p && MC.sk[p.id]; if (sk) { sk.serial = []; MC.render(); } };
  const send = () => { const p = sel(), sk = p && MC.sk[p.id], i = $('#cpIn'); if (!sk || !i.value) return; for (const ch of i.value + '\n') sk.rx.push(ch.charCodeAt(0)); sk.lastRx = A.Sim.t; sk.serial.push('> ' + i.value + '\n'); i.value = ''; MC.dirty = true; };
  $('#cpSend').onclick = send; $('#cpIn').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') send(); };
  A.codePanel = (show) => { if (!A.doc.parts.some(A.isMCU)) { A.toast('Add a board (Arduino Uno, ESP32…) from the MCU category first'); return; } MC.fill(); panel.hidden = show === false ? true : !panel.hidden && show !== true ? true : false; if (!panel.hidden) MC.render(); };
  const sb = document.createElement('button'); sb.id = 'bCode'; sb.className = 'small'; sb.textContent = '⌨ Code & Serial'; sb.title = 'Write the sketch and open the Serial Monitor'; $('#status .grow').after(sb); sb.onclick = () => A.codePanel();
  A.on(w => { if (!panel.hidden && (w === 'load' || w === 'change')) { const cur = $('#cpBoard').value; if (!A.doc.parts.some(A.isMCU)) panel.hidden = true; else { const ids = A.doc.parts.filter(A.isMCU).map(p => p.id).join(); if (ids !== MC._ids) { MC._ids = ids; MC.fill(); } } } });
})();
