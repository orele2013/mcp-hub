'use strict';
// Encargos entre agentes: cola, permisos, entornos aislados, aprobaciones, límites, reanudación y revisión de cambios.
Object.assign(ICONS, {
  handoff: 'M4 12h11M11 8l4 4-4 4M15 5h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3',
  pause: 'M8 5v14M16 5v14',
  diff: 'M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 9v3a3 3 0 0 1-3 3H9',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2ZM10 20a2 2 0 0 0 4 0',
});
Object.assign(LOGOS, { agents: { icon: 'handoff' } });

let D = { jobs: [], approvals: [], settings: {}, permissions: {}, isolation: {}, status: {}, agents: [], registered: false, running: 0 };
let dFilter = 'active';
let LIB = { roles: [], templates: [] };
let SCHED = [];
let RECIPES = [];
// Los encargos internos del chat, los debates y el agente sombra se ven en sus propias pantallas
const HIDDEN_KINDS = ['chat', 'debate', 'shadow'];
let usageBy = 'agent';
let seenApprovals = null;
const ACTIVE_ST = ['waiting', 'queued', 'paused', 'awaiting_approval', 'starting', 'running'];
const VERDICT = { approved: ['ok', 'Aprobado'], changes: ['warn', 'Cambios necesarios'], rejected: ['err', 'Rechazado'] };
const jobRef = (id) => { const x = D.jobs.find((j) => j.id === id); return `<a href="#" class="jref" data-goto="${esc(id)}">#${esc(id)}</a>${x ? ` <span class="hint">${esc(x.agentName)} · ${esc(D.status[x.status] || x.status)}</span>` : ''}`; };

async function loadDelegations() {
  try { [D, LIB, { schedules: SCHED }, { recipes: RECIPES }] = await Promise.all([api('/api/delegations'), api('/api/library'), api('/api/schedules'), api('/api/recipes')]); } catch (e) { return toast(e.message, true); }
  D.jobs = D.jobs.filter((j) => !HIDDEN_KINDS.includes(j.kind));
  const pending = D.approvals.filter((a) => a.status === 'pending');
  const ids = new Set(pending.map((a) => a.id));
  if (seenApprovals) for (const a of pending) if (!seenApprovals.has(a.id)) toast(`Aprobación pendiente: ${a.tool} (encargo ${a.job})`);
  seenApprovals = ids;
  const em = $('#count-agents');
  if (em) { em.classList.toggle('badge', pending.length > 0); em.textContent = pending.length || S.clients.filter((c) => c.installed).length || ''; }
  renderDelegations();
}

const dWhen = (t) => (t ? new Date(t).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const dDur = (ms) => { const s = Math.round((ms || 0) / 1000); return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`; };
function dPill(j) {
  const cls = { waiting: '', skipped: '', running: 'warn', starting: 'warn', queued: '', paused: '', awaiting_approval: 'warn', done: 'ok', error: 'err', timeout: 'err', interrupted: 'err', rejected: 'err', cancelled: '' }[j.status] ?? '';
  return `<span class="pill ${cls}">${j.status === 'done' ? svg('check') : ''}${esc(D.status[j.status] || j.status)}${j.queuePos ? ` · #${j.queuePos}` : ''}</span>`;
}

// La petición llega como JSON: se muestra como "clave: valor" (y el comando tal cual si lo hay)
function apInput(raw) {
  let o; try { o = JSON.parse(raw); } catch { return raw; }
  if (o && typeof o === 'object') return Object.entries(o).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
  return String(o);
}
function renderDelegations() {
  const box = $('#delegations'); if (!box) return;
  const pending = D.approvals.filter((a) => a.status === 'pending');
  const review = D.jobs.filter((j) => j.review?.status === 'pending');
  const lists = { active: D.jobs.filter((j) => ACTIVE_ST.includes(j.status)), review, history: D.jobs.filter((j) => !ACTIVE_ST.includes(j.status)) };
  const items = lists[dFilter] || [];
  const st = D.settings;
  box.innerHTML = `
    <div class="dhead"><h2 class="section-title">Encargos entre agentes</h2>
      <div class="actions"><button class="btn" id="d-lib">${svg('note')}Roles y plantillas</button><button class="btn" id="d-settings">${svg('sliders')}Ajustes</button><button class="btn primary" id="d-new">${svg('plus')}Nuevo encargo</button></div></div>
    ${D.registered ? '' : `<div class="callout">${logo('agents', 36)}<span class="txt"><b>Deja que tus agentes se encarguen tareas entre ellos.</b> Se añade el servidor MCP <code>mcp-hub-agents</code> con <code>delegate</code>. Cada encargo se abre en una pestaña de Terminales y aparece aquí.</span><button class="btn primary sm" id="d-register">Conectar</button></div>`}
    ${pending.length ? `<div class="approvals">${pending.map((a) => { const j = D.jobs.find((x) => x.id === a.job); return `<div class="approval" data-ap="${a.id}">
        <div class="ap-head">${svg('bell')}<b>${esc(a.tool)}</b><span class="hint">encargo ${esc(a.job)}${j ? ` · ${esc(j.agentName)}` : ''} · ${dWhen(a.at)}</span></div>
        <pre>${esc(apInput(a.input))}</pre>
        <div class="ap-foot"><input class="field sm" placeholder="Nota (opcional)" data-note><button class="btn sm danger" data-dec="deny">Denegar</button><button class="btn sm primary" data-dec="allow">Aprobar</button></div>
      </div>`; }).join('')}</div>` : ''}
    <p class="hint dsum">Por defecto: <b>${esc(D.permissions[st.permission]?.label || st.permission)}</b> · ${esc(D.isolation[st.isolation] || st.isolation)}${st.timeoutMin ? ` · límite ${st.timeoutMin} min` : ''} · máx. ${st.maxRunning} a la vez${st.approveFull ? ' · aprobación antes de los encargos sin límites' : ''}</p>
    <div class="chips">${[['active', 'Activos'], ['review', 'Por revisar'], ['history', 'Historial'], ['sched', 'Programadas'], ['recipes', 'Recetas'], ['usage', 'Uso']].map(([k, l]) => `<button class="chip ${dFilter === k ? 'on' : ''}" data-df="${k}">${l}${lists[k]?.length ? ` · ${lists[k].length}` : ''}</button>`).join('')}</div>
    ${D.held ? `<div class="callout warn">${svg('pause')}<span class="txt"><b>Cola en pausa:</b> ${esc(D.held.reason)}. Los encargos en marcha siguen; los nuevos esperan.</span></div>` : ''}
    ${dFilter === 'usage' ? usageHtml() : dFilter === 'sched' ? schedHtml() : dFilter === 'recipes' ? recipesHtml() : items.length ? `<div class="jobs">${items.slice(0, 60).map(jobCard).join('')}</div>`
      : `<p class="sub">${{ active: 'No hay encargos en marcha ni en cola.', review: 'No hay cambios pendientes de revisar.', history: 'Todavía no hay encargos terminados.' }[dFilter]}</p>`}`;

  $('#d-register')?.addEventListener('click', registerDelegation);
  $('#d-settings').onclick = delegationSettings;
  $('#d-lib').onclick = manageLibrary;
  $('#s-new')?.addEventListener('click', () => editSchedule());
  $$('#delegations [data-rc]').forEach((b) => (b.onclick = async () => {
    const r = RECIPES.find((x) => x.id === b.closest('[data-rid]').dataset.rid);
    if (b.dataset.rc === 'run') return runRecipe(r);
    try { await api('/api/recipes/delete', { id: r.id }); toast('Receta borrada'); loadDelegations(); } catch (e) { toast(e.message, true); }
  }));
  $$('[data-ub]').forEach((b) => (b.onclick = () => { usageBy = b.dataset.ub; renderDelegations(); }));
  $$('#delegations [data-s]').forEach((b) => (b.onclick = async () => {
    const sc = SCHED.find((x) => x.id === b.closest('[data-sid]').dataset.sid);
    try {
      if (b.dataset.s === 'edit') return editSchedule(sc);
      if (b.dataset.s === 'toggle') await api('/api/schedules/toggle', { id: sc.id, enabled: !sc.enabled });
      if (b.dataset.s === 'run') { await api('/api/schedules/run', { id: sc.id }); toast('Lanzada ahora'); }
      if (b.dataset.s === 'job') { dFilter = 'history'; renderDelegations(); return; }
      loadDelegations();
    } catch (e) { toast(e.message, true); }
  }));
  $('#d-new').onclick = () => newJob();
  $$('#delegations [data-goto]').forEach((a) => (a.onclick = (e) => {
    e.preventDefault();
    const x = D.jobs.find((j) => j.id === a.dataset.goto); if (!x) return toast('Ese encargo ya no está en el historial', true);
    dFilter = ACTIVE_ST.includes(x.status) ? 'active' : 'history'; renderDelegations();
    const el = $(`#delegations [data-id="${x.id}"]`); if (el) { el.open = true; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1500); }
  }));
  $$('#delegations [data-df]').forEach((b) => (b.onclick = () => { dFilter = b.dataset.df; renderDelegations(); }));
  $$('#delegations [data-dec]').forEach((b) => (b.onclick = async () => {
    const el = b.closest('[data-ap]');
    try { await api('/api/approvals/decide', { id: el.dataset.ap, allow: b.dataset.dec === 'allow', note: el.querySelector('[data-note]').value }); toast(b.dataset.dec === 'allow' ? 'Aprobado' : 'Denegado'); loadDelegations(); }
    catch (e) { toast(e.message, true); }
  }));
  $$('#delegations [data-d]').forEach((b) => (b.onclick = async (e) => {
    e.preventDefault();
    const j = D.jobs.find((x) => x.id === b.closest('[data-id]').dataset.id);
    const act = b.dataset.d;
    try {
      if (act === 'open') { activeId = j.sessionId; show('terms'); syncTabs(); return; }
      if (act === 'chain') return newJob({ after: [j.id], cwd: j.cwd });
      if (act === 'recipe') return saveRecipe(j);
      if (act === 'pr') return createPr(j);
      if (act === 'review2') return askReview(j);
      if (act === 'diff') return showDiff(j);
      if (act === 'up' || act === 'down') await api('/api/delegations/priority', { id: j.id, priority: j.priority + (act === 'up' ? 1 : -1) });
      else if (act === 'apply' || act === 'keep' || act === 'discard') {
        if (act === 'discard') return confirmDiscard(j);
        await api('/api/delegations/review', { id: j.id, action: act });
        toast({ apply: 'Cambios aplicados a tu carpeta', keep: `Cambios guardados en la rama mcphub/encargo-${j.id}`, discard: 'Cambios descartados' }[act]);
      } else {
        await api(`/api/delegations/${act}`, { id: j.id, fresh: act === 'resume' && b.dataset.fresh === '1' });
        toast({ cancel: 'Encargo cancelado', pause: 'En pausa', unpause: 'De vuelta en la cola', resume: 'Encargo reanudado' }[act] || 'Hecho');
      }
      loadDelegations();
    } catch (err) { toast(err.message, true); }
  }));
}
function confirmDiscard(j) {
  modal(`<div class="mhead">${logo(j.agent, 40)}<div><small>Encargo ${esc(j.id)}</small><h2>¿Descartar los cambios?</h2></div></div>
    <p class="sub" style="margin-top:14px">Se borrará el entorno aislado con ${j.review?.files || 0} archivo(s) cambiado(s). Tu carpeta no se toca. No se puede deshacer.</p>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn danger" id="cd-ok">Descartar</button></div>`);
  $('#cd-ok').onclick = async () => { try { await api('/api/delegations/review', { id: j.id, action: 'discard' }); closeModal(); toast('Cambios descartados'); loadDelegations(); } catch (e) { toast(e.message, true); } };
}

function jobCard(j) {
  const act = [];
  if (j.status === 'running') act.push(['open', 'Ver'], ['cancel', 'Cancelar']);
  if (j.status === 'queued') act.push(['up', '↑'], ['down', '↓'], ['pause', 'Pausar'], ['cancel', 'Cancelar']);
  if (j.status === 'paused') act.push(['unpause', 'Reanudar en cola'], ['cancel', 'Cancelar']);
  if (j.status === 'awaiting_approval' || j.status === 'waiting') act.push(['cancel', 'Cancelar']);
  if (['interrupted', 'error', 'timeout', 'cancelled', 'skipped'].includes(j.status) && !(j.review && !['pending', 'empty'].includes(j.review.status))) act.push(['resume', j.sid ? 'Reanudar' : 'Reintentar']);
  if (j.review?.status === 'pending') act.push(['diff', 'Ver cambios'], ['apply', 'Aplicar'], ['keep', 'Conservar en rama'], ['discard', 'Descartar']);
  const rj = j.reviewJob && D.jobs.find((x) => x.id === j.reviewJob);
  if (j.kind !== 'review' && (j.status === 'done' || ACTIVE_ST.includes(j.status)) && !(rj && ACTIVE_ST.includes(rj.status))) act.push(['review2', rj ? 'Revisar otra vez' : 'Revisión independiente']);
  if (j.kind !== 'review') act.push(['chain', 'Encadenar otro']);
  if (j.status === 'done' && j.stepCount && !['review', 'synthesis', 'map', 'monitor'].includes(j.kind)) act.push(['recipe', 'Guardar como receta']);
  if (j.worktree && !j.pr && (j.review?.status === 'pending' || j.review?.status === 'kept')) act.push(['pr', 'Crear PR']);
  const u = j.usage;
  const rv = j.review;
  return `<details class="job" data-id="${j.id}" ${j.review?.status === 'pending' || j.status === 'awaiting_approval' ? 'open' : ''}>
    <summary>${logo(j.agent, 30)}<div class="meta"><b>${j.kind === 'review' ? 'Revisión · ' : j.kind === 'synthesis' ? 'Síntesis · ' : ''}${esc(j.agentName)} <span class="from">← ${esc(j.from)}</span></b><span>${esc(j.task.slice(0, 160))}</span></div>
      <span class="when">${dWhen(j.at)}${j.duration ? ' · ' + dDur(j.duration) : ''}</span>${j.verdict ? `<span class="pill ${VERDICT[j.verdict][0]}">${VERDICT[j.verdict][1]}</span>` : ''}${dPill(j)}</summary>
    <div class="job-body">
      <div class="jtags">${j.role ? `<span class="tag">rol: ${esc(j.role)}</span>` : ''}<span class="tag">${esc(D.permissions[j.permission]?.label || j.permission)}</span><span class="tag">${esc(D.isolation[j.isolation] || j.isolation)}</span>
        ${j.priority ? `<span class="tag">prioridad ${j.priority > 0 ? '+' : ''}${j.priority}</span>` : ''}
        ${j.limits?.minutes ? `<span class="tag">límite ${j.limits.minutes} min</span>` : ''}${j.limits?.maxTurns ? `<span class="tag">máx. ${j.limits.maxTurns} turnos</span>` : ''}
        ${j.limits?.budgetUsd ? `<span class="tag">máx. ${j.limits.budgetUsd} USD</span>` : ''}${j.attempts > 1 ? `<span class="tag">intento ${j.attempts}</span>` : ''}
        ${j.group ? `<span class="tag">en paralelo · grupo ${esc(j.group)} (${D.jobs.filter((x) => x.group === j.group).length})</span>` : ''}</div>
      ${j.after?.length ? `<div class="flabel">Después de${j.useResults ? ' (recibe sus respuestas)' : ''}</div><p class="deps">${j.after.map(jobRef).join('<br>')}${j.onDepFail !== 'skip' ? `<br><span class="hint">Si alguno falla: ${esc(D.onDepFail?.[j.onDepFail] || j.onDepFail)}</span>` : ''}</p>` : ''}
      ${j.reviewOf ? `<div class="flabel">Revisa</div><p class="deps">${jobRef(j.reviewOf)}</p>` : ''}
      ${j.reviewJob ? `<div class="flabel">Revisión independiente</div><p class="deps">${jobRef(j.reviewJob)}</p>` : ''}
      <div class="flabel">Tarea</div><pre>${esc(j.task)}</pre>
      ${j.result ? `<div class="flabel">Respuesta</div><pre>${esc(j.result)}</pre>` : ''}
      ${rv && rv.status !== 'error' ? `<div class="flabel">Cambios</div><p class="hint">${rv.files ? `${rv.files} archivo(s) · <span class="ok-t">+${rv.added}</span> <span class="err-t">−${rv.removed}</span>` : 'Sin cambios'}
        ${{ applied: ' · aplicados a tu carpeta', kept: ` · guardados en la rama <code>${esc(rv.branch || '')}</code>`, discarded: ' · descartados', pending: ' · pendientes de revisar', empty: '' }[rv.status] || ''}</p>` : ''}
      ${rv?.status === 'error' ? `<p class="errtxt">No se pudieron calcular los cambios: ${esc(rv.error)}</p>` : ''}
      ${u ? `<p class="hint">Uso informado por el agente: ${[u.turns != null && `${u.turns} turnos`, u.inputTokens != null && `${u.inputTokens.toLocaleString('es-ES')} tokens de entrada`, u.outputTokens != null && `${u.outputTokens.toLocaleString('es-ES')} de salida`, u.costUsd != null && `~${u.costUsd.toFixed(3)} USD (estimación)`].filter(Boolean).join(' · ')}</p>` : ''}
      ${(j.notes || []).length ? `<p class="hint">${j.notes.map(esc).join(' · ')}</p>` : ''}
      ${j.pr ? `<p class="hint">Pull request: <a href="${esc(j.pr.url)}" target="_blank" rel="noopener">${esc(j.pr.url)}</a></p>` : ''}
      ${j.meta?.url ? `<p class="hint">Origen: <a href="${esc(j.meta.url)}" target="_blank" rel="noopener">${esc(j.meta.url)}</a></p>` : ''}
      ${j.stepCount ? `<p class="hint">${j.stepCount} paso(s) grabado(s)</p>` : ''}
      <span class="hint mono">${esc(tilde(j.cwd))}${j.worktree && !j.worktree.removed ? ` → ${esc(tilde(j.worktree.dir))}` : ''}</span>
      ${act.length ? `<div class="jactions">${act.map(([k, l]) => `<button class="btn sm ${k === 'apply' ? 'primary' : k === 'discard' || k === 'cancel' ? 'danger' : ''}" data-d="${k}">${l}</button>`).join('')}
        ${['interrupted', 'error', 'timeout'].includes(j.status) && j.sid ? '<button class="btn sm" data-d="resume" data-fresh="1">Empezar de cero</button>' : ''}</div>` : ''}
    </div></details>`;
}

async function showDiff(j) {
  let d;
  try { d = await api(`/api/delegations/diff?id=${j.id}`); } catch (e) { return toast(e.message, true); }
  const lines = d.patch.split('\n').map((l) => {
    const c = l.startsWith('+++') || l.startsWith('---') ? 'f' : l.startsWith('+') ? 'a' : l.startsWith('-') ? 'r' : l.startsWith('@@') ? 'h' : l.startsWith('diff ') ? 'd' : '';
    return `<div class="dl ${c}">${esc(l) || ' '}</div>`;
  }).join('');
  modal(`<div class="mhead">${logo(j.agent, 40)}<div><small>Cambios del encargo ${esc(j.id)}</small><h2>${d.files} archivo(s) · +${d.added} −${d.removed}</h2></div></div>
    <div class="dfiles">${d.list.map((f) => `<span><code>${esc(f.file)}</code> <span class="ok-t">+${f.add}</span> <span class="err-t">−${f.del}</span></span>`).join('')}</div>
    <div class="diffbox">${lines || '<p class="hint">Sin cambios.</p>'}</div>
    <div class="mfoot"><button class="btn danger" id="dv-discard">Descartar</button><button class="btn" id="dv-keep">Conservar en rama</button><button class="btn primary" id="dv-apply">Aplicar a mi carpeta</button></div>`, { sheet: true });
  for (const act of ['apply', 'keep', 'discard']) {
    $(`#dv-${act}`).onclick = async () => {
      try { await api('/api/delegations/review', { id: j.id, action: act }); closeModal(); toast({ apply: 'Cambios aplicados a tu carpeta', keep: `Guardados en la rama mcphub/encargo-${j.id}`, discard: 'Cambios descartados' }[act]); loadDelegations(); }
      catch (e) { toast(e.message, true); }
    };
  }
}

function askReview(j) {
  const agents = D.agents.filter((a) => a.installed);
  const def = ['claude', 'codex', 'gemini', 'opencode', 'cursor'].find((a) => a !== j.agent && agents.some((x) => x.id === a)) || j.agent;
  modal(`<div class="mhead">${logo(j.agent, 40)}<div><small>Encargo ${esc(j.id)}</small><h2>Revisión independiente</h2></div></div>
    <p class="sub" style="margin-top:10px">Otro agente revisa el resultado con permisos de solo lectura${j.worktree && !j.worktree.removed ? ' y ve el diff de la copia aislada' : ''}, busca fallos y da un veredicto. Aparece como un encargo más.</p>
    <div class="form"><div class="row"><label>Revisor<select id="rv-agent" class="field">${agents.map((a) => `<option value="${a.id}" ${a.id === def ? 'selected' : ''}>${esc(a.name)}${a.id === j.agent ? ' (el mismo que lo hizo)' : ''}</option>`).join('')}</select></label>
      <label>Modelo <span class="hint">opcional</span><input id="rv-model" class="field mono" placeholder="por defecto"></label></div></div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="rv-ok">Pedir revisión</button></div>`);
  $('#rv-ok').onclick = async () => {
    try { await api('/api/delegations/request-review', { id: j.id, agent: $('#rv-agent').value, model: $('#rv-model').value.trim() }); closeModal(); toast('Revisión pedida'); dFilter = 'active'; loadDelegations(); }
    catch (e) { toast(e.message, true); }
  };
}

// ---------------- Recetas (grabar y repetir) ----------------
function recipesHtml() {
  if (!RECIPES.length) return '<p class="sub">Todavía no hay recetas. En un encargo terminado, pulsa <b>Guardar como receta</b>: se guardan la tarea y los pasos que dio el agente (comandos, archivos, herramientas) para repetirlo en otro proyecto.</p>';
  return `<div class="jobs">${RECIPES.map((r) => `<div class="card recipe" data-rid="${r.id}"><div class="head">${logo(r.agent, 30)}<div><b>${esc(r.name)}</b><small>${r.stepCount} paso(s) · de ${esc(tilde(r.fromCwd))} · usada ${r.runs || 0} vez/veces</small></div></div>
    <ol class="steps">${r.preview.map((s) => `<li><b>${esc(s.tool)}</b> <span class="mono">${esc(s.detail.slice(0, 110))}</span></li>`).join('')}${r.stepCount > r.preview.length ? `<li class="hint">… y ${r.stepCount - r.preview.length} más</li>` : ''}</ol>
    <div class="jactions"><button class="btn sm primary" data-rc="run">Repetir en otro proyecto</button><button class="btn sm danger" data-rc="del">Borrar</button></div></div>`).join('')}</div>`;
}
async function saveRecipe(j) {
  let steps = [];
  try { steps = (await api(`/api/delegations/steps?id=${j.id}`)).steps; } catch {}
  modal(`<div class="mhead">${logo(j.agent, 40)}<div><small>Encargo ${esc(j.id)}</small><h2>Guardar como receta</h2></div></div>
    <div class="form"><label>Nombre<input id="rs-name" class="field" value="${esc(j.task.replace(/\s+/g, ' ').slice(0, 60))}"></label>
      <div class="flabel">Pasos grabados (${steps.length})</div><ol class="steps scroll">${steps.slice(0, 80).map((s) => `<li><b>${esc(s.tool)}</b> <span class="mono">${esc(s.detail.slice(0, 120))}</span></li>`).join('')}</ol>
      <span class="hint">Al repetirla, otro agente recibe la tarea, estos pasos y el resumen, y los adapta al nuevo proyecto (no los copia a ciegas).</span></div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="rs-ok">Guardar</button></div>`);
  $('#rs-ok').onclick = async () => { try { await api('/api/recipes/save', { job: j.id, name: $('#rs-name').value }); closeModal(); toast('Receta guardada'); dFilter = 'recipes'; loadDelegations(); } catch (e) { toast(e.message, true); } };
}
function runRecipe(r) {
  const agents = D.agents.filter((a) => a.installed);
  modal(`<div class="mhead">${logo(r.agent, 40)}<div><small>Receta</small><h2>${esc(r.name)}</h2></div></div>
    <div class="form"><label>Carpeta donde repetirla<input id="rr-cwd" class="field mono" list="rr-dirs" value="${esc(tilde(D.recentDirs?.[0] || S.home))}"><datalist id="rr-dirs">${(D.recentDirs || []).map((d) => `<option value="${esc(tilde(d))}">`).join('')}</datalist></label>
      <div class="row"><label>Agente<select id="rr-agent" class="field">${agents.map((a) => `<option value="${a.id}" ${a.id === r.agent ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label><label>Modelo<input id="rr-model" class="field mono" value="${esc(r.model || '')}" placeholder="por defecto"></label></div>
      <div class="row"><label>Permisos<select id="rr-perm" class="field">${permOptions(r.permission)}</select></label><label>Dónde trabaja<select id="rr-iso" class="field">${isoOptions(r.isolation)}</select></label></div>
      <label>Indicaciones para esta vez <span class="hint">opcional</span><textarea id="rr-notes" class="field" rows="2"></textarea></label>
      <label>Revisión independiente al terminar<select id="rr-review" class="field"><option value="">No</option><option value="auto">Otro agente (automático)</option></select></label></div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="rr-ok">${svg('play')}Repetir</button></div>`);
  $('#rr-ok').onclick = async () => {
    try { await api('/api/recipes/run', { id: r.id, cwd: $('#rr-cwd').value.trim().replace(/^~(?=$|\/)/, S.home), agent: $('#rr-agent').value, model: $('#rr-model').value.trim() || null,
      permission: $('#rr-perm').value, isolation: $('#rr-iso').value, notes: $('#rr-notes').value, reviewWith: $('#rr-review').value || undefined });
      closeModal(); toast('Encargo creado desde la receta'); dFilter = 'active'; loadDelegations(); } catch (e) { toast(e.message, true); }
  };
}

const permOptions = (sel) => Object.entries(D.permissions).map(([k, p]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(p.label)}</option>`).join('');
const isoOptions = (sel) => Object.entries(D.isolation).map(([k, l]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(l)}</option>`).join('');

// Encargos de los que puede depender uno nuevo: los activos y los 15 últimos terminados bien
const depCandidates = (pre = []) => D.jobs.filter((x) => pre.includes(x.id) || ACTIVE_ST.includes(x.status)).concat(D.jobs.filter((x) => x.status === 'done' && !pre.includes(x.id)).slice(0, 15));
function newJob(preset = {}) {
  const st = D.settings;
  const agents = D.agents.filter((a) => a.installed);
  modal(`<div class="mhead">${logo('agents', 44)}<div><small>Encargos</small><h2>Nuevo encargo</h2></div></div>
    <div class="form">
      <div class="row"><label>Plantilla<select id="nj-tpl" class="field"><option value="">— Sin plantilla —</option>${LIB.templates.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label>
        <label>Rol<select id="nj-role" class="field"><option value="">— Sin rol —</option>${LIB.roles.map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select></label></div>
      <span class="hint" id="nj-role-desc"></span>
      <div id="nj-fields" class="form" style="margin:0"></div>
      <div class="seg" id="nj-mode"><button type="button" class="on" data-m="one">Un agente</button><button type="button" data-m="many">Varios en paralelo</button></div>
      <div class="row" id="nj-one"><label>Agente<select id="nj-agent" class="field">${agents.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label>
        <label>Modelo <span class="hint">opcional</span><input id="nj-model" class="field mono" placeholder="por defecto"></label></div>
      <div id="nj-many" class="form" style="margin:0" hidden>
        <div class="agpick">${agents.map((a) => `<label class="check"><input type="checkbox" value="${a.id}" data-ag>${esc(a.name)}<input class="field sm mono" data-agm="${a.id}" placeholder="modelo"></label>`).join('')}</div>
        <label>Reunir y comparar las respuestas con<select id="nj-synth" class="field"><option value="">— No reunirlas —</option>${agents.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label>
        <span class="hint">Cada agente hace la misma tarea por separado. Si van a editar la misma carpeta, elige "Entorno aislado" para que no se pisen.</span>
      </div>
      <label>Carpeta<input id="nj-cwd" class="field mono" list="nj-dirs" value="${esc(tilde(preset.cwd || D.recentDirs?.[0] || S.home))}"><datalist id="nj-dirs">${(D.recentDirs || []).map((d) => `<option value="${esc(tilde(d))}">`).join('')}</datalist></label>
      <label><span id="nj-task-l">Tarea</span><textarea id="nj-task" class="field" rows="5" placeholder="Qué tiene que hacer, con todo el contexto: el agente no ve ninguna conversación.">${esc(preset.task || '')}</textarea></label>
      <div class="row"><label>Permisos<select id="nj-perm" class="field">${permOptions(st.permission)}</select></label><label>Dónde trabaja<select id="nj-iso" class="field">${isoOptions(st.isolation)}</select></label></div>
      <span class="hint" id="nj-perm-desc"></span>
      <div class="row"><label>Límite (min)<input id="nj-time" class="field" type="number" min="0" value="${st.timeoutMin || ''}" placeholder="sin límite"></label>
        <label>Máx. turnos <span class="hint">Claude</span><input id="nj-turns" class="field" type="number" min="0" placeholder="—"></label>
        <label>Máx. USD <span class="hint">Claude</span><input id="nj-usd" class="field" type="number" min="0" step="0.1" placeholder="—"></label>
        <label>Prioridad<input id="nj-prio" class="field" type="number" min="-10" max="10" value="0"></label></div>
      <label>Revisión independiente al terminar<select id="nj-review" class="field"><option value="">— No —</option><option value="auto">Otro agente (automático)</option>${agents.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></label>
      <details class="njdeps" ${preset.after?.length ? 'open' : ''}><summary>Esperar a otros encargos${preset.after?.length ? ` · ${preset.after.length}` : ''}</summary><div class="njdeps-in">
        ${depCandidates(preset.after).length ? `<div class="deplist">${depCandidates(preset.after).map((x) => `<label class="check"><input type="checkbox" value="${x.id}" data-dep ${preset.after?.includes(x.id) ? 'checked' : ''}>#${esc(x.id)} · ${esc(x.agentName)} · <span class="hint">${esc(D.status[x.status] || x.status)}</span><small>${esc(x.task.slice(0, 90))}</small></label>`).join('')}</div>
        <div class="row"><label>Si alguno falla<select id="nj-depfail" class="field">${Object.entries(D.onDepFail || {}).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></label></div>
        <label class="check" style="align-self:flex-start"><input type="checkbox" id="nj-useres" checked>Añadir sus respuestas a la tarea${tick}</label>
        <span class="hint">Empieza cuando terminen. Si alguno trabajó aislado en el mismo repositorio y aislas también este, parte de sus cambios.</span>` : '<p class="hint">No hay encargos recientes de los que depender.</p>'}
      </div></details>
      <label class="check" style="align-self:flex-start"><input type="checkbox" id="nj-approve">Pedir mi aprobación antes de empezar${tick}</label>
    </div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="nj-ok">${svg('play')}Encargar</button></div>`);
  let mode = 'one';
  $$('#nj-mode [data-m]').forEach((b) => (b.onclick = () => {
    mode = b.dataset.m;
    $$('#nj-mode [data-m]').forEach((x) => x.classList.toggle('on', x === b));
    $('#nj-one').style.display = mode === 'one' ? '' : 'none'; $('#nj-many').hidden = mode !== 'many';
  }));
  const desc = () => { $('#nj-perm-desc').textContent = D.permissions[$('#nj-perm').value]?.desc || ''; };
  $('#nj-perm').onchange = desc; desc();
  const applyRole = () => {
    const r = LIB.roles.find((x) => x.id === $('#nj-role').value);
    $('#nj-role-desc').textContent = r ? `${r.desc} Sus instrucciones se añaden delante de la tarea.` : '';
    if (!r) return;
    if (r.agent && agents.some((a) => a.id === r.agent)) $('#nj-agent').value = r.agent;
    if (r.model) $('#nj-model').value = r.model;
    if (r.permission) $('#nj-perm').value = r.permission;
    if (r.isolation) $('#nj-iso').value = r.isolation;
    if (r.timeoutMin) $('#nj-time').value = r.timeoutMin;
    if (r.maxTurns) $('#nj-turns').value = r.maxTurns;
    desc();
  };
  $('#nj-role').onchange = applyRole;
  const fieldsOf = (t) => [...new Set([...t.text.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1].trim()))];
  $('#nj-tpl').onchange = () => {
    const t = LIB.templates.find((x) => x.id === $('#nj-tpl').value);
    $('#nj-fields').innerHTML = t ? fieldsOf(t).map((f, i) => `<label>${esc(f)}<textarea class="field" rows="2" data-field="${i}"></textarea></label>`).join('') : '';
    $('#nj-task-l').textContent = t ? 'Notas adicionales (opcional)' : 'Tarea';
    if (t?.role) { $('#nj-role').value = t.role; applyRole(); }
  };
  const composeTask = () => {
    const t = LIB.templates.find((x) => x.id === $('#nj-tpl').value);
    if (!t) return $('#nj-task').value;
    const vals = $$('#nj-fields [data-field]').map((x) => x.value.trim());
    const names = fieldsOf(t);
    let text = t.text.replace(/\{\{([^}]+)\}\}/g, (_, k) => vals[names.indexOf(k.trim())] || '(sin indicar)');
    if ($('#nj-task').value.trim()) text += `\n\nNotas: ${$('#nj-task').value.trim()}`;
    return text;
  };
  $('#nj-ok').onclick = async (e) => {
    const many = mode === 'many' ? $$('#nj-many [data-ag]:checked').map((x) => ({ agent: x.value, model: $(`#nj-many [data-agm="${x.value}"]`).value.trim() || null })) : null;
    if (many && many.length < 2) return toast('Elige al menos dos agentes', true);
    e.target.disabled = true;
    try {
      const r = await api('/api/delegations/create', { role: $('#nj-role').value || undefined, agent: many ? undefined : $('#nj-agent').value, model: many ? undefined : $('#nj-model').value.trim(),
        agents: many || undefined, synthesize: many ? $('#nj-synth').value || null : undefined, cwd: $('#nj-cwd').value.trim(), task: composeTask(),
        permission: $('#nj-perm').value, isolation: $('#nj-iso').value, timeoutMin: $('#nj-time').value, maxTurns: $('#nj-turns').value, budgetUsd: $('#nj-usd').value,
        priority: $('#nj-prio').value, requireApproval: $('#nj-approve').checked, reviewWith: $('#nj-review').value || undefined,
        after: $$('.njdeps [data-dep]:checked').map((x) => x.value), onDepFail: $('#nj-depfail')?.value, useResults: $('#nj-useres') ? $('#nj-useres').checked : undefined });
      closeModal(); dFilter = 'active'; toast(r.group ? `${r.jobs.length} encargos en paralelo creados${r.synth ? ' + síntesis' : ''}` : 'Encargo creado'); loadDelegations();
    } catch (err) { toast(err.message, true); e.target.disabled = false; }
  };
}

function delegationSettings() {
  const st = D.settings;
  modal(`<div class="mhead">${logo('agents', 44)}<div><small>Encargos</small><h2>Ajustes por defecto</h2></div></div>
    <p class="sub" style="margin-top:10px">Se aplican a los encargos que hagan tus agentes (y a los nuevos que crees) cuando no indiquen otra cosa.</p>
    <div class="form">
      <label>Permisos<select id="ds-perm" class="field">${permOptions(st.permission)}</select></label>
      <span class="hint" id="ds-perm-desc"></span>
      <label>Dónde trabajan<select id="ds-iso" class="field">${isoOptions(st.isolation)}</select></label>
      <span class="hint">Con el entorno aislado, el agente trabaja en una copia del repositorio git y tú revisas los cambios antes de aplicarlos. Solo funciona en carpetas con git.</span>
      <div class="row"><label>Límite de tiempo (min, 0 = sin límite)<input id="ds-time" class="field" type="number" min="0" value="${st.timeoutMin}"></label>
        <label>Máx. a la vez<input id="ds-max" class="field" type="number" min="1" max="12" value="${st.maxRunning}"></label></div>
      <label class="check" style="align-self:flex-start"><input type="checkbox" id="ds-approve" ${st.approveFull ? 'checked' : ''}>Pedir mi aprobación antes de empezar cualquier encargo "Sin límites"${tick}</label>
    </div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="ds-ok">Guardar</button></div>`);
  const desc = () => { $('#ds-perm-desc').textContent = D.permissions[$('#ds-perm').value]?.desc || ''; };
  $('#ds-perm').onchange = desc; desc();
  $('#ds-ok').onclick = async () => {
    try { await api('/api/delegations/settings', { permission: $('#ds-perm').value, isolation: $('#ds-iso').value, timeoutMin: $('#ds-time').value, maxRunning: $('#ds-max').value, approveFull: $('#ds-approve').checked }); closeModal(); toast('Ajustes guardados'); loadDelegations(); }
    catch (e) { toast(e.message, true); }
  };
}

function registerDelegation() {
  const cur = S.servers['mcp-hub-agents']?.targets;
  modal(`<div class="mhead">${logo('agents', 44)}<div><small>Servidor MCP</small><h2>Encargos entre agentes</h2></div></div>
    <p class="sub" style="margin-top:12px">Añade <code>mcp-hub-agents</code> a los agentes que elijas. Podrán encargar tareas a cualquier otro agente instalado con <code>delegate</code> y recibir la respuesta, con los permisos y el aislamiento que configures.</p>
    <div class="form"><div class="flabel">Pueden hacer encargos${targetsChecks(cur || null)}</div>
    <span class="hint">MCP Hub tiene que estar abierto. Cada encargo aparece como una pestaña “↳” en Terminales.</span></div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="dr-ok">Conectar</button></div>`);
  $('#dr-ok').onclick = async () => {
    try { reportErrors((await api('/api/delegations/register', { targets: readTargets() })).errors) && toast('Encargos conectados'); closeModal(); await refresh(); loadDelegations(); }
    catch (e) { toast(e.message, true); }
  };
}


// ---------------- Uso agregado ----------------
function usageHtml() {
  const done = D.jobs.filter((j) => !ACTIVE_ST.includes(j.status));
  if (!done.length) return '<p class="sub">Todavía no hay encargos terminados.</p>';
  const groups = {};
  for (const j of done) {
    const k = usageBy === 'folder' ? tilde(j.cwd) : `${j.agentName}${j.model ? ' · ' + j.model : ''}`;
    const g = (groups[k] ||= { agent: j.agent, n: 0, ok: 0, ms: 0, msN: 0, cost: 0, costN: 0, turns: 0, turnsN: 0, folders: new Set() });
    g.n++; if (j.status === 'done') g.ok++;
    if (j.duration) { g.ms += j.duration; g.msN++; }
    if (j.usage?.costUsd != null) { g.cost += j.usage.costUsd; g.costN++; }
    if (j.usage?.turns != null) { g.turns += j.usage.turns; g.turnsN++; }
    g.folders.add(j.cwd);
  }
  return `<div class="seg usage-by"><button data-ub="agent" class="${usageBy === 'agent' ? 'on' : ''}">Por agente y modelo</button><button data-ub="folder" class="${usageBy === 'folder' ? 'on' : ''}">Por proyecto</button></div>
    <div class="table usage"><div class="urow head"><span>${usageBy === 'folder' ? 'Carpeta' : 'Agente · modelo'}</span><span>Encargos</span><span>Éxito</span><span>Duración media</span><span>Turnos medios</span><span>Coste estimado</span></div>
    ${Object.entries(groups).sort((a, b) => b[1].n - a[1].n).map(([k, g]) => `<div class="urow"><span>${usageBy === 'folder' ? svg('folder') : logo(g.agent, 18, { plain: true })} ${esc(k)}</span><span>${g.n}</span><span>${Math.round((g.ok / g.n) * 100)}%</span>
      <span>${g.msN ? dDur(g.ms / g.msN) : '—'}</span><span>${g.turnsN ? (g.turns / g.turnsN).toFixed(1) : '—'}</span><span>${g.costN ? `~${g.cost.toFixed(3)} USD${g.costN < g.n ? ` <span class="hint">(${g.costN} de ${g.n})</span>` : ''}` : '—'}</span></div>`).join('')}</div>
    <p class="hint">Calculado con los últimos ${done.length} encargos guardados. La duración la mide MCP Hub; los turnos y el coste son los que informa cada agente (el coste solo lo da Claude Code y es su estimación, también con suscripción).</p>`;
}

// ---------------- Roles y plantillas ----------------
function manageLibrary() {
  modal(`<div class="mhead">${logo('agents', 40)}<div><small>Encargos</small><h2>Roles y plantillas</h2></div><button class="btn icon sm" data-close aria-label="Cerrar">${svg('x')}</button></div>
    <p class="sub" style="margin-top:8px">Un <b>rol</b> añade instrucciones y valores por defecto (agente, permisos, aislamiento, límites). Una <b>plantilla</b> es un encargo con campos {{así}} que rellenas al usarla. Los agentes pueden usar los roles con <code>delegate</code> (parámetro <code>role</code>).</p>
    <div class="flabel" style="margin-top:14px">Roles</div>
    <div class="libl">${LIB.roles.map((r) => `<div class="libi"><div><b>${esc(r.name)}</b> <code>${esc(r.id)}</code><span class="hint">${esc(r.desc || '')}</span></div><button class="btn sm" data-role="${esc(r.id)}">Editar</button></div>`).join('')}
      <button class="btn sm" data-role="">${svg('plus')}Nuevo rol</button></div>
    <div class="flabel" style="margin-top:14px">Plantillas</div>
    <div class="libl">${LIB.templates.map((t) => `<div class="libi"><div><b>${esc(t.name)}</b>${t.role ? ` <span class="tag">${esc(LIB.roles.find((r) => r.id === t.role)?.name || t.role)}</span>` : ''}<span class="hint">${esc(t.text.slice(0, 120))}</span></div><button class="btn sm" data-tpl="${esc(t.id)}">Editar</button></div>`).join('')}
      <button class="btn sm" data-tpl="">${svg('plus')}Nueva plantilla</button></div>`, { sheet: true });
  $$('#modal [data-role]').forEach((b) => (b.onclick = () => editRole(LIB.roles.find((r) => r.id === b.dataset.role))));
  $$('#modal [data-tpl]').forEach((b) => (b.onclick = () => editTemplate(LIB.templates.find((t) => t.id === b.dataset.tpl))));
}
function editRole(r = {}) {
  const agents = D.agents.filter((a) => a.installed);
  modal(`<div class="mhead">${logo('agents', 40)}<div><small>Rol</small><h2>${esc(r.name || 'Nuevo rol')}</h2></div></div>
    <div class="form">
      <div class="row"><label>Nombre<input id="er-name" class="field" value="${esc(r.name || '')}"></label><label>Descripción<input id="er-desc" class="field" value="${esc(r.desc || '')}"></label></div>
      <label>Instrucciones <span class="hint">se añaden delante de cada encargo con este rol</span><textarea id="er-ins" class="field" rows="6">${esc(r.instructions || '')}</textarea></label>
      <div class="row"><label>Agente<select id="er-agent" class="field"><option value="">El que elija quien encarga</option>${agents.map((a) => `<option value="${a.id}" ${r.agent === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
        <label>Modelo<input id="er-model" class="field mono" value="${esc(r.model || '')}" placeholder="por defecto"></label></div>
      <div class="row"><label>Permisos<select id="er-perm" class="field"><option value="">Los de por defecto</option>${permOptions(r.permission)}</select></label>
        <label>Dónde trabaja<select id="er-iso" class="field"><option value="">Por defecto</option>${isoOptions(r.isolation)}</select></label></div>
      <div class="row"><label>Límite (min)<input id="er-time" class="field" type="number" min="0" value="${r.timeoutMin || ''}"></label><label>Máx. turnos <span class="hint">Claude</span><input id="er-turns" class="field" type="number" min="0" value="${r.maxTurns || ''}"></label></div>
    </div>
    <div class="mfoot">${r.id ? '<button class="btn danger" id="er-del">Eliminar</button>' : ''}<span style="flex:1"></span><button class="btn" id="er-back">Volver</button><button class="btn primary" id="er-ok">Guardar</button></div>`);
  if (!r.permission) $('#er-perm').value = '';
  if (!r.isolation) $('#er-iso').value = '';
  $('#er-back').onclick = manageLibrary;
  $('#er-del')?.addEventListener('click', async () => { await api('/api/library/role/delete', { id: r.id }); LIB = await api('/api/library'); manageLibrary(); });
  $('#er-ok').onclick = async () => {
    try {
      await api('/api/library/role', { id: r.id, name: $('#er-name').value, desc: $('#er-desc').value, instructions: $('#er-ins').value, agent: $('#er-agent').value || null,
        model: $('#er-model').value.trim() || null, permission: $('#er-perm').value || null, isolation: $('#er-iso').value || null, timeoutMin: $('#er-time').value || null, maxTurns: $('#er-turns').value || null });
      LIB = await api('/api/library'); toast('Rol guardado'); manageLibrary();
    } catch (e) { toast(e.message, true); }
  };
}
function editTemplate(t = {}) {
  modal(`<div class="mhead">${logo('agents', 40)}<div><small>Plantilla</small><h2>${esc(t.name || 'Nueva plantilla')}</h2></div></div>
    <div class="form">
      <div class="row"><label>Nombre<input id="et-name" class="field" value="${esc(t.name || '')}"></label>
        <label>Rol<select id="et-role" class="field"><option value="">— Sin rol —</option>${LIB.roles.map((r) => `<option value="${esc(r.id)}" ${t.role === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label></div>
      <label>Texto <span class="hint">usa {{nombre del campo}} para lo que se rellena al usarla</span><textarea id="et-text" class="field mono" rows="8">${esc(t.text || '')}</textarea></label>
    </div>
    <div class="mfoot">${t.id ? '<button class="btn danger" id="et-del">Eliminar</button>' : ''}<span style="flex:1"></span><button class="btn" id="et-back">Volver</button><button class="btn primary" id="et-ok">Guardar</button></div>`);
  $('#et-back').onclick = manageLibrary;
  $('#et-del')?.addEventListener('click', async () => { await api('/api/library/template/delete', { id: t.id }); LIB = await api('/api/library'); manageLibrary(); });
  $('#et-ok').onclick = async () => {
    try { await api('/api/library/template', { id: t.id, name: $('#et-name').value, text: $('#et-text').value, role: $('#et-role').value || null }); LIB = await api('/api/library'); toast('Plantilla guardada'); manageLibrary(); }
    catch (e) { toast(e.message, true); }
  };
}

// ---------------- Tareas programadas ----------------
function schedHtml() {
  const rows = SCHED.map((x) => {
    const lj = x.lastJob && D.jobs.find((j) => j.id === x.lastJob);
    return `<div class="libi" data-sid="${x.id}"><div><b>${esc(x.name)}</b> <span class="tag">${esc(x.whenText)}</span>
      <span class="hint">${esc(D.agents.find((a) => a.id === x.job.agent)?.name || x.job.agent)}${x.job.role ? ` · rol ${esc(x.job.role)}` : ''} · ${esc(tilde(x.job.cwd))} ·
        ${x.enabled ? `próxima: ${dWhen(x.next)}` : 'desactivada'}${x.lastRun ? ` · última: ${dWhen(x.lastRun)}${lj ? ` (${esc(D.status[lj.status] || lj.status)})` : ''}` : ''}${x.lastError ? ` · <span class="err-t">${esc(x.lastError)}</span>` : ''}${x.avoidBusy ? ' · espera si estás ocupado' : ''}${x.postponed ? ` · aplazada por "${esc(x.postponed.reason)}"` : ''}</span></div>
      <button class="sw" aria-pressed="${x.enabled}" aria-label="Activar ${esc(x.name)}" data-s="toggle"><span class="track"><span class="knob"></span></span></button>
      <button class="btn sm" data-s="run">Lanzar ahora</button><button class="btn sm" data-s="edit">Editar</button></div>`;
  }).join('');
  return `<div class="libl">${rows || '<p class="sub">No hay tareas programadas.</p>'}<button class="btn sm primary" id="s-new">${svg('plus')}Nueva tarea programada</button></div>
    <p class="hint">Se lanzan como encargos normales (cola, permisos, aislamiento, aprobaciones y límites). Si MCP Hub está apagado a esa hora, esa ejecución se salta.</p>`;
}
function editSchedule(x = { when: { kind: 'daily', time: '09:00', days: [1, 2, 3, 4, 5] }, job: {}, enabled: true }) {
  const agents = D.agents.filter((a) => a.installed), j = x.job, st = D.settings;
  let kind = x.when.kind;
  modal(`<div class="mhead">${logo('agents', 40)}<div><small>Tarea programada</small><h2>${esc(x.name || 'Nueva tarea programada')}</h2></div></div>
    <div class="form">
      <label>Nombre<input id="sc-name" class="field" value="${esc(x.name || '')}" placeholder="Revisión diaria de dependencias"></label>
      <div class="seg" id="sc-kind"><button type="button" data-k="daily">A una hora</button><button type="button" data-k="interval">Cada cierto tiempo</button></div>
      <div class="row" data-k="daily"><label>Hora<input id="sc-time" class="field" type="time" value="${esc(x.when.time || '09:00')}"></label>
        <div class="flabel">Días<div class="checks">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((l, i) => { const d = (i + 1) % 7; return `<label class="check"><input type="checkbox" value="${d}" ${(x.when.days || []).includes(d) ? 'checked' : ''}>${l}${tick}</label>`; }).join('')}</div></div></div>
      <label data-k="interval">Cada (minutos, mínimo 5)<input id="sc-min" class="field" type="number" min="5" value="${x.when.minutes || 60}"></label>
      <div class="row"><label>Rol<select id="sc-role" class="field"><option value="">— Sin rol —</option>${LIB.roles.map((r) => `<option value="${esc(r.id)}" ${j.role === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
        <label>Agente<select id="sc-agent" class="field">${agents.map((a) => `<option value="${a.id}" ${j.agent === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
        <label>Modelo<input id="sc-model" class="field mono" value="${esc(j.model || '')}" placeholder="por defecto"></label></div>
      <label>Carpeta<input id="sc-cwd" class="field mono" value="${esc(tilde(j.cwd || D.recentDirs?.[0] || S.home))}"></label>
      <label>Tarea<textarea id="sc-task" class="field" rows="4">${esc(j.task || '')}</textarea></label>
      <div class="row"><label>Permisos<select id="sc-perm" class="field">${permOptions(j.permission || st.permission)}</select></label><label>Dónde trabaja<select id="sc-iso" class="field">${isoOptions(j.isolation || st.isolation)}</select></label>
        <label>Límite (min)<input id="sc-time-lim" class="field" type="number" min="0" value="${j.timeoutMin ?? st.timeoutMin ?? ''}"></label></div>
      <label class="check" style="align-self:flex-start"><input type="checkbox" id="sc-busy" ${x.avoidBusy ? 'checked' : ''}>Si a esa hora estoy ocupado en el calendario, esperar a que termine${tick}</label>
    </div>
    <div class="mfoot">${x.id ? '<button class="btn danger" id="sc-del">Eliminar</button>' : ''}<span style="flex:1"></span><button class="btn" data-close>Cancelar</button><button class="btn primary" id="sc-ok">Guardar</button></div>`);
  const sync = () => { $$('#sc-kind button').forEach((b) => b.classList.toggle('on', b.dataset.k === kind)); $$('#modal [data-k]:not(button)').forEach((el) => (el.style.display = el.dataset.k === kind ? '' : 'none')); };
  $$('#sc-kind button').forEach((b) => (b.onclick = () => { kind = b.dataset.k; sync(); })); sync();
  $('#sc-del')?.addEventListener('click', async () => { await api('/api/schedules/delete', { id: x.id }); closeModal(); loadDelegations(); });
  $('#sc-ok').onclick = async () => {
    const when = kind === 'daily' ? { kind, time: $('#sc-time').value, days: $$('#modal .checks input:checked').map((i) => Number(i.value)) } : { kind, minutes: Number($('#sc-min').value) };
    try {
      await api('/api/schedules/save', { id: x.id, name: $('#sc-name').value, enabled: x.enabled, avoidBusy: $('#sc-busy').checked, when, job: { role: $('#sc-role').value || undefined, agent: $('#sc-agent').value,
        model: $('#sc-model').value.trim() || undefined, cwd: $('#sc-cwd').value.trim(), task: $('#sc-task').value, permission: $('#sc-perm').value, isolation: $('#sc-iso').value,
        timeoutMin: $('#sc-time-lim').value === '' ? undefined : Number($('#sc-time-lim').value) } });
      closeModal(); toast('Tarea programada guardada'); dFilter = 'sched'; loadDelegations();
    } catch (e) { toast(e.message, true); }
  };
}

loadDelegations();
