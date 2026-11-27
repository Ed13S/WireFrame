/* WireFrame: footprint library browser. Loads fplib.js (KiCad footprint names) the first time it is opened. */
(() => {
  const A = window.App, $ = (s, r) => (r || document).querySelector(s), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const load = () => window.FPLIB ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'fplib.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load the footprint list')); document.head.appendChild(s); });
  A.fpPicker = async (cur, cb, inst) => {
    const host = $('#modalHost'); host.innerHTML = '<div class="back"><div class="modal" style="width:min(720px,100%)"><header><b>Footprint library</b></header><div class="mb">Loading…</div></div></div>';
    try { await load(); } catch (e) { host.innerHTML = ''; A.toast(e.message); return; }
    const libs = Object.keys(window.FPLIB), d = inst && A.def(inst.def), pins = d ? d.pins.length : 0;
    host.innerHTML = `<div class="back"><div class="modal" style="width:min(760px,100%)"><header><b>Footprint library</b> <span class="note">${libs.length} libraries, ${libs.reduce((n, l) => n + FPLIB[l].split('|').length, 0)} footprints (KiCad)</span></header>
      <div class="mb"><div class="row"><input id="fpQ" placeholder="Search e.g. DIP-8, 0805, TO-92, SOIC-16, PinHeader 1x04" style="flex:1" value=""><select id="fpL"><option value="">All libraries</option>${libs.map(l => `<option>${esc(l)}</option>`).join('')}</select></div>
      <div id="fpN" class="note" style="margin:6px 0"></div><div id="fpR" style="max-height:48vh;overflow:auto;border:1px solid var(--line,#8884);border-radius:6px"></div></div>
      <footer><button id="fpNo">Close</button></footer></div></div>`;
    const all = []; libs.forEach(l => FPLIB[l].split('|').forEach(n => all.push([l, n, (l + ' ' + n).toLowerCase()])));
    const q = $('#fpQ'), sel = $('#fpL'), out = $('#fpR');
    const draw = () => { const w = q.value.toLowerCase().split(/[\s]+/).filter(Boolean), lib = sel.value; const hit = []; for (const r of all) { if (lib && r[0] !== lib) continue; if (w.every(x => r[2].includes(x))) { hit.push(r); if (hit.length > 300) break; } }
      $('#fpN').textContent = (hit.length > 300 ? 'Showing the first 300 matches. ' : hit.length + ' match' + (hit.length === 1 ? '' : 'es') + '. ') + (pins ? 'This part has ' + pins + ' pins.' : '');
      out.innerHTML = hit.map(r => { const id = r[0] + ':' + r[1]; return `<div class="fpi" data-id="${esc(id)}" style="padding:5px 9px;cursor:pointer;${id === cur ? 'background:#b4ff0030;' : ''}"><b>${esc(r[1])}</b> <span class="note">${esc(r[0])}</span></div>`; }).join('') || '<div class="note" style="padding:9px">Nothing found.</div>';
      out.querySelectorAll('.fpi').forEach(e => { e.onmouseenter = () => e.style.background = '#8884'; e.onmouseleave = () => e.style.background = e.dataset.id === cur ? '#b4ff0030' : ''; e.onclick = () => { host.innerHTML = ''; cb(e.dataset.id); }; }); };
    q.oninput = draw; sel.onchange = draw; $('#fpNo').onclick = () => host.innerHTML = ''; q.onkeydown = e => { if (e.key === 'Escape') host.innerHTML = ''; e.stopPropagation(); };
    if (cur && cur.includes(':')) { sel.value = cur.split(':')[0]; } q.focus(); draw();
  };
})();
