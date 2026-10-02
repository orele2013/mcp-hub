'use strict';
// Chat unificado (@claude, @codex, @gemini… en el mismo hilo) y debates entre agentes con juez.
const CHT = { threads: [], agents: [], cur: null, thread: null, showList: true };
const PERM_CHAT = { read: 'Solo lectura', edit: 'Puede editar archivos', full: 'Sin límites' };

// Markdown mínimo y seguro: bloques de código, código en línea, negrita, listas y enlaces
function chatMd(src) {
  const parts = String(src || '').split(/```(\w*)\n?([\s\S]*?)```/g);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 1) continue;
    if (i % 3 === 2) { out += `<pre class="md-code">${esc(parts[i].replace(/\n$/, ''))}</pre>`; continue; }
    out += esc(parts[i])
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/^#{1,4} (.+)$/gm, '<b class="md-h">$1</b>')
      .replace(/^\s*[-*] (.+)$/gm, '• $1')
      .replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, '<br>');
  }
  return out;
}

async function loadChat() {
  try { ({ threads: CHT.threads, agents: CHT.agents } = await api('/api/chats')); } catch (e) { return toast(e.message, true); }
  if (CHT.cur && !CHT.threads.some((t) => t.id === CHT.cur)) CHT.cur = null;
  if (CHT.cur) { try { CHT.thread = await api(`/api/chats/thread?id=${CHT.cur}`); } catch { CHT.thread = null; } }
  const busy = CHT.threads.filter((t) => t.busy).length;
  $('#count-chat').textContent = busy || '';
  renderChatView();
}
VIEW_LOADERS.chat = loadChat;
document.addEventListener('hub:chats', () => { if (currentView === 'chat') { clearTimeout(CHT.t); CHT.t = setTimeout(loadChat, 200); } else api('/api/chats').then((r) => { $('#count-chat').textContent = r.threads.filter((t) => t.busy).length || ''; }).catch(() => {}); });

function renderChatView() {
  const box = $('#chat-body');
  const t = CHT.thread;
  box.innerHTML = `<div class="chat-wrap ${t && !CHT.showList ? 'has-thread' : ''}">
    <aside class="chat-list">
      <div class="chat-list-head"><h1>Chat</h1><div class="actions"><button class="btn sm" id="ch-debate" title="Dos agentes discuten y un tercero decide">${svg('steps')}Debate</button><button class="btn sm primary" id="ch-new">${svg('plus')}Nueva</button></div></div>
      ${CHT.threads.length ? CHT.threads.map((x) => `<button class="chat-item ${x.id === CHT.cur ? 'on' : ''}" data-th="${x.id}">
        <b>${x.mode === 'debate' ? '⚖ ' : ''}${esc(x.title)}</b><span>${x.busy ? '<span class="spin"></span> respondiendo…' : esc(x.last || 'Sin mensajes')}</span></button>`).join('')
        : '<p class="sub" style="padding:8px 4px">Habla con varios agentes a la vez: escribe <code>@claude</code>, <code>@codex</code> o <code>@gemini</code> (o <code>@todos</code>) y cada uno responde en el mismo hilo, viendo lo que dijeron los demás.</p>'}
    </aside>
    <section class="chat-main">${t ? threadHtml(t) : `<div class="empty"><p>Elige una conversación o empieza una nueva.</p></div>`}</section>
  </div>`;
  $('#ch-new').onclick = newChat;
  $('#ch-debate').onclick = newDebate;
  $$('#chat-body [data-th]').forEach((b) => (b.onclick = async () => { CHT.cur = b.dataset.th; CHT.showList = false; await loadChat(); scrollChat(); }));
  if (t) bindThread(t);
}
const agentLabel = (m) => `${esc(clientName(m.agent))}${m.model ? ` <span class="hint">· ${esc(m.model)}</span>` : ''}`;
function threadHtml(t) {
  const d = t.debate;
  const side = { a: 'A', b: 'B', judge: 'Juez' };
  return `<header class="chat-head">
      <button class="btn icon sm chat-back" id="ch-back" aria-label="Volver">${svg('arrow')}</button>
      <div class="meta"><b>${d ? '⚖ ' : ''}${esc(t.title)}</b><span class="hint mono">${esc(tilde(t.cwd))} · ${d ? 'solo lectura' : esc(PERM_CHAT[t.permission])}</span></div>
      <div class="actions">${d && d.state === 'running' ? '<button class="btn sm danger" id="ch-stop">Parar debate</button>' : ''}${d ? '' : `<button class="btn sm" id="ch-set">${svg('sliders')}Ajustes</button>`}<button class="btn sm icon danger" id="ch-del" title="Borrar conversación" aria-label="Borrar">${svg('x')}</button></div>
    </header>
    ${d ? `<div class="debate-bar"><span>${logo(d.a, 22)} <b>A</b> ${esc(clientName(d.a))}${d.modelA ? ` (${esc(d.modelA)})` : ''}</span><span class="vs">vs</span><span>${logo(d.b, 22)} <b>B</b> ${esc(clientName(d.b))}${d.modelB ? ` (${esc(d.modelB)})` : ''}</span>
      <span class="hint">· juez: ${esc(clientName(d.judge))} · ${d.rounds} ronda(s) · ${{ running: 'en curso', done: 'terminado', stopped: 'parado', error: 'interrumpido' }[d.state]}</span>
      ${d.winner ? `<span class="pill ok">Ganador: ${esc(d.winner)}</span>` : ''}</div>` : ''}
    <div class="chat-msgs" id="ch-msgs">${t.messages.map((m) => m.role === 'user' ? `<div class="msg me"><div class="bubble">${chatMd(m.text)}</div>${m.to?.length ? `<span class="hint">para ${m.to.map(clientName).join(', ')}</span>` : ''}</div>`
      : m.role === 'system' ? `<div class="msg sys">${esc(m.text)}</div>`
      : `<div class="msg ag ${m.side ? 'side-' + m.side : ''} ${m.status}">${logo(m.agent, 28)}<div><div class="who">${m.side ? `<span class="tag">${side[m.side]}${m.round ? ` · ronda ${m.round}` : ''}</span> ` : ''}${agentLabel(m)}${m.duration ? ` <span class="hint">· ${Math.round(m.duration / 1000)} s</span>` : ''}${m.usage?.costUsd != null ? ` <span class="hint">· ~${m.usage.costUsd.toFixed(3)} USD (estimación)</span>` : ''}</div>
        <div class="bubble">${m.status === 'pending' ? '<span class="spin"></span> pensando…' : chatMd(m.text)}</div>${m.job && m.status === 'pending' ? `<button class="btn sm ghost" data-open-job="${m.job}">Ver en la terminal</button>` : ''}</div></div>`).join('')}</div>
    ${d ? '' : `<div class="chat-compose">
      <div class="mention-row">${CHT.agents.map((a) => `<button class="chip" data-mention="${a}">${logo(a, 16, { plain: true })}@${a}</button>`).join('')}<button class="chip" data-mention="todos">@todos</button></div>
      <div class="chat-input"><textarea id="ch-text" class="field" rows="2" placeholder="Escribe… usa @claude, @codex, @gemini o @todos. Sin @, responde el último agente que habló."></textarea><button class="btn primary" id="ch-send">${svg('arrow')}</button></div>
    </div>`}`;
}
function scrollChat() { const m = $('#ch-msgs'); if (m) m.scrollTop = m.scrollHeight; }
function bindThread(t) {
  scrollChat();
  $('#ch-back').onclick = () => { CHT.showList = true; renderChatView(); };
  $('#ch-del').onclick = () => {
    modal(`<div class="mhead"><div><small>Chat</small><h2>¿Borrar "${esc(t.title)}"?</h2></div></div><p class="sub" style="margin-top:10px">Se borra la conversación (las respuestas en curso se cancelan). No se puede deshacer.</p>
      <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn danger" id="chd-ok">Borrar</button></div>`);
    $('#chd-ok').onclick = async () => { try { await api('/api/chats/delete', { id: t.id }); closeModal(); CHT.cur = null; CHT.thread = null; loadChat(); } catch (e) { toast(e.message, true); } };
  };
  $('#ch-stop')?.addEventListener('click', async () => { try { await api('/api/chats/stop', { id: t.id }); loadChat(); } catch (e) { toast(e.message, true); } });
  $('#ch-set')?.addEventListener('click', () => chatSettings(t));
  $$('#chat-body [data-open-job]').forEach((b) => (b.onclick = async () => {
    const r = await api('/api/delegations'); const j = r.jobs.find((x) => x.id === b.dataset.openJob);
    if (j?.sessionId) { activeId = j.sessionId; show('terms'); syncTabs(); } else toast('Aún no ha arrancado (está en la cola)');
  }));
  const ta = $('#ch-text');
  if (!ta) return;
  try { ta.value = localStorage.getItem('mcphub.chat.draft.' + t.id) || ''; } catch {}
  ta.oninput = () => { try { localStorage.setItem('mcphub.chat.draft.' + t.id, ta.value); } catch {} };
  $$('#chat-body [data-mention]').forEach((b) => (b.onclick = () => { ta.value = `${ta.value.trim()} @${b.dataset.mention} `.trimStart(); ta.focus(); ta.oninput(); }));
  const sendMsg = async () => {
    const text = ta.value.trim(); if (!text) return;
    $('#ch-send').disabled = true;
    try { CHT.thread = await api('/api/chats/post', { id: t.id, text }); ta.value = ''; ta.oninput(); renderChatView(); loadChat(); }
    catch (e) { toast(e.message, true); $('#ch-send').disabled = false; }
  };
  $('#ch-send').onclick = sendMsg;
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };
  ta.focus();
}
const modelInputs = (models = {}) => `<div class="agpick">${CHT.agents.map((a) => `<label class="check">${esc(clientName(a))}<input class="field sm mono" data-cm="${a}" value="${esc(models[a] || '')}" placeholder="modelo"></label>`).join('')}</div>`;
const readModels = () => Object.fromEntries($$('#modal [data-cm]').map((i) => [i.dataset.cm, i.value.trim()]).filter(([, v]) => v));
function newChat() {
  modal(`<div class="mhead"><div><small>Chat</small><h2>Nueva conversación</h2></div></div>
    <div class="form">
      <label>Título <span class="hint">opcional</span><input id="nc-title" class="field" placeholder="Sobre qué vais a hablar"></label>
      <label>Carpeta del proyecto<input id="nc-cwd" class="field mono" list="nc-dirs" value="${esc(tilde(S.recentDirs?.[0] || S.home))}"><datalist id="nc-dirs">${(S.recentDirs || []).map((d) => `<option value="${esc(tilde(d))}">`).join('')}</datalist></label>
      <label>Qué pueden hacer los agentes<select id="nc-perm" class="field">${Object.entries(PERM_CHAT).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <span class="hint">Por defecto solo leen: responden mirando el código sin tocarlo.</span>
      <div class="flabel">Modelo de cada agente <span class="hint">opcional</span></div>${modelInputs({ claude: 'sonnet' })}
    </div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="nc-ok">Empezar</button></div>`);
  $('#nc-ok').onclick = async () => {
    try { const t = await api('/api/chats/create', { title: $('#nc-title').value, cwd: $('#nc-cwd').value.trim().replace(/^~(?=$|\/)/, S.home), permission: $('#nc-perm').value, models: readModels() });
      closeModal(); CHT.cur = t.id; CHT.showList = false; loadChat(); } catch (e) { toast(e.message, true); }
  };
}
function chatSettings(t) {
  modal(`<div class="mhead"><div><small>Chat</small><h2>Ajustes</h2></div></div>
    <div class="form"><label>Título<input id="cs-title" class="field" value="${esc(t.title)}"></label>
      <label>Qué pueden hacer los agentes<select id="cs-perm" class="field">${Object.entries(PERM_CHAT).map(([k, l]) => `<option value="${k}" ${k === t.permission ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="flabel">Modelo de cada agente</div>${modelInputs(t.models)}</div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="cs-ok">Guardar</button></div>`);
  $('#cs-ok').onclick = async () => { try { await api('/api/chats/settings', { id: t.id, title: $('#cs-title').value, permission: $('#cs-perm').value, models: readModels() }); closeModal(); loadChat(); } catch (e) { toast(e.message, true); } };
}
function newDebate() {
  const ag = CHT.agents;
  const sel = (id, def) => `<select id="${id}" class="field">${ag.map((a) => `<option value="${a}" ${a === def ? 'selected' : ''}>${esc(clientName(a))}</option>`).join('')}</select>`;
  modal(`<div class="mhead"><div><small>Chat</small><h2>Nuevo debate</h2></div></div>
    <p class="sub" style="margin-top:8px">Dos agentes discuten una decisión técnica por turnos (pueden mirar el código, sin tocarlo) y un tercero hace de juez.</p>
    <div class="form">
      <label>Tema o decisión<textarea id="nd-topic" class="field" rows="3" placeholder="Ej.: ¿Deberíamos migrar el backend de Express a Fastify? A defiende migrar; B defiende quedarse."></textarea></label>
      <label>Carpeta del proyecto<input id="nd-cwd" class="field mono" value="${esc(tilde(S.recentDirs?.[0] || S.home))}"></label>
      <div class="row"><label>A${sel('nd-a', ag[0])}<input id="nd-ma" class="field sm mono" placeholder="modelo (opcional)"></label>
        <label>B${sel('nd-b', ag[1] || ag[0])}<input id="nd-mb" class="field sm mono" placeholder="modelo (opcional)"></label>
        <label>Juez${sel('nd-j', ag[2] || ag[0])}<input id="nd-mj" class="field sm mono" placeholder="modelo (opcional)"></label></div>
      <label>Rondas<select id="nd-r" class="field">${[1, 2, 3, 4, 5].map((n) => `<option ${n === 2 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <span class="hint">Cada turno es una llamada al agente: 2 rondas = 4 turnos + el juez.</span>
    </div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="nd-ok">Empezar debate</button></div>`);
  $('#nd-ok').onclick = async () => {
    try {
      const t = await api('/api/chats/create', { mode: 'debate', cwd: $('#nd-cwd').value.trim().replace(/^~(?=$|\/)/, S.home), debate: { topic: $('#nd-topic').value, a: $('#nd-a').value, b: $('#nd-b').value,
        judge: $('#nd-j').value, modelA: $('#nd-ma').value.trim(), modelB: $('#nd-mb').value.trim(), modelJudge: $('#nd-mj').value.trim(), rounds: $('#nd-r').value } });
      closeModal(); CHT.cur = t.id; CHT.showList = false; loadChat();
    } catch (e) { toast(e.message, true); }
  };
}
