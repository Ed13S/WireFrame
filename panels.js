/* Library panel, file menu, theme, checks. */
(function () {
  const A = window.App, S = A.S, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const L = A.L = { cat: 'All', q: '', lib: '', limit: 150 };
  const ORDER = ['Passive', 'Semiconductor', 'Source', 'Electromechanical', 'Power', 'Logic', 'Analog', 'Analog IC', 'Digital IC', 'MCU', 'Sensor', 'Display', 'Module', 'Connector'];
  const hay = d => (d.name + ' ' + (d.desc || '') + ' ' + (d.kw || '') + ' ' + (d.id || '') + ' ' + (d.cat || '')).toLowerCase();

  function renderCats() {
    const have = new Set(Object.values(A.LIB).filter(d => d.builtin).map(d => d.cat)); const cats = ['All', ...ORDER.filter(c => have.has(c)), 'My parts', 'KiCad library'];
    $('#cats').innerHTML = cats.map(c => `<button class="chip${L.cat === c ? ' on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  }
  const item = (d, thumb) => `<div class="pi" role="option" data-id="${esc(d.id)}" title="${esc(d.desc || d.name)}">${thumb ? A.thumb(d) : '<svg viewBox="0 0 10 7"><rect x="1" y="1" width="8" height="5" fill="none" stroke="var(--muted)" stroke-width=".3" stroke-dasharray=".8 .6"/></svg>'}<span>${esc(d.name)}<small>${esc(d.desc || d.cat || d.lib || '')}</small></span></div>`;
  let token = 0;
  async function renderList() {
    const my = ++token, box = $('#partList'), q = L.q.trim().toLowerCase(); let html = '';
    const tools = L.cat === 'KiCad library' ? `<div class="row" style="margin:0 0 6px"><select id="libSel" aria-label="KiCad library"><option value="">All libraries (search)</option>${(A.kicadIndex ? A.kicadIndex.libs : []).map(l => `<option value="${esc(l.lib)}"${L.lib === l.lib ? ' selected' : ''}>${esc(l.lib)} (${l.count})</option>`).join('')}</select></div>` : '';
    const local = Object.values(A.LIB).filter(d => !d.kicad && (L.cat === 'All' || (L.cat === 'My parts' ? d.custom : d.cat === L.cat)) && (!q || q.split(/\s+/).every(w => hay(d).includes(w))));
    if (L.cat !== 'KiCad library') { html += local.map(d => item(d, true)).join(''); if (!local.length && L.cat !== 'All') html += `<p class="muted">${L.cat === 'My parts' ? 'No parts yet. Use “+ New part” or the AI Assistant to make one.' : 'No matches.'}</p>`; }
    box.innerHTML = tools + html;
    if (L.cat === 'KiCad library' || (L.cat === 'All' && q.length >= 2)) {
      try { await A.loadKicadIndex(); } catch (e) { if (my === token) box.insertAdjacentHTML('beforeend', `<p class="muted">The KiCad library loads from the <code>lib/</code> folder, so it needs the page served over http(s) (GitHub Pages or the Mac app), not opened as a file.</p>`); return; }
      if (my !== token) return; const sel = $('#libSel'); if (sel && sel.options.length < 2) { renderList(); return; }
      let out = '', n = 0; const words = q.split(/\s+/).filter(Boolean);
      if (L.cat === 'KiCad library' && L.lib) { const arr = await A.loadKicadLib(L.lib); if (my !== token) return;
        const m = arr.filter(d => !q || words.every(w => hay(d).includes(w))); out = m.slice(0, L.limit).map(d => item(d, true)).join(''); n = m.length;
        if (n > L.limit) out += `<button id="more" class="small">Show more (${n - L.limit} left)</button>`; }
      else if (q) { const lim = L.cat === 'All' ? 40 : 150; const m = []; for (const [lib, name, desc, kw] of A.kicadIndex.parts) { const h = (name + ' ' + desc + ' ' + kw + ' ' + lib).toLowerCase(); if (words.every(w => h.includes(w))) { m.push({ id: lib + ':' + name, name, desc: desc || lib, lib }); if (m.length > lim * 3) break; } }
        m.sort((a, b) => (a.name.toLowerCase() === q ? -1 : 0) - (b.name.toLowerCase() === q ? -1 : 0) || a.name.length - b.name.length);
        out = (L.cat === 'All' ? '<p class="muted" style="margin:6px 2px">From the KiCad library</p>' : '') + m.slice(0, lim).map(d => item(d, false)).join(''); n = m.length; }
      else out = '<p class="muted">Pick a library above, or type to search all 17,000 KiCad symbols (for example “lm317” or “h-bridge”).</p>';
      box.insertAdjacentHTML('beforeend', out || '<p class="muted">No matches.</p>');
    }
    if (S.placing) $$('.pi', box).forEach(e => e.classList.toggle('on', e.dataset.id === S.placing));
  }
  A.refreshLib = () => { renderCats(); renderList(); };
  $('#cats').onclick = e => { const b = e.target.closest('[data-cat]'); if (!b) return; L.cat = b.dataset.cat; L.limit = 150; renderCats(); renderList(); };
  let qt; $('#q').oninput = e => { L.q = e.target.value; L.limit = 150; clearTimeout(qt); qt = setTimeout(renderList, 120); };
  $('#partList').onclick = e => { if (e.target.id === 'more') { L.limit += 150; renderList(); return; } const it = e.target.closest('.pi'); if (it) A.startPlacing(it.dataset.id); };
  $('#partList').onchange = e => { if (e.target.id === 'libSel') { L.lib = e.target.value; L.limit = 150; renderList(); } };

  /* ---------- file helpers ---------- */
  A.download = (name, data, type) => { const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  const base = () => (A.doc.meta.title || 'schematic').replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'schematic';
  A.saveFile = () => { A.download(base() + '.schematic.json', JSON.stringify(A.exportDoc(), null, 1), 'application/json'); A.toast('Saved ' + base() + '.schematic.json'); };
  A.openText = (text, name) => { try { const o = JSON.parse(text);
      if (Array.isArray(o) || (o.pins && o.draw)) { const arr = Array.isArray(o) ? o : [o]; arr.forEach(p => { if (p.pins && p.draw) A.addCustom(p); }); A.refreshLib(); A.toast('Imported ' + arr.length + ' part(s) into My parts'); return; }
      A.importDoc(o); A.toast('Opened ' + (name || 'sheet')); } catch (e) { A.toast('That file is not a WireFrame sheet'); } };
  async function toPNG(scale) { const svg = A.exportSVG({ tight: true }); const img = new Image(); const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; }); const c = document.createElement('canvas'); c.width = img.width * scale / 1; c.height = img.height * scale; const x = c.getContext('2d'); x.scale(scale, scale); x.drawImage(img, 0, 0);
    return new Promise(r => c.toBlob(r, 'image/png')); }
  const acts = {
    new() { if (A.doc.parts.length && !confirm('Start a new sheet? Unsaved changes will be lost (your parts library is kept).')) return; A.doc = A.newDoc(); A.hist = []; A.fut = []; A.commit(); A.emit('load'); },
    open() { $('#fileIn').click(); }, save() { A.saveFile(); },
    async png() { try { A.download(base() + '.png', await toPNG(2), 'image/png'); } catch (e) { A.toast('PNG export failed in this browser; try SVG'); } },
    async copyimg() { try { const b = await toPNG(2); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); A.toast('Copied picture to clipboard'); } catch (e) { A.toast('Clipboard blocked here; use Export PNG'); } },
    async copysvg() { try { await navigator.clipboard.writeText(A.exportSVG({ tight: true })); A.toast('Copied SVG to clipboard'); } catch (e) { A.toast('Clipboard blocked here; use Export SVG'); } },
    svg() { A.download(base() + '.svg', A.exportSVG({ tight: true }), 'image/svg+xml'); },
    net() { A.download(base() + '-netlist.txt', A.netlistText()); },
    libexp() { if (!A.custom.length) return A.toast('You have no custom parts yet'); A.download('my-parts.json', JSON.stringify(A.custom, null, 1), 'application/json'); },
    libimp() { $('#fileIn').dataset.mode = 'lib'; $('#fileIn').click(); },
    example() { A.examplesDialog && A.examplesDialog(); }
  };
  $('#fileIn').accept = '.json,.kicad_sym,application/json';
  $('#fileIn').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const t = await f.text();
    if (/\.kicad_sym$/i.test(f.name)) { if (A.importKicadSym) A.importKicadSym(t, f.name); else A.toast('KiCad import is not available'); } else A.openText(t, f.name); };
  const menu = $('#fileMenu'); $('#bFile').onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', () => menu.hidden = true);
  menu.onclick = e => { const b = e.target.closest('[data-act]'); if (b) { menu.hidden = true; acts[b.dataset.act](); } };
  addEventListener('dragover', e => e.preventDefault()); addEventListener('drop', async e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (!f) return; const t = await f.text(); /\.kicad_sym$/i.test(f.name) ? A.importKicadSym && A.importKicadSym(t, f.name) : A.openText(t, f.name); });

  /* ---------- theme ---------- */
  const themes = ['dark', 'light', 'auto']; let th = 'dark'; try { th = localStorage.getItem('ss_theme') || 'dark'; } catch (e) {}
  const applyTheme = () => { if (th === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = th; $('#bTheme').textContent = 'Theme: ' + th; try { localStorage.setItem('ss_theme', th); } catch (e) {} };
  $('#bTheme').onclick = () => { th = themes[(themes.indexOf(th) + 1) % 3]; applyTheme(); }; applyTheme();

  /* ---------- checks ---------- */
  A.runCheck = () => { const r = A.erc(), box = $('#msgs'); S.marks = r.map(x => ({ x: x.x, y: x.y }));
    box.innerHTML = r.length ? r.map((m, i) => `<div class="msg bad" data-i="${i}">${esc(m.text)}</div>`).join('') : '<div class="msg ok">No problems found. Every pin is connected and every reference is unique.</div>';
    box.querySelectorAll('.msg.bad').forEach(el => el.onclick = () => { const m = r[+el.dataset.i], v = S.view, rect = $('#svg').getBoundingClientRect(); v.tx = rect.width / 2 - m.x * v.sc; v.ty = rect.height / 2 - m.y * v.sc; A.applyView(); A.render(); });
    A.render(); };
  $('#bERC').onclick = A.runCheck; $('#bExamples').onclick = () => A.examplesDialog && A.examplesDialog();
  $('#bNewPart').onclick = () => A.newPartDialog && A.newPartDialog();
  renderCats(); renderList();
})();
