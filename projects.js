/* WireFrame: projects (many saved sheets), title-block editor, shortcut sheet. */
(function () {
  const A = window.App, $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const host = () => $('#modalHost');
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

  A.projectsDialog = () => { const h = host(); const draw = () => { const l = P.list().sort((a, b) => b.updated - a.updated);
    h.innerHTML = `<div class="back"><div class="modal"><header><b>Projects</b><button id="pjX" class="small">Close</button></header><div class="mb">
      <p class="note">Each project is its own circuit. They are saved automatically in this browser. Use File → Save to keep a copy as a file.</p>
      <div class="row"><input id="pjName" placeholder="New project name" autocomplete="off"><button id="pjNew" class="accent">+ New project</button></div>
      <div class="pjlist">${l.map(x => `<div class="pjrow${x.id === P.cur ? ' cur' : ''}" data-id="${x.id}"><span class="pjn"><b>${esc(x.name)}</b><small>${x.id === P.cur ? 'open now · ' : ''}${new Date(x.updated).toLocaleString()}</small></span><button data-a="open">Open</button><button data-a="ren">Rename</button><button data-a="dup">Copy</button><button data-a="del" class="danger">Delete</button></div>`).join('')}</div></div></div></div>`;
    $('#pjX').onclick = () => { h.innerHTML = ''; };
    const mk = () => { const n = $('#pjName').value.trim() || 'Untitled project'; P.newProject(n); h.innerHTML = ''; }; $('#pjNew').onclick = mk; $('#pjName').onkeydown = e => { if (e.key === 'Enter') mk(); e.stopPropagation(); };
    h.querySelectorAll('.pjrow').forEach(r => r.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; const id = r.dataset.id, a = b.dataset.a;
      if (a === 'open') { P.open(id); h.innerHTML = ''; } else if (a === 'dup') { P.duplicate(id); draw(); }
      else if (a === 'ren') { const nm = prompt('Project name', P.list().find(x => x.id === id).name); if (nm && nm.trim()) { P.rename(id, nm.trim()); draw(); } }
      else if (a === 'del') { if (P.list().length < 2) { A.toast('You need at least one project'); return; } if (!confirm('Delete this project for good?')) return; const was = id === P.cur; P.remove(id); if (was) { P.open(P.list()[0].id); } draw(); } }); }; draw(); };

  A.sheetDialog = () => { const m = A.doc.meta, h = host(); const f = (k, label, ph) => `<div class="row"><label>${label}</label><input data-k="${k}" value="${esc(m[k] || '')}" placeholder="${esc(ph || '')}"></div>`;
    h.innerHTML = `<div class="back"><div class="modal"><header><b>Title block</b><button id="sbX" class="small">Close</button></header><div class="mb">${f('title', 'Title')}${f('author', 'Name')}${f('company', 'Company / school')}${f('project', 'Project')}${f('comment', 'Comment', 'e.g. * Indicates a PWM-capable pin')}${f('date', 'Date')}${f('rev', 'Revision', '1')}${f('size', 'Size', 'A4')}</div><footer><button id="sbOk" class="accent">Done</button></footer></div></div>`;
    const done = () => { h.querySelectorAll('[data-k]').forEach(i => { m[i.dataset.k] = i.value; }); h.innerHTML = ''; A.commit(); A.renderProps && A.renderProps(); }; $('#sbOk').onclick = done; $('#sbX').onclick = done; };

  const KEYS = [['Drawing', [['A', 'Add a part (jumps to search)'], ['P', 'Add a power symbol (GND, +5V…)'], ['W', 'Draw a wire'], ['L', 'Add a net label'], ['T', 'Add a text note'], ['S / Esc', 'Select tool / cancel']]],
    ['Editing', [['R', 'Rotate'], ['X', 'Mirror up/down'], ['Y', 'Mirror left/right'], ['M or G', 'Move (click to drop)'], ['C', 'Duplicate'], ['E', 'Edit (reference, or title block if nothing selected)'], ['V', 'Edit value'], ['U', 'Edit reference'], ['Del', 'Delete'], ['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl+C / X / V / D', 'Copy, cut, paste, duplicate'], ['Arrows', 'Nudge selection'], ['Double-click', 'Edit a part, a note, or the title block']]],
    ['View', [['Home or F', 'Show the whole sheet'], ['Ctrl+Home', 'Zoom to the circuit'], ['Scroll / + / -', 'Zoom'], ['Space + drag, or right-drag', 'Pan'], ['Ctrl+S', 'Save file'], ['Ctrl+Enter', 'Play / pause simulation'], ['?', 'This list']]]];
  A.shortcutsDialog = () => { const h = host(); h.innerHTML = `<div class="back"><div class="modal"><header><b>Keyboard shortcuts (same as KiCad)</b><button id="kbX" class="small">Close</button></header><div class="mb kb">${KEYS.map(([t, r]) => `<h4>${t}</h4>` + r.map(([k, d]) => `<div class="kr"><kbd>${esc(k)}</kbd><span>${esc(d)}</span></div>`).join('')).join('')}</div></div></div>`; $('#kbX').onclick = () => { h.innerHTML = ''; }; };

  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { const b = $('#bPlay'); if (b && !b.hidden) b.click(); else { const s = $('#bStop'); s && s.click(); } e.preventDefault(); } });
  const b = $('#bProj'); if (b) b.onclick = () => A.projectsDialog();
})();
