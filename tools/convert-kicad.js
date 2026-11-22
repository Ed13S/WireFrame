#!/usr/bin/env node
/* Converts KiCad legacy symbol libraries (.lib + .dcm) into the JSON used by Schematic Studio.
   usage: node convert-kicad.js <dir-with-.lib-files> <out-dir>
   Units: 100 mil = 2 grid units (so 50 mil = 1 grid unit). Y axis is flipped (KiCad is Y-up). */
const fs = require('fs'), path = require('path');
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('usage: node convert-kicad.js <src> <out>'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
const q = v => Math.round(v / 50 * 2) / 2;              // mil -> grid units, snapped to 0.5
const tok = line => { const t = []; line.replace(/"([^"]*)"|(\S+)/g, (m, a, b) => t.push(a !== undefined ? a : b)); return t; };

function parseDcm(file) {
  const m = {}; if (!fs.existsSync(file)) return m; let cur = null;
  for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (l.startsWith('$CMP ')) cur = m[l.slice(5).trim()] = { d: '', k: '' };
    else if (cur && l.startsWith('D ')) cur.d = l.slice(2).trim();
    else if (cur && l.startsWith('K ')) cur.k = l.slice(2).trim();
    else if (l.startsWith('$ENDCMP')) cur = null;
  }
  return m;
}
function arcPath(t) {
  const cx = +t[1], cy = +t[2], r = +t[3], a0 = +t[4], a1 = +t[5];
  const sx = +t[10], sy = +t[11], ex = +t[12], ey = +t[13];
  let d = ((a1 - a0) % 3600 + 3600) % 3600; if (d === 0) d = 3600;
  if (isNaN(sx)) return null;
  return `M${q(sx)} ${-q(sy)}A${q(r)} ${q(r)} 0 ${d > 1800 ? 1 : 0} 0 ${q(ex)} ${-q(ey)}`;
}
function parseSym(block, dcm) {
  const lines = block.split(/\r?\n/); const def = tok(lines[0]);
  const name = def[1].replace(/^~/, ''), isPower = def[def.length - 1] === 'P';
  const nameOff = +def[4], showNum = def[5] === 'Y', showName = def[6] === 'Y';
  let ref = 'U', value = name, aliases = [], pins = [], draw = [], inDraw = false, fp = '';
  for (const l of lines.slice(1)) {
    if (l.startsWith('F0 ')) ref = tok(l)[1].replace(/^#/, '') || 'U';
    else if (l.startsWith('F1 ')) value = tok(l)[1] || name;
    else if (l.startsWith('F2 ')) fp = tok(l)[1] || '';
    else if (l.startsWith('ALIAS ')) aliases = l.slice(6).trim().split(/\s+/);
    else if (l === 'DRAW') inDraw = true; else if (l === 'ENDDRAW') inDraw = false;
    else if (inDraw) {
      const t = tok(l), k = t[0];
      const unit = k === 'X' ? +t[9] : (k === 'P' ? +t[2] : k === 'S' ? +t[5] : k === 'C' ? +t[4] : k === 'A' ? +t[6] : +t[6]);
      const conv = k === 'X' ? +t[10] : (k === 'P' ? +t[3] : k === 'S' ? +t[6] : k === 'C' ? +t[5] : k === 'A' ? +t[7] : +t[7]);
      if ((unit && unit !== 1) || (conv && conv !== 1)) continue;       // first unit, normal body only
      if (k === 'X') {
        const [, pname, num, x, y, len, dir, , , , , , shape] = t; const sh = t[12] || '';
        if (sh.startsWith('N')) continue;                                // invisible pin
        const px = q(+x), py = -q(+y), L = q(+len);
        const dx = dir === 'R' ? L : dir === 'L' ? -L : 0, dy = dir === 'U' ? -L : dir === 'D' ? L : 0;
        const nm = pname === '~' ? '' : pname.replace(/^~/, '');
        pins.push({ n: num, name: nm, x: px, y: py, d: dir });
        draw.push({ t: 'l', p: [px, py, px + dx, py + dy] });
        if (nm && showName) {
          const off = nameOff ? Math.max(.8, q(nameOff)) : .8, tx = px + dx + (dir === 'R' ? off : dir === 'L' ? -off : 0), ty = py + dy + (dir === 'U' ? -off : dir === 'D' ? off : 0);
          if (dir === 'R') draw.push({ t: 'x', p: [tx, ty], s: nm, a: 's', z: .9 });
          else if (dir === 'L') draw.push({ t: 'x', p: [tx, ty], s: nm, a: 'e', z: .9 });
          else draw.push({ t: 'x', p: [tx, ty], s: nm, a: dir === 'U' ? 's' : 'e', z: .9, r: 90 });
        }
      } else if (k === 'P') {
        const n = +t[1], pts = []; for (let i = 0; i < n; i++) pts.push(q(+t[5 + i * 2]), -q(+t[6 + i * 2]));
        const f = t[5 + n * 2]; draw.push({ t: 'p', p: pts, f: f === 'F' ? 1 : f === 'f' ? 2 : 0, o: n > 2 && pts[0] === pts[pts.length - 2] && pts[1] === pts[pts.length - 1] ? 0 : 1 });
      } else if (k === 'S') {
        const x1 = q(+t[1]), y1 = -q(+t[2]), x2 = q(+t[3]), y2 = -q(+t[4]), f = t[8];
        draw.push({ t: 'r', p: [Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)], f: f === 'F' ? 1 : f === 'f' ? 2 : 0 });
      } else if (k === 'C') { const f = t[8]; draw.push({ t: 'c', p: [q(+t[1]), -q(+t[2]), q(+t[3])], f: f === 'F' ? 1 : f === 'f' ? 2 : 0 }); }
      else if (k === 'A') { const d = arcPath(t); if (d) draw.push({ t: 'd', d, f: t[9] === 'F' ? 1 : t[9] === 'f' ? 2 : 0 }); }
      else if (k === 'T') { if (t[5] !== '0' && t[5] !== undefined && t[5] !== '0') { } const s = (t[8] || '').replace(/~/g, ' '); if (s && t[4] !== undefined) draw.push({ t: 'x', p: [q(+t[2]), -q(+t[3])], s, a: 'm', z: Math.max(.7, Math.min(1.4, q(+t[4]) / 1.2)), r: t[1] === '900' ? 90 : 0 }); }
    }
  }
  return { name, ref, value, aliases, pins, draw, isPower, fp };
}

const files = fs.readdirSync(src).filter(f => f.endsWith('.lib')).sort();
const index = [], names = [];
for (const f of files) {
  const lib = f.replace(/\.lib$/, ''), dcm = parseDcm(path.join(src, lib + '.dcm'));
  const text = fs.readFileSync(path.join(src, f), 'utf8'); const parts = [];
  const blocks = text.split(/^DEF /m).slice(1);
  for (const b of blocks) {
    const body = 'DEF ' + b.split(/^ENDDEF/m)[0];
    let s; try { s = parseSym(body, dcm); } catch (e) { continue; }
    if (!s.pins.length && !s.draw.length) continue;
    const mk = (nm) => ({ id: lib + ':' + nm, name: nm, lib, ref: s.ref, value: nm === s.name ? s.value : nm, desc: (dcm[nm] || dcm[s.name] || {}).d || '', kw: (dcm[nm] || dcm[s.name] || {}).k || '', pins: s.pins.map(({ n, name, x, y }) => ({ n, name, x, y })), draw: s.draw, power: s.isPower || undefined });
    parts.push(mk(s.name)); s.aliases.forEach(a => { const m = mk(a); parts.push({ id: m.id, name: a, lib, of: s.name, value: m.value, desc: m.desc, kw: m.kw }); });
  }
  if (!parts.length) continue;
  // compact: draw shared between aliases is duplicated; store as-is but drop empty fields
  const clean = parts.map(p => { if (!p.desc) delete p.desc; if (!p.kw) delete p.kw; return p; });
  fs.writeFileSync(path.join(out, lib + '.json'), JSON.stringify(clean));
  index.push({ lib, count: clean.length });
  clean.forEach(p => names.push([lib, p.name, (p.desc || '').slice(0, 70), (p.kw || '').slice(0, 40)]));
  process.stdout.write(lib + ' ' + clean.length + '\n');
}
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify({ libs: index, parts: names }));
console.log('libraries:', index.length, 'symbols:', names.length);
