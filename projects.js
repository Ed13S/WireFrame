/* WireFrame: projects (many saved sheets), title-block editor, shortcut sheet. */
(function () {
  const A = window.App, $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const host = () => $('#modalHost');
  /* Platform-aware shortcut labels: Mac/iPad show ⌘ ⌥ ⇧, everything else shows Ctrl Alt Shift */
  const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';
  A.isMac = /Mac|iPhone|iPad|iPod/i.test(plat) || (/Mac/i.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1);
  A.keyLabel = s => !A.isMac ? s : String(s).replace(/Ctrl\+Home/g, '⌘fn←').replace(/Home or F/g, 'fn← or F').replace(/Ctrl\+/g, '⌘').replace(/Alt\+/g, '⌥').replace(/Shift\+/g, '⇧').replace(/\bDel\b/g, 'Delete');
  A.fixKeyTips = root => { (root || document).querySelectorAll('[title*="Ctrl"],[title*="Alt+"]').forEach(el => { el.title = A.keyLabel(el.title); }); };
  A.fixKeyTips();
  const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { A.toast('Browser storage is full or blocked; save your project as a file.'); return false; } }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
  const P = A.projects = { cur: null,
    list() { try { return JSON.parse(ls.get('wf_projects') || '[]'); } catch (e) { return []; } },
    saveList(l) { ls.set('wf_projects', JSON.stringify(l)); },
    save() { if (!P.cur) return; const l = P.list(), e = l.find(x => x.id === P.cur); if (!e) return; e.updated = Date.now(); P.saveList(l); ls.set('wf_p_' + P.cur, JSON.stringify(A.exportDoc())); },
    name() { const e = P.list().find(x => x.id === P.cur); return e ? e.name : 'Untitled'; },
    label() { const b = $('#bProj'); if (b) b.textContent = '📁 ' + P.name() + ' ▾'; },
    create(name, doc) { const l = P.list(), id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); l.push({ id, name: name || 'Untitled project', updated: Date.now() }); P.saveList(l); if (doc) ls.set('wf_p_' + id, JSON.stringify(doc)); return id; },
    open(id) { P.save(); const raw = ls.get('wf_p_' + id); P.cur = id; ls.set('wf_cur', id); if (raw) { try { A.importDoc(JSON.parse(raw)); } catch (e) { A.doc = A.newDoc(); A.emit('load'); } } else { A.doc = A.newDoc(); A.hist = []; A.fut = []; A.commit(); A.emit('load'); }
      A.doc.meta.file = P.name() + '.wireframe'; P.label(); A.render(); },
    newProject(name) { P.save(); const d = A.newDoc(); d.meta.title = name; d.meta.file = name + '.wireframe'; const id = P.create(name, Object.assign({ format: 'wireframe/1', defs: {} }, d)); P.open(id); },
    rename(id, n) { const l = P.list(), e = l.find(x => x.id === id); if (e) { e.name = n; P.saveList(l); if (id === P.cur) { A.doc.meta.file = n + '.wireframe'; A.render(); } P.label(); } },
    remove(id) { P.saveList(P.list().filter(x => x.id !== id)); ls.del('wf_p_' + id); },
    duplicate(id) { if (id === P.cur) P.save(); const raw = ls.get('wf_p_' + id); const nid = P.create(P.list().find(x => x.id === id).name + ' copy', raw ? JSON.parse(raw) : null); return nid; },
    /* called at startup: returns true if a project was restored */
    async restore() { let l = P.list();
      if (!l.length) { const old = ls.get('ss_doc'); if (old) { try { const o = JSON.parse(old); if (o && o.parts && (o.parts.length || o.wires.length)) { P.cur = P.create('My first project', o); } } catch (e) {} } }
      l = P.list(); const want = ls.get('wf_cur'); const id = l.find(x => x.id === want) ? want : (l[0] && l[0].id); if (!id) return false; P.open(id); return true; },
    adoptCurrent() { if (!P.cur) { P.cur = P.create(A.doc.meta.title || 'My first project', null); ls.set('wf_cur', P.cur); A.doc.meta.file = P.name() + '.wireframe'; P.save(); P.label(); } } };
  A.autosave = () => { clearTimeout(A._as); A._as = setTimeout(() => { if (!P.cur) P.adoptCurrent(); P.save(); }, 400); };

  const thumbs = new Map();
  P.thumb = id => { const e = P.list().find(x => x.id === id); if (!e) return ''; const key = id + ':' + e.updated; if (thumbs.has(key)) return thumbs.get(key);
    let out = ''; const raw = ls.get('wf_p_' + id);
    if (raw) { const keep = A.doc; try { const o = JSON.parse(raw);
      if ((o.parts || []).length || (o.wires || []).length || (o.labels || []).length || (o.notes || []).length) {
        const d = A.newDoc(); Object.assign(d, { parts: o.parts || [], wires: o.wires || [], labels: o.labels || [], notes: o.notes || [], meta: o.meta || d.meta, seq: o.seq || 1000, defs: o.defs || {} });
        Object.keys(d.defs).forEach(k => { if (!A.LIB[k]) A.LIB[k] = d.defs[k]; });
        A.doc = d; out = A.exportSVG({ tight: true, bg: true }).replace(/ width="\d+" height="\d+"/, ' preserveAspectRatio="xMidYMid meet"'); } } catch (err) { out = ''; } finally { A.doc = keep; } }
    thumbs.set(key, out); return out; };

  A.projectsDialog = () => { const h = host(); P.save(); const draw = () => { const l = P.list().sort((a, b) => b.updated - a.updated);
    const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : new Date(t).toLocaleDateString(); };
    h.innerHTML = `<div class="back"><div class="modal wide"><header><b>Projects</b><button id="pjX" class="small">Close</button></header><div class="mb">
      <p class="note">Each project is its own circuit, saved automatically in this browser. Use File → Save to keep a copy as a file.</p>
      <div class="pjgrid">
        <div class="pjcard new"><div class="pjthumb"><span>+</span></div><div class="pjmeta"><input id="pjName" placeholder="New project name" autocomplete="off"><button id="pjNew" class="accent">Create</button></div></div>
        ${l.map(x => { const t = P.thumb(x.id); return `<div class="pjcard${x.id === P.cur ? ' cur' : ''}" data-id="${x.id}"><div class="pjthumb" data-a="open" title="Open ${esc(x.name)}">${t || '<em>Empty sheet</em>'}</div>
          <div class="pjmeta"><span class="pjn"><b>${esc(x.name)}</b><small>${x.id === P.cur ? 'open now · ' : ''}${ago(x.updated)}</small></span>
          <span class="pjact"><button data-a="ren" title="Rename">✎</button><button data-a="dup" title="Make a copy">⧉</button><button data-a="del" class="danger" title="Delete">🗑</button></span></div></div>`; }).join('')}
      </div></div></div></div>`;
    $('#pjX').onclick = () => { h.innerHTML = ''; };
    const mk = () => { const n = $('#pjName').value.trim() || 'Untitled project'; P.newProject(n); h.innerHTML = ''; }; $('#pjNew').onclick = mk; $('#pjName').onkeydown = e => { if (e.key === 'Enter') mk(); e.stopPropagation(); };
    h.querySelectorAll('.pjcard[data-id]').forEach(r => r.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; const id = r.dataset.id, a = b.dataset.a;
      if (a === 'open') { P.open(id); h.innerHTML = ''; } else if (a === 'dup') { P.duplicate(id); draw(); }
      else if (a === 'ren') { A.askText('Project name', P.list().find(x => x.id === id).name, nm => { if (nm && nm.trim()) { P.rename(id, nm.trim()); draw(); } }); }
      else if (a === 'del') { if (P.list().length < 2) { A.toast('You need at least one project'); return; } if (!confirm('Delete this project for good?')) return; const was = id === P.cur; P.remove(id); if (was) { P.open(P.list()[0].id); } draw(); } }); }; draw(); };

  A.sheetDialog = () => { const m = A.doc.meta, h = host(); const f = (k, label, ph) => `<div class="row"><label>${label}</label><input data-k="${k}" value="${esc(m[k] || '')}" placeholder="${esc(ph || '')}"></div>`;
    h.innerHTML = `<div class="back"><div class="modal"><header><b>Title block</b><button id="sbX" class="small">Close</button></header><div class="mb">${f('title', 'Title')}${f('author', 'Name')}${f('company', 'Company / school')}${f('project', 'Project')}${f('comment', 'Comment 1', 'e.g. * Indicates a PWM-capable pin')}${f('comment2', 'Comment 2')}${f('comment3', 'Comment 3')}${f('comment4', 'Comment 4')}${f('date', 'Date')}${f('rev', 'Revision', '1')}${f('size', 'Size', 'A4')}</div><footer><button id="sbOk" class="accent">Done</button></footer></div></div>`;
    const done = () => { h.querySelectorAll('[data-k]').forEach(i => { m[i.dataset.k] = i.value; }); h.innerHTML = ''; A.commit(); A.renderProps && A.renderProps(); }; $('#sbOk').onclick = done; $('#sbX').onclick = done; };

  const KEYS = [['Drawing', [['A', 'Add a part (jumps to search)'], ['P', 'Add a power symbol (GND, +5V…)'], ['Shift+G', 'Place a GND symbol'], ['Shift+V', 'Place a VCC symbol'], ['Shift+R', 'Place a resistor'], ['W', 'Draw a wire'], ['Shift+W', 'Auto-routed wire: click start, click end, it goes round parts'], ['L', 'Add a net label'], ['T or Shift+T', 'Add a text note'], ['Q', 'No-connect flag (click a pin; click again to remove)'], ['J', 'Junction (dots are added automatically)'], ['N', 'Cycle grid: dots / lines / off'], ['Alt+click or long-press', 'Pick between overlapping items'], ['S / Esc', 'Select tool / cancel']]],
    ['Editing', [['R', 'Rotate'], ['X', 'Mirror up/down'], ['Y', 'Mirror left/right'], ['M or G', 'Move (click to drop)'], ['C', 'Duplicate'], ['E', 'Edit (reference, or title block if nothing selected)'], ['V', 'Edit value'], ['U', 'Edit reference'], ['Del', 'Delete'], ['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl+C / X / V / D', 'Copy, cut, paste, duplicate'], ['Arrows', 'Nudge selection'], ['Double-click', 'Edit a part, a note, or the title block']]],
    ['View', [['Home or F', 'Show the whole sheet'], ['Ctrl+Home', 'Zoom to the circuit'], ['Scroll / + / -', 'Zoom'], ['Space + drag, or right-drag', 'Pan'], ['Ctrl+S', 'Save file'], ['Ctrl+Enter', 'Play / pause simulation'], ['? or Ctrl+F1', 'This list'], ['Ctrl+click', 'Toggle in selection'], ['Shift+click', 'Add to selection'], ['Ctrl+Shift+click', 'Remove from selection']]]];
  A.shortcutsDialog = () => { const h = host(); h.innerHTML = `<div class="back"><div class="modal"><header><b>Keyboard shortcuts (same as KiCad)</b><button id="kbX" class="small">Close</button></header><div class="mb kb">${KEYS.map(([t, r]) => `<h4>${t}</h4>` + r.map(([k, d]) => `<div class="kr"><kbd>${esc(A.keyLabel(k))}</kbd><span>${esc(d)}</span></div>`).join('')).join('')}</div></div></div>`; $('#kbX').onclick = () => { h.innerHTML = ''; }; };

  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { const b = $('#bPlay'); if (b && !b.hidden) b.click(); else { const s = $('#bStop'); s && s.click(); } e.preventDefault(); } });
  const b = $('#bProj'); if (b) b.onclick = () => A.projectsDialog();
})();
