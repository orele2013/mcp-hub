'use strict';
// Tablero kanban: al mover una tarjeta a "En curso" se lanza su encargo; al terminar pasa sola a "Revisar".
const BD = { cards: [], columns: {}, filter: '' };
const COL_HINT = { ideas: 'Tareas por hacer', doing: 'Se lanza el encargo al soltar aquí', review: 'Terminadas: revisa y aplica', done: 'Cerradas' };
const JOB_ST = { waiting: 'esperando', queued: 'en cola', paused: 'en pausa', awaiting_approval: 'esperando aprobación', starting: 'arrancando', running: 'trabajando', done: 'terminado', error: 'falló', cancelled: 'cancelado', timeout: 'sin tiempo', interrupted: 'interrumpido', rejected: 'no aprobado', skipped: 'omitido' };

async function loadBoard() {
  try { ({ cards: BD.cards, columns: BD.columns } = await api('/api/board')); } catch (e) { return toast(e.message, true); }
  $('#count-board').textContent = BD.cards.filter((c) => c.column === 'review').length || '';
  renderBoard();
}
VIEW_LOADERS.board = loadBoard;
for (const ev of ['hub:board', 'hub:delegations']) document.addEventListener(ev, () => { if (currentView === 'board') { clearTimeout(BD.t); BD.t = setTimeout(loadBoard, 250); } });

function renderBoard() {
  const projects = [...new Set(BD.cards.map((c) => c.cwd))];
  const cards = BD.cards.filter((c) => !BD.filter || c.cwd === BD.filter).sort((a, b) => a.order - b.order);
  $('#board-body').innerHTML = `<header class="page-head"><div><h1>Tablero</h1><p class="sub">Arrastra una tarjeta a <b>En curso</b> y su agente empieza a trabajar. Cuando termina, pasa sola a <b>Revisar</b>.</p></div>
      <div class="actions">${projects.length > 1 ? `<select id="bd-filter" class="field sm"><option value="">Todos los proyectos</option>${projects.map((p) => `<option value="${esc(p)}" ${p === BD.filter ? 'selected' : ''}>${esc(tilde(p))}</option>`).join('')}</select>` : ''}
        <button class="btn" id="bd-gh">${svg('globe')}Issues de GitHub</button><button class="btn primary" id="bd-new">${svg('plus')}Nueva tarjeta</button></div></header>
    <div class="kanban">${Object.entries(BD.columns).map(([col, name]) => {
      const list = cards.filter((c) => c.column === col);
      return `<div class="kcol" data-col="${col}"><div class="khead"><b>${name}</b><span class="hint">${list.length || ''}</span></div><p class="hint khint">${COL_HINT[col]}</p>
        <div class="kcards">${list.map(cardHtml).join('')}</div></div>`;
    }).join('')}</div>`;
  $('#bd-new').onclick = () => editCard();
  $('#bd-gh').onclick = () => githubIssues();
  $('#bd-filter')?.addEventListener('change', (e) => { BD.filter = e.target.value; renderBoard(); });
  // Arrastrar y soltar
  $$('#board-body .kcard').forEach((el) => {
    el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', el.dataset.card); el.classList.add('drag'); });
    el.addEventListener('dragend', () => el.classList.remove('drag'));
  });
  $$('#board-body .kcol').forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', (e) => { e.preventDefault(); col.classList.remove('over'); moveCard(e.dataTransfer.getData('text/plain'), col.dataset.col); });
  });
  $$('#board-body [data-ca]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); cardAction(b.closest('[data-card]').dataset.card, b.dataset.ca, b); }));
  $$('#board-body .kcard').forEach((el) => (el.onclick = () => editCard(BD.cards.find((c) => c.id === el.dataset.card))));
}
function cardHtml(c) {
  const st = c.jobStatus;
  const working = ['waiting', 'queued', 'starting', 'running', 'awaiting_approval', 'paused'].includes(st);
  const V = { approved: ['ok', 'Revisión: aprobado'], changes: ['warn', 'Revisión: cambios'], rejected: ['err', 'Revisión: rechazado'] };
  const next = { ideas: ['doing', 'Empezar ▸'], doing: ['review', 'A revisar ▸'], review: ['done', 'Hecho ✓'], done: ['ideas', '↺ Reabrir'] }[c.column];
  return `<div class="kcard ${working ? 'working' : ''}" draggable="true" data-card="${c.id}">
    <div class="ktitle">${logo(c.agent, 20, { plain: true })}<b>${esc(c.title)}</b></div>
    ${c.desc ? `<p class="kdesc">${esc(c.desc.slice(0, 140))}</p>` : ''}
    <div class="ktags">${c.source?.type === 'github' ? `<a class="tag" href="${esc(c.source.url)}" target="_blank" rel="noopener">#${c.source.number}</a>` : ''}${(c.labels || []).slice(0, 3).map((l) => `<span class="tag">${esc(l)}</span>`).join('')}
      ${st ? `<span class="pill ${st === 'done' ? 'ok' : working ? 'warn' : ['error', 'timeout', 'rejected'].includes(st) ? 'err' : ''}">${working ? '<span class="spin"></span>' : ''}${JOB_ST[st] || st}</span>` : ''}
      ${c.verdict ? `<span class="pill ${V[c.verdict][0]}">${V[c.verdict][1]}</span>` : ''}
      ${c.jobReview === 'pending' ? `<span class="pill warn">${c.jobFiles} archivo(s) por revisar</span>` : ''}</div>
    <div class="kact">${c.job ? `<button class="btn sm ghost" data-ca="job">Encargo</button>` : ''}${c.jobReview === 'pending' ? '<button class="btn sm ghost" data-ca="diff">Ver cambios</button>' : ''}
      ${c.jobReview === 'pending' || c.jobReview === 'kept' ? '<button class="btn sm ghost" data-ca="pr">Crear PR</button>' : ''}
      <button class="btn sm" data-ca="move" data-to="${next[0]}">${next[1]}</button></div>
  </div>`;
}
async function moveCard(id, col, cancel = false) {
  const c = BD.cards.find((x) => x.id === id);
  if (!c || c.column === col) return;
  try { await api('/api/board/move', { id, column: col, cancel }); if (col === 'doing') toast(`Encargo lanzado: ${c.title}`); loadBoard(); }
  catch (e) {
    if (/cancelarlo/.test(e.message)) {
      modal(`<div class="mhead"><div><small>Tablero</small><h2>¿Cancelar el encargo?</h2></div></div><p class="sub" style="margin-top:10px">"${esc(c.title)}" está trabajando. Si la sacas de En curso se cancela su encargo.</p>
        <div class="mfoot"><button class="btn" data-close>No</button><button class="btn danger" id="bm-ok">Cancelar y mover</button></div>`);
      $('#bm-ok').onclick = () => { closeModal(); moveCard(id, col, true); };
    } else toast(e.message, true);
  }
}
async function jobById(id) { const r = await api('/api/delegations'); return r.jobs.find((x) => x.id === id); }
async function cardAction(id, act, btn) {
  const c = BD.cards.find((x) => x.id === id);
  try {
    if (act === 'move') return moveCard(id, btn.dataset.to);
    const j = await jobById(c.job);
    if (!j) return toast('El encargo ya no está en el historial', true);
    if (act === 'job') { if (j.sessionId && ['running', 'starting'].includes(j.status)) { activeId = j.sessionId; show('terms'); syncTabs(); } else { show('agents'); setTimeout(() => { dFilter = 'history'; renderDelegations(); $(`#delegations [data-id="${j.id}"]`)?.scrollIntoView({ block: 'center' }); }, 500); } return; }
    if (act === 'diff') { if (!D.status || !Object.keys(D.status).length) D = await api('/api/delegations'); return showDiff(j); }
    if (act === 'pr') return createPr(j);
  } catch (e) { toast(e.message, true); }
}
function createPr(j) {
  modal(`<div class="mhead">${logo('github', 40)}<div><small>GitHub</small><h2>Crear pull request</h2></div></div>
    <p class="sub" style="margin-top:10px">Se guardan los cambios del encargo en la rama <code>mcphub/encargo-${esc(j.id)}</code>, se <b>sube a GitHub</b> (git push) y se abre un PR${j.reviewJob ? ' con la revisión independiente adjunta' : ''}${j.meta?.issue ? ` que cierra el issue #${j.meta.issue}` : ''}.</p>
    <label class="check" style="margin-top:12px"><input type="checkbox" id="pr-draft" checked>Crear como borrador${tick}</label>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="pr-ok">Subir y crear PR</button></div>`);
  $('#pr-ok').onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = 'Subiendo…';
    try { const r = await api('/api/github/pr', { job: j.id, draft: $('#pr-draft').checked }); closeModal(); toast('PR creado'); window.open(r.url, '_blank'); loadBoard(); }
    catch (err) { toast(err.message, true); e.target.disabled = false; e.target.textContent = 'Subir y crear PR'; }
  };
}
const agentOpts = (sel) => (S.clients || []).filter((c) => c.installed).map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
function editCard(c = {}) {
  modal(`<div class="mhead"><div><small>Tablero</small><h2>${c.id ? 'Tarjeta' : 'Nueva tarjeta'}</h2></div></div>
    <div class="form">
      <label>Título<input id="kc-title" class="field" value="${esc(c.title || '')}" placeholder="Qué hay que hacer"></label>
      <label>Descripción <span class="hint">el agente no ve nada más: da contexto</span><textarea id="kc-desc" class="field" rows="5">${esc(c.desc || '')}</textarea></label>
      <label>Carpeta<input id="kc-cwd" class="field mono" list="kc-dirs" value="${esc(tilde(c.cwd || BD.filter || S.recentDirs?.[0] || S.home))}"><datalist id="kc-dirs">${(S.recentDirs || []).map((d) => `<option value="${esc(tilde(d))}">`).join('')}</datalist></label>
      <div class="row"><label>Agente<select id="kc-agent" class="field">${agentOpts(c.agent || 'claude')}</select></label><label>Modelo <span class="hint">opcional</span><input id="kc-model" class="field mono" value="${esc(c.model || '')}"></label></div>
      <div class="row"><label>Permisos<select id="kc-perm" class="field"><option value="">Por defecto</option>${[['read', 'Solo lectura'], ['edit', 'Editar archivos'], ['ask', 'Aprobar cada acción'], ['full', 'Sin límites']].map(([k, l]) => `<option value="${k}" ${k === c.permission ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Dónde trabaja<select id="kc-iso" class="field"><option value="">Por defecto</option><option value="none" ${c.isolation === 'none' ? 'selected' : ''}>En la carpeta</option><option value="worktree" ${c.isolation === 'worktree' ? 'selected' : ''}>Entorno aislado</option></select></label></div>
      <label>Revisión independiente al terminar<select id="kc-review" class="field"><option value="">No</option><option value="auto" ${c.reviewWith === 'auto' ? 'selected' : ''}>Otro agente (automático)</option>${agentOpts(c.reviewWith)}</select></label>
      ${c.jobs?.length ? `<p class="hint">Encargos de esta tarjeta: ${c.jobs.map((x) => `#${esc(x)}`).join(', ')}</p>` : ''}
    </div>
    <div class="mfoot">${c.id ? '<button class="btn danger" id="kc-del">Borrar</button>' : ''}<button class="btn" data-close>Cancelar</button><button class="btn primary" id="kc-ok">Guardar</button></div>`);
  $('#kc-ok').onclick = async () => {
    try {
      await api('/api/board/save', { id: c.id, title: $('#kc-title').value, desc: $('#kc-desc').value, cwd: $('#kc-cwd').value.trim().replace(/^~(?=$|\/)/, S.home), agent: $('#kc-agent').value,
        model: $('#kc-model').value.trim() || null, permission: $('#kc-perm').value || null, isolation: $('#kc-iso').value || null, reviewWith: $('#kc-review').value || null });
      closeModal(); loadBoard();
    } catch (e) { toast(e.message, true); }
  };
  $('#kc-del')?.addEventListener('click', async () => { try { await api('/api/board/delete', { id: c.id }); closeModal(); loadBoard(); } catch (e) { toast(e.message, true); } });
}

// ---- Issues de GitHub → tarjetas o encargos ----
async function githubIssues(dir = BD.filter || S.recentDirs?.[0] || S.home) {
  modal(`<div class="mhead">${logo('github', 40)}<div><small>GitHub</small><h2>Issues</h2></div></div>
    <div class="row" style="margin-top:12px"><input id="gi-dir" class="field mono" list="gi-dirs" value="${esc(tilde(dir))}"><datalist id="gi-dirs">${(S.recentDirs || []).map((d) => `<option value="${esc(tilde(d))}">`).join('')}</datalist>
      <input id="gi-q" class="field" placeholder="Buscar (opcional)" style="max-width:200px"><button class="btn" id="gi-load">Ver issues</button></div>
    <div id="gi-list" class="gi-list"><p class="hint">Cargando…</p></div>
    <div class="mfoot"><button class="btn" data-close>Cerrar</button></div>`, { sheet: true });
  const load = async () => {
    const d = $('#gi-dir').value.trim().replace(/^~(?=$|\/)/, S.home);
    $('#gi-list').innerHTML = '<p class="hint"><span class="spin"></span> Cargando issues…</p>';
    try {
      const r = await api(`/api/github/issues?${new URLSearchParams({ dir: d, q: $('#gi-q').value.trim() })}`);
      $('#gi-list').innerHTML = `<p class="hint">${esc(r.repo.nameWithOwner)} · ${r.issues.length} abiertos</p>` + (r.issues.length ? r.issues.map((i) => `<div class="gi" data-n="${i.number}">
        <div><a href="${esc(i.url)}" target="_blank" rel="noopener"><b>#${i.number}</b></a> ${esc(i.title)} ${i.labels.map((l) => `<span class="tag">${esc(l)}</span>`).join('')}
          <span class="hint">· ${esc(i.author || '')}${i.comments ? ` · ${i.comments} comentario(s)` : ''}</span>
          ${i.linked ? `<span class="hint">· ${i.linked.card ? `en el tablero (${BD.columns[i.linked.column] || i.linked.column})` : ''}${i.linked.job ? ` encargo ${i.linked.job} ${JOB_ST[i.linked.status] || ''}` : ''}${i.linked.pr ? ` · <a href="${esc(i.linked.pr)}" target="_blank">PR</a>` : ''}</span>` : ''}</div>
        <div class="gi-act"><button class="btn sm" data-gi="board">Al tablero</button><button class="btn sm primary" data-gi="job">Encargar ya</button></div></div>`).join('') : '<p class="sub">No hay issues abiertos.</p>');
      $$('#gi-list [data-gi]').forEach((b) => (b.onclick = () => issueTo(d, Number(b.closest('[data-n]').dataset.n), b.dataset.gi)));
    } catch (e) { $('#gi-list').innerHTML = `<p class="errtxt">${esc(e.message)}</p>`; }
  };
  $('#gi-load').onclick = load;
  $('#gi-q').onkeydown = (e) => { if (e.key === 'Enter') load(); };
  load();
}
function issueTo(dir, number, to) {
  modal(`<div class="mhead">${logo('github', 40)}<div><small>Issue #${number}</small><h2>${to === 'board' ? 'Añadir al tablero' : 'Encargar ahora'}</h2></div></div>
    <div class="form"><div class="row"><label>Agente<select id="it-agent" class="field">${agentOpts('claude')}</select></label><label>Modelo <span class="hint">opcional</span><input id="it-model" class="field mono"></label></div>
      <label>Revisión independiente<select id="it-review" class="field"><option value="auto">Otro agente (automático)</option><option value="">No</option>${agentOpts('')}</select></label>
      <span class="hint">Trabaja en un entorno aislado con permiso para editar. Al terminar podrás ver el diff, aplicarlo o crear un PR que cierre el issue.</span></div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="it-ok">${to === 'board' ? 'Añadir' : 'Encargar'}</button></div>`);
  $('#it-ok').onclick = async () => {
    try {
      await api('/api/github/issue', { dir, number, to, agent: $('#it-agent').value, model: $('#it-model').value.trim() || null, reviewWith: $('#it-review').value || null, isolation: 'worktree', permission: 'edit' });
      closeModal(); toast(to === 'board' ? 'Añadido a Ideas' : 'Encargo creado'); if (to === 'board') { show('board'); } else loadBoard();
    } catch (e) { toast(e.message, true); }
  };
}
