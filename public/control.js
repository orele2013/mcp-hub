'use strict';
// Sala de control (todas las terminales en vivo, encargos, aprobaciones, monitores y avisos a pantalla completa),
// paleta de comandos (Ctrl+K) y el panel del agente sombra en Terminales.

// ---------------- Sala de control ----------------
const CTL = { el: null, terms: new Map(), timer: null, data: null };
function openControl() {
  if (CTL.el) return;
  const el = document.createElement('div');
  el.className = 'control'; el.id = 'control';
  el.innerHTML = `<header class="ctl-head"><b>Sala de control</b><span class="hint" id="ctl-sum"></span><span class="grow"></span>
    <button class="btn sm" id="ctl-fs">Pantalla completa</button><button class="btn sm" id="ctl-close">Cerrar <kbd>Esc</kbd></button></header>
    <div class="ctl-body"><div class="ctl-grid" id="ctl-grid"></div><aside class="ctl-side" id="ctl-side"></aside></div>`;
  document.body.append(el);
  CTL.el = el;
  $('#ctl-close').onclick = closeControl;
  $('#ctl-fs').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.()).catch?.(() => {});
  refreshControl();
  CTL.timer = setInterval(refreshControl, 4000);
}
function closeControl() {
  clearInterval(CTL.timer);
  for (const t of CTL.terms.values()) { try { t.ws.close(); t.term.dispose(); } catch {} }
  CTL.terms.clear();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  CTL.el?.remove(); CTL.el = null;
}
async function refreshControl() {
  if (!CTL.el) return;
  let d; try { d = await api('/api/control'); } catch { return; }
  CTL.data = d;
  const grid = $('#ctl-grid');
  // Terminales: se crean y se quitan según las sesiones abiertas (solo lectura)
  const ids = new Set(d.sessions.map((s) => s.id));
  for (const [id, t] of CTL.terms) if (!ids.has(id)) { try { t.ws.close(); t.term.dispose(); } catch {} t.tile.remove(); CTL.terms.delete(id); }
  for (const s of d.sessions) if (!CTL.terms.has(s.id)) miniTerm(s, grid);
  for (const s of d.sessions) { const t = CTL.terms.get(s.id); if (t) t.tile.querySelector('.ctl-title').innerHTML = sessionLabel(s); }
  grid.classList.toggle('empty', !d.sessions.length);
  if (!d.sessions.length && !grid.querySelector('.empty')) grid.innerHTML = '<div class="empty"><p>No hay terminales abiertas.</p></div>';
  else grid.querySelector('.empty')?.remove();
  const n = d.sessions.length;
  grid.style.setProperty('--cols', n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4);
  const running = d.jobs.filter((j) => j.status === 'running' || j.status === 'starting');
  $('#ctl-sum').textContent = `${n} terminal(es) · ${running.length} encargo(s) trabajando · ${d.jobs.length - running.length} en espera · ${d.approvals.length} aprobación(es)`;
  const ST = { running: 'trabajando', starting: 'arrancando', queued: 'en cola', waiting: 'esperando a otros', awaiting_approval: 'esperando aprobación' };
  $('#ctl-side').innerHTML = `
    ${d.held ? `<div class="ctl-card warn"><b>Cola en pausa</b><span>${esc(d.held.reason)}</span></div>` : ''}
    ${d.busyNow ? `<div class="ctl-card"><b>Ocupado en el calendario</b><span>${esc(d.busyNow.title)} · hasta ${new Date(d.busyNow.end).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span></div>` : ''}
    <div class="ctl-sec">Aprobaciones</div>${d.approvals.length ? d.approvals.map((a) => `<div class="ctl-card warn" data-ap="${a.id}"><b>${esc(a.tool)}</b><span class="hint">encargo ${esc(a.job)}</span><pre>${esc(String(a.input).slice(0, 300))}</pre>
      <div class="jactions"><button class="btn sm danger" data-cdec="0">Denegar</button><button class="btn sm primary" data-cdec="1">Aprobar</button></div></div>`).join('') : '<p class="hint">Ninguna pendiente.</p>'}
    <div class="ctl-sec">Encargos</div>${d.jobs.length ? d.jobs.slice(0, 20).map((j) => `<div class="ctl-card">${logo(j.agent, 18, { plain: true })}<b>${esc(j.agentName)}</b> <span class="pill ${j.status === 'running' ? 'warn' : ''}">${ST[j.status] || j.status}</span>
      <span class="hint">${esc(j.task.slice(0, 90))}</span></div>`).join('') : '<p class="hint">Ninguno activo.</p>'}
    ${d.monitors.length ? `<div class="ctl-sec">Monitores</div>${d.monitors.map((m) => `<div class="ctl-row"><span class="dot ${m.state === 'up' ? 'ok' : m.state === 'down' ? 'err' : ''}"></span>${esc(m.name)}<span class="grow"></span><span class="hint">${m.last ? `${m.last.ms} ms` : ''}</span></div>`).join('')}` : ''}
    ${d.shadow.some((x) => x.alerts.length) ? `<div class="ctl-sec">Agente sombra</div>${d.shadow.flatMap((x) => x.alerts.filter((a) => !a.error).map((a) => `<div class="ctl-card warn"><span class="hint">${new Date(a.at).toLocaleTimeString('es-ES')} · ${esc(a.title || '')}</span><span>${esc(a.text)}</span></div>`)).join('')}` : ''}`;
  $$('#ctl-side [data-cdec]').forEach((b) => (b.onclick = async () => { try { await api('/api/approvals/decide', { id: b.closest('[data-ap]').dataset.ap, allow: b.dataset.cdec === '1' }); refreshControl(); } catch (e) { toast(e.message, true); } }));
}
function miniTerm(s, grid) {
  const tile = document.createElement('div');
  tile.className = 'ctl-tile';
  tile.innerHTML = `<div class="ctl-tbar">${logo(s.client, 16, { plain: true })}<span class="ctl-title"></span><span class="grow"></span><button class="btn sm ghost">Abrir</button></div><div class="ctl-term"></div>`;
  grid.append(tile);
  const main = terms.get(s.id)?.term;
  const term = new Terminal({ fontFamily: '"Geist Mono Variable", ui-monospace, monospace', fontSize: 11, lineHeight: 1.1, disableStdin: true, cursorBlink: false, scrollback: 2000,
    cols: main?.cols || 120, rows: main?.rows || 32, theme: { background: '#141413', foreground: '#E9E7E0', cursor: '#141413' } });
  const box = tile.querySelector('.ctl-term');
  term.open(box);
  // Se escala para que la terminal entera quepa en la tarjeta, con el tamaño real de la sesión
  const scale = () => { const inner = box.firstElementChild; if (!inner) return; const sw = box.clientWidth / inner.scrollWidth, sh = box.clientHeight / inner.scrollHeight; inner.style.transform = `scale(${Math.min(sw, sh, 1)})`; };
  new ResizeObserver(scale).observe(box);
  setTimeout(scale, 200);
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/term/${s.id}?token=${TOKEN}`);
  let first = true;
  ws.onmessage = (e) => { if (e.data.startsWith('{"t":"exit"')) return; if (first) { term.reset(); first = false; } term.write(e.data); };
  // Solo mirar: los mensajes de esta conexión nunca se envían al terminal
  tile.querySelector('button').onclick = () => { closeControl(); activeId = s.id; show('terms'); syncTabs(); };
  CTL.terms.set(s.id, { term, ws, tile });
}
$('#btn-control').onclick = openControl;

// ---------------- Paleta de comandos (Ctrl+K) ----------------
function paletteItems() {
  const items = [];
  const nav = (id, name) => items.push({ group: 'Ir a', label: name, run: () => show(id) });
  $$('nav button[data-view]').forEach((b) => nav(b.dataset.view, b.querySelector('span').textContent));
  items.push({ group: 'Acciones', label: 'Sala de control', run: openControl });
  items.push({ group: 'Acciones', label: 'Nuevo encargo', run: () => { show('agents'); setTimeout(() => newJob(), 400); } });
  items.push({ group: 'Acciones', label: 'Nueva conversación de chat', run: () => { show('chat'); setTimeout(newChat, 300); } });
  items.push({ group: 'Acciones', label: 'Nuevo debate entre agentes', run: () => { show('chat'); setTimeout(newDebate, 300); } });
  items.push({ group: 'Acciones', label: 'Nueva tarjeta del tablero', run: () => { show('board'); setTimeout(() => editCard(), 300); } });
  items.push({ group: 'Acciones', label: 'Issues de GitHub', run: () => { show('board'); setTimeout(() => githubIssues(), 300); } });
  items.push({ group: 'Acciones', label: 'Nuevo monitor', run: () => { show('monitors'); setTimeout(() => editMonitor(), 300); } });
  items.push({ group: 'Acciones', label: 'Añadir servidor MCP', run: () => { show('servers'); setTimeout(() => $('#btn-add')?.click(), 200); } });
  items.push({ group: 'Acciones', label: 'Comprobar la salud de todos los MCP', run: () => { show('servers'); setTimeout(() => $('#btn-health')?.click(), 200); } });
  for (const c of (S.clients || []).filter((x) => x.installed)) items.push({ group: 'Abrir agente', label: `Abrir ${c.name}`, run: () => launchSheet(c.id) });
  for (const s of S.sessions || []) if (!s.exited) items.push({ group: 'Terminales', label: s.title, hint: tilde(s.cwd), run: () => { activeId = s.id; show('terms'); syncTabs(); } });
  for (const p of (typeof DZ !== 'undefined' ? DZ.projects || [] : []).slice(0, 30)) items.push({ group: 'Diseños', label: p.name, run: () => { show('design'); setTimeout(() => openDesign(p.slug), 200); } });
  for (const sc of (typeof SCHED !== 'undefined' ? SCHED : [])) items.push({ group: 'Tareas programadas', label: `Lanzar ahora: ${sc.name}`, run: async () => { try { await api('/api/schedules/run', { id: sc.id }); toast('Lanzada'); } catch (e) { toast(e.message, true); } } });
  for (const r of (typeof RECIPES !== 'undefined' ? RECIPES : [])) items.push({ group: 'Recetas', label: `Repetir: ${r.name}`, run: () => { show('agents'); setTimeout(() => runRecipe(r), 400); } });
  for (const d of (S.recentDirs || []).slice(0, 6)) items.push({ group: 'Mapa del proyecto', label: tilde(d), run: () => { PM.dir = d; PM.map = null; PM.pos = null; show('map'); } });
  return items;
}
// Coincidencia aproximada: todas las letras en orden; puntúa más las seguidas y al inicio de palabra
function fuzzy(q, s) {
  q = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); s = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!q) return 1;
  let i = 0, score = 0, prev = -2;
  for (let k = 0; k < s.length && i < q.length; k++) if (s[k] === q[i]) { score += k === prev + 1 ? 3 : (k === 0 || /\W/.test(s[k - 1])) ? 2 : 1; prev = k; i++; }
  return i === q.length ? score : 0;
}
function openPalette() {
  if ($('#palette')) return;
  const all = paletteItems();
  const el = document.createElement('div');
  el.id = 'palette'; el.className = 'palette';
  el.innerHTML = `<div class="pal-box" role="dialog" aria-label="Paleta de comandos"><input id="pal-q" class="field" placeholder="Busca una acción, sección, terminal, diseño…" autocomplete="off"><div id="pal-list" class="pal-list"></div><div class="pal-foot hint">↑↓ para elegir · Intro para abrir · Esc para cerrar</div></div>`;
  document.body.append(el);
  let sel = 0, shown = [];
  const render = () => {
    const q = $('#pal-q').value.trim();
    shown = all.map((x) => ({ x, s: fuzzy(q, `${x.label} ${x.group}`) })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 40).map((r) => r.x);
    if (!q) shown = all.slice(0, 40);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    $('#pal-list').innerHTML = shown.length ? shown.map((x, i) => `<button class="pal-item ${i === sel ? 'on' : ''}" data-i="${i}"><span>${esc(x.label)}</span>${x.hint ? `<span class="hint mono">${esc(x.hint)}</span>` : ''}<span class="grow"></span><span class="hint">${esc(x.group)}</span></button>`).join('') : '<p class="hint" style="padding:12px">Nada coincide.</p>';
    $$('#pal-list [data-i]').forEach((b) => (b.onclick = () => go(+b.dataset.i)));
    $('#pal-list .on')?.scrollIntoView({ block: 'nearest' });
  };
  const close = () => el.remove();
  const go = (i) => { const x = shown[i]; close(); if (x) Promise.resolve(x.run()).catch((e) => toast(e.message, true)); };
  $('#pal-q').oninput = () => { sel = 0; render(); };
  $('#pal-q').onkeydown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(sel); }
    else if (e.key === 'Escape') close();
  };
  el.addEventListener('mousedown', (e) => { if (e.target === el) close(); });
  render();
  $('#pal-q').focus();
}
$('#btn-palette').onclick = openPalette;
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
    // En una terminal, Ctrl+K es de la terminal salvo que esté fuera de foco
    if (document.activeElement?.closest?.('.xterm') && currentView === 'terms') return;
    e.preventDefault(); $('#palette') ? $('#palette').remove() : openPalette();
  }
  if (e.key === 'Escape' && CTL.el && !$('#palette')) closeControl();
});

// ---------------- Agente sombra (panel de la sesión en Terminales) ----------------
let SHADOW = {};
async function loadShadow() { try { SHADOW = (await api('/api/shadow')).watch; } catch {} if (currentView === 'terms') renderSide(); }
document.addEventListener('hub:shadow', loadShadow);
document.addEventListener('hub:shadow-alert', (e) => { const a = e.detail.alert; toast(`👀 ${a.title}: ${a.text}`, true); loadShadow(); });
setTimeout(loadShadow, 1200);
window.sideExtras = (s) => {
  if (s.exited || s.job || /^↳/.test(s.title || '')) return '';
  const w = SHADOW[s.id];
  return `<div class="shadow-box"><div class="side-title" style="padding-left:0">Agente sombra</div>
    ${w ? `<p class="hint">${esc(clientName(w.agent))}${w.model ? ` (${esc(w.model)})` : ''} mira esta terminal cada ${w.every} min si cambia · ${w.checks} comprobación(es)${w.job ? ' · <span class="spin"></span> mirando' : ''}</p>
      ${w.alerts.slice(0, 4).map((a) => `<div class="shadow-alert ${a.error ? 'err' : ''}"><span class="hint">${new Date(a.at).toLocaleTimeString('es-ES')}</span> ${esc(a.text)}</div>`).join('')}
      <button class="btn block" data-shadow="off">Dejar de vigilar</button>`
      : `<p class="hint">Otro agente mira de vez en cuando lo que se ve aquí y te avisa si ve un error, tests que fallan o algo peligroso. Solo lee; cada comprobación es una llamada al agente (solo cuando la pantalla cambia).</p>
      <button class="btn block" data-shadow="on">${svg('shield')}Vigilar esta terminal</button>`}</div>`;
};
window.bindSideExtras = (s) => {
  $('#term-side [data-shadow="off"]')?.addEventListener('click', async () => { await api('/api/shadow/set', { session: s.id, enabled: false }); loadShadow(); });
  $('#term-side [data-shadow="on"]')?.addEventListener('click', () => {
    const ag = (S.clients || []).filter((c) => c.installed);
    modal(`<div class="mhead"><div><small>Agente sombra</small><h2>Vigilar "${esc(s.title)}"</h2></div></div>
      <div class="form"><div class="row"><label>Agente<select id="sh-agent" class="field">${ag.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
        <label>Modelo<input id="sh-model" class="field mono" value="haiku"></label><label>Cada (min)<input id="sh-every" class="field" type="number" min="2" value="5"></label></div>
      <span class="hint">Solo se consulta al agente si la pantalla cambió desde la última vez. Con Claude, "haiku" es lo más barato. Los avisos aparecen aquí, en la Sala de control y por Mensajería (si activas "Avisos del agente sombra").</span></div>
      <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="sh-ok">Vigilar</button></div>`);
    $('#sh-agent').onchange = () => { $('#sh-model').value = $('#sh-agent').value === 'claude' ? 'haiku' : ''; };
    $('#sh-ok').onclick = async () => { try { await api('/api/shadow/set', { session: s.id, enabled: true, agent: $('#sh-agent').value, model: $('#sh-model').value.trim() || null, every: $('#sh-every').value }); closeModal(); toast('Vigilando'); loadShadow(); } catch (e) { toast(e.message, true); } };
  });
};
