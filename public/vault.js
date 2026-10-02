'use strict';
// Bóveda: API keys, contraseñas, cuentas y bases de datos que los agentes pueden usar.
Object.assign(ICONS, {
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM12 15v2',
  unlock: 'M7 11V8a5 5 0 0 1 9.6-2M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1ZM12 15v2',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  copy: 'M9 9h10v11H9V9ZM5 15V4h10',
  note: 'M6 3h9l4 4v14H6V3ZM14 3v5h5M9 13h7M9 17h5',
  dice: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8.5 8.5h.01M15.5 15.5h.01M15.5 8.5h.01M8.5 15.5h.01M12 12h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
});
Object.assign(LOGOS, {
  vault: { icon: 'lock' }, 't-apikey': { icon: 'key' }, 't-password': { icon: 'user' }, 't-database': { icon: 'servers' },
  't-token': { icon: 'key' }, 't-note': { icon: 'note' }, mysql: { t: 'My', fg: '#4479A1' }, mongodb: { t: 'Mg', fg: '#47A248' }, redis: { t: 'Rd', fg: '#FF4438' },
});

const VTYPES = {
  apikey: { label: 'API key', secret: 'API key', plural: 'API keys' },
  password: { label: 'Cuenta', secret: 'Contraseña', plural: 'Cuentas' },
  database: { label: 'Base de datos', secret: 'Contraseña', plural: 'Bases de datos' },
  token: { label: 'Token', secret: 'Token', plural: 'Tokens' },
  note: { label: 'Nota segura', secret: 'Contenido', plural: 'Notas' },
};
const SERVICE_KEYS = [
  ['github', 'github'], ['openai', 'openai'], ['chatgpt', 'openai'], ['anthropic', 'anthropic'], ['claude', 'claude'], ['stripe', 'stripe'],
  ['supabase', 'supabase'], ['notion', 'notion'], ['vercel', 'vercel'], ['cloudflare', 'cloudflare-docs'], ['postgres', 'postgres'],
  ['sqlite', 'sqlite'], ['mysql', 'mysql'], ['mongo', 'mongodb'], ['redis', 'redis'], ['n8n', 'n8n'], ['figma', 'figma'], ['linear', 'linear'],
  ['sentry', 'sentry'], ['hugging', 'huggingface'], ['openrouter', 'openrouter'], ['deepseek', 'deepseek'], ['mistral', 'mistral'],
  ['gemini', 'google'], ['google', 'google'], ['groq', 'groq'], ['xai', 'xai'], ['grok', 'xai'], ['kimi', 'moonshot'], ['moonshot', 'moonshot'],
  ['ollama', 'ollama'], ['brave', 'brave-search'], ['firecrawl', 'firecrawl'], ['exa', 'exa'], ['blender', 'blender'], ['roblox', 'roblox'],
  ['cursor', 'cursor'], ['copilot', 'copilot'], ['together', 'together'],
];
function itemKey(it) {
  const h = `${it.service} ${it.name} ${it.url}`.toLowerCase();
  for (const [w, k] of SERVICE_KEYS) if (h.includes(w)) return k;
  return 't-' + (it.type || 'apikey');
}

let V = { status: {}, items: [], log: [], registered: false };
let vFilter = 'all';
const revealed = {};

async function loadVault() {
  try { V = await api('/api/vault'); } catch (e) { toast(e.message, true); }
  $('#count-vault').textContent = V.status.unlocked ? (V.items.length || '') : '';
  renderVault();
}

function renderVault() {
  const box = $('#vault-body');
  if (!V.status.exists || !V.status.unlocked) {
    const create = !V.status.exists;
    box.innerHTML = `<div class="lockbox">
      <span class="big-lock">${svg('lock')}</span>
      <div><h1>${create ? 'Crea tu Bóveda' : 'Bóveda bloqueada'}</h1>
      <p class="sub" style="margin-top:8px">${create
        ? 'Guarda API keys, contraseñas, cuentas y bases de datos cifradas en tu equipo. Tú eliges cuáles puede usar cada agente.'
        : 'Introduce tu contraseña maestra para ver y usar tus credenciales.'}</p></div>
      <div class="form">
        <label>Contraseña maestra<input id="v-pw" type="password" class="field" autocomplete="${create ? 'new-password' : 'current-password'}"></label>
        ${create ? '<label>Repítela<input id="v-pw2" type="password" class="field" autocomplete="new-password"></label>' : ''}
        <label class="check" style="align-self:flex-start"><input type="checkbox" id="v-remember" ${create ? 'checked' : ''}>Desbloquear automáticamente en este equipo${tick}</label>
        <span class="hint">${create ? 'Si la olvidas no se puede recuperar. ' : ''}Con el desbloqueo automático la clave se guarda en <code>~/.config/mcp-hub/vault.key</code> (solo tu usuario) para que los agentes puedan usar la Bóveda sin que la abras cada vez.</span>
        <button class="btn primary" id="v-go">${svg(create ? 'lock' : 'unlock')}${create ? 'Crear Bóveda' : 'Desbloquear'}</button>
      </div></div>`;
    const go = async () => {
      const pw = $('#v-pw').value;
      if (create && pw !== $('#v-pw2').value) return toast('Las contraseñas no coinciden', true);
      try { await api(create ? '/api/vault/setup' : '/api/vault/unlock', { password: pw, remember: $('#v-remember').checked }); toast(create ? 'Bóveda creada' : 'Bóveda desbloqueada'); await loadVault(); refresh(); }
      catch (e) { toast(e.message, true); }
    };
    $('#v-go').onclick = go;
    $$('#vault-body input[type=password]').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }));
    setTimeout(() => $('#v-pw')?.focus(), 30);
    return;
  }

  const q = ($('#v-search')?.value || '').toLowerCase();
  const items = V.items.filter((i) => (vFilter === 'all' || i.type === vFilter)
    && (!q || `${i.name} ${i.service} ${i.username} ${i.url} ${i.notes} ${i.envVar}`.toLowerCase().includes(q)));
  const counts = Object.fromEntries(Object.keys(VTYPES).map((t) => [t, V.items.filter((i) => i.type === t).length]));
  const agentN = V.items.filter((i) => i.agentAccess).length;

  box.innerHTML = `
    <header class="page-head">
      <div><h1>Bóveda</h1><p class="sub">API keys, contraseñas, cuentas y bases de datos cifradas en tu equipo. Tú decides cuáles puede usar cada agente.</p></div>
      <div class="actions">
        <button class="btn" id="v-register">${logo('vault', 18, { plain: true })}${V.registered ? 'Agentes conectados' : 'Conectar a agentes'}</button>
        <button class="btn" id="v-lock">${svg('lock')}Bloquear</button>
        <button class="btn primary" id="v-add">${svg('plus')}Añadir</button>
      </div>
    </header>
    ${V.registered ? '' : `<div class="callout">${logo('vault', 36)}<span class="txt"><b>Conecta la Bóveda a tus agentes.</b> Se añade el servidor MCP <code>mcp-hub-vault</code> con dos herramientas: <code>vault_list</code> (ver qué credenciales hay, sin secretos) y <code>vault_get</code> (leer una). Solo verán las que marques como “Agentes”.</span><button class="btn primary sm" id="v-register2">Conectar</button></div>`}
    <div class="stats">
      <div class="stat"><span>Credenciales</span><b>${V.items.length}</b></div>
      <div class="stat"><span>Accesibles para agentes</span><b>${agentN}</b></div>
      <div class="stat"><span>Como variables de entorno</span><b>${V.items.filter((i) => i.envVar).length}</b></div>
      <div class="stat"><span>Usos por agentes</span><b>${V.log.length}</b></div>
    </div>
    <div class="toolbar">
      <div class="chips">${[['all', 'Todas', V.items.length], ...Object.entries(VTYPES).map(([k, t]) => [k, t.plural, counts[k]])].map(([k, l, n]) =>
        `<button class="chip ${vFilter === k ? 'on' : ''}" data-vf="${k}">${esc(l)}${n ? ` · ${n}` : ''}</button>`).join('')}</div>
      <label class="search"><svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input id="v-search" placeholder="Buscar en la Bóveda…" value="${esc(q)}" aria-label="Buscar en la Bóveda"></label>
    </div>
    ${!V.items.length ? `<div class="empty-state">${logo('vault', 48)}<p><b>Tu Bóveda está vacía</b></p><p>Añade tu primera API key, cuenta o base de datos.</p><button class="btn primary" id="v-add2">${svg('plus')}Añadir credencial</button></div>`
    : `<div class="table"><div class="vrow head"><span>Nombre</span><span>Tipo</span><span>Secreto</span><span>Variable de entorno</span><span>Agentes</span><span></span></div>
      ${items.map((i) => `<div class="vrow" data-id="${i.id}">
        <div class="srv">${logo(itemKey(i), 38)}<div class="meta"><div class="name">${esc(i.name)}</div><span class="cmd">${esc([i.username, i.type === 'database' ? [i.host, i.database].filter(Boolean).join('/') : i.url].filter(Boolean).join(' · ') || i.service || '—')}</span></div></div>
        <span><span class="tag t-${i.type}">${esc(VTYPES[i.type]?.label || i.type)}</span></span>
        <div class="secret">${i.hasSecret ? `<span data-secret>${esc(revealed[i.id] ?? i.secretHint)}</span>
          <button class="btn" data-v="reveal" title="${revealed[i.id] ? 'Ocultar' : 'Mostrar'}" aria-label="Mostrar secreto">${svg('eye')}</button>
          <button class="btn" data-v="copy" title="Copiar" aria-label="Copiar secreto">${svg('copy')}</button>` : '<span style="color:var(--dim);font-family:var(--sans)">—</span>'}</div>
        <span class="envtag ${i.envVar ? '' : 'none'}">${esc(i.envVar || '—')}</span>
        <button class="sw" aria-pressed="${i.agentAccess}" aria-label="${esc(i.name)} accesible para agentes" data-v="agent"><span class="track"><span class="knob"></span></span></button>
        <div class="row-actions"><button class="btn sm icon" data-v="edit" aria-label="Editar" title="Editar">${svg('edit')}</button><button class="btn sm icon" data-v="del" aria-label="Eliminar" title="Eliminar">${svg('trash')}</button></div>
      </div>`).join('') || '<div style="padding:24px;color:var(--muted);text-align:center">Sin resultados.</div>'}</div>`}
    <h2 class="section-title">Actividad de los agentes</h2>
    ${V.log.length ? `<div class="log">${V.log.map((l) => `<div><span class="when">${new Date(l.at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span><span>${esc(l.client || 'agente')}</span><span>${esc(l.action)} · <b>${esc(l.item)}</b></span></div>`).join('')}</div>`
      : '<p class="sub">Todavía ningún agente ha usado la Bóveda.</p>'}
    <p class="hint" style="margin-top:18px"><a href="#" id="v-chpw">Cambiar contraseña maestra</a></p>`;

  $('#v-add').onclick = () => editVaultItem(null);
  $('#v-add2')?.addEventListener('click', () => editVaultItem(null));
  $('#v-lock').onclick = async () => { await api('/api/vault/lock', {}); Object.keys(revealed).forEach((k) => delete revealed[k]); toast('Bóveda bloqueada'); loadVault(); refresh(); };
  $('#v-register').onclick = registerVault;
  $('#v-register2')?.addEventListener('click', registerVault);
  $('#v-chpw').onclick = (e) => { e.preventDefault(); changeMaster(); };
  $$('[data-vf]').forEach((b) => (b.onclick = () => { vFilter = b.dataset.vf; renderVault(); }));
  const s = $('#v-search');
  s.oninput = () => { renderVault(); const n = $('#v-search'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  $$('#vault-body [data-v]').forEach((b) => (b.onclick = async () => {
    const id = b.closest('.vrow').dataset.id;
    const it = V.items.find((x) => x.id === id);
    const act = b.dataset.v;
    try {
      if (act === 'edit') return editVaultItem(id);
      if (act === 'del') return deleteVaultItem(it);
      if (act === 'agent') { await api('/api/vault/save', { id, item: { ...it, secret: undefined, agentAccess: !it.agentAccess } }); return loadVault(); }
      if (act === 'reveal') {
        if (revealed[id]) delete revealed[id]; else revealed[id] = (await api('/api/vault/reveal', { id })).secret;
        return renderVault();
      }
      if (act === 'copy') {
        const r = await api('/api/vault/reveal', { id });
        await navigator.clipboard.writeText(r.secret);
        toast(`${VTYPES[it.type]?.secret || 'Secreto'} de ${it.name} copiado`);
      }
    } catch (e) { toast(e.message, true); }
  }));
}

function genPassword(n = 24) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+';
  const a = crypto.getRandomValues(new Uint32Array(n));
  return [...a].map((x) => chars[x % chars.length]).join('');
}

function editVaultItem(id) {
  const it = id ? V.items.find((x) => x.id === id) : { type: vFilter !== 'all' ? vFilter : 'apikey', agentAccess: false };
  let type = it.type;
  modal(`<div class="mhead"><span id="vi-logo">${logo(id ? itemKey(it) : 't-' + type, 44)}</span><div><small>Bóveda</small><h2>${id ? esc(it.name) : 'Nueva credencial'}</h2></div></div>
    <div class="form">
      <div class="seg" id="vi-type">${Object.entries(VTYPES).map(([k, t]) => `<button type="button" data-t="${k}">${esc(t.label)}</button>`).join('')}</div>
      <div class="row"><label>Nombre<input id="vi-name" class="field" value="${esc(it.name || '')}" placeholder="GitHub personal"></label>
        <label><span id="vi-service-l">Servicio</span><input id="vi-service" class="field" list="vi-services" value="${esc(it.service || '')}" placeholder="github"><datalist id="vi-services">${['GitHub', 'OpenAI', 'Anthropic', 'OpenRouter', 'Stripe', 'Supabase', 'Vercel', 'Cloudflare', 'Notion', 'n8n', 'postgresql', 'mysql', 'mongodb', 'redis'].map((x) => `<option value="${x}">`).join('')}</datalist></label></div>
      <div class="row" data-for="password database note apikey token"><label>Usuario / email<input id="vi-user" class="field" value="${esc(it.username || '')}" autocomplete="off"></label>
        <label data-for="password apikey token note">URL<input id="vi-url" class="field mono" value="${esc(it.url || '')}" placeholder="https://…"></label></div>
      <div class="row" data-for="database"><label>Host<input id="vi-host" class="field mono" value="${esc(it.host || '')}" placeholder="localhost"></label>
        <label style="max-width:110px">Puerto<input id="vi-port" class="field mono" value="${esc(it.port || '')}" placeholder="5432"></label>
        <label>Base de datos<input id="vi-db" class="field mono" value="${esc(it.database || '')}"></label></div>
      <label><span id="vi-secret-l">Secreto</span>
        <div class="pw-row"><input id="vi-secret" type="password" class="field mono" placeholder="${id && it.hasSecret ? 'Sin cambios (déjalo vacío para mantenerlo)' : ''}" autocomplete="new-password">
        <button type="button" class="btn icon" id="vi-show" aria-label="Mostrar" title="Mostrar">${svg('eye')}</button>
        <button type="button" class="btn icon" id="vi-gen" aria-label="Generar contraseña" title="Generar contraseña segura">${svg('dice')}</button></div></label>
      <label>Variable de entorno <span class="hint">opcional · se puede pasar al abrir un agente</span><input id="vi-env" class="field mono" value="${esc(it.envVar || '')}" placeholder="GITHUB_TOKEN"></label>
      <label>Notas<textarea id="vi-notes" class="field" rows="3" placeholder="Para qué sirve, permisos, caducidad…">${esc(it.notes || '')}</textarea></label>
      <label class="check" style="align-self:flex-start"><input type="checkbox" id="vi-agent" ${it.agentAccess ? 'checked' : ''}>Los agentes pueden usarla (vía <code>vault_get</code>)${tick}</label>
    </div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="vi-save">Guardar</button></div>`);
  const sync = () => {
    $$('#vi-type button').forEach((b) => b.classList.toggle('on', b.dataset.t === type));
    $$('#modal [data-for]').forEach((el) => (el.style.display = el.dataset.for.split(' ').includes(type) ? '' : 'none'));
    $('#vi-secret-l').textContent = VTYPES[type].secret;
    $('#vi-service-l').textContent = type === 'database' ? 'Motor' : 'Servicio';
    $('#vi-gen').style.display = type === 'password' || type === 'database' ? '' : 'none';
    if (!id) $('#vi-logo').innerHTML = logo(itemKey({ type, service: $('#vi-service').value, name: $('#vi-name').value, url: '' }), 44);
  };
  $$('#vi-type button').forEach((b) => (b.onclick = () => { type = b.dataset.t; sync(); }));
  $('#vi-service').oninput = sync; $('#vi-name').oninput = sync;
  $('#vi-show').onclick = async () => {
    const f = $('#vi-secret');
    if (f.type === 'password' && !f.value && id && it.hasSecret) f.value = (await api('/api/vault/reveal', { id })).secret;
    f.type = f.type === 'password' ? 'text' : 'password';
  };
  $('#vi-gen').onclick = () => { $('#vi-secret').value = genPassword(); $('#vi-secret').type = 'text'; };
  sync();
  $('#vi-save').onclick = async () => {
    const secret = $('#vi-secret').value;
    const item = { name: $('#vi-name').value, type, service: $('#vi-service').value.trim(), username: $('#vi-user').value.trim(),
      url: $('#vi-url').value.trim(), host: $('#vi-host').value.trim(), port: $('#vi-port').value.trim(), database: $('#vi-db').value.trim(),
      envVar: $('#vi-env').value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'), notes: $('#vi-notes').value, agentAccess: $('#vi-agent').checked,
      secret: secret || (id ? undefined : '') };
    if (!item.name.trim()) return toast('Ponle un nombre', true);
    try { await api('/api/vault/save', { id, item }); delete revealed[id]; toast('Guardado en la Bóveda'); closeModal(); loadVault(); refresh(); }
    catch (e) { toast(e.message, true); }
  };
}

function deleteVaultItem(it) {
  modal(`<div class="mhead">${logo(itemKey(it), 40)}<div><small>Eliminar de la Bóveda</small><h2>${esc(it.name)}</h2></div></div>
    <p class="sub" style="margin-top:14px">Se borrará para siempre. Los agentes dejarán de poder usarla.</p>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn danger" id="vd-ok">${svg('trash')}Eliminar</button></div>`);
  $('#vd-ok').onclick = async () => { await api('/api/vault/delete', { id: it.id }); toast('Eliminada'); closeModal(); loadVault(); refresh(); };
}

function registerVault() {
  const cur = S.servers['mcp-hub-vault']?.targets;
  modal(`<div class="mhead">${logo('vault', 44)}<div><small>Servidor MCP</small><h2>Conectar la Bóveda a los agentes</h2></div></div>
    <p class="sub" style="margin-top:12px">Añade <code>mcp-hub-vault</code> a los agentes que elijas. Podrán listar tus credenciales (sin secretos) y leer solo las marcadas como accesibles. Cada uso queda registrado en “Actividad de los agentes”.</p>
    <div class="form"><div class="flabel">Conectar a${targetsChecks(cur || null)}</div>
    <span class="hint">MCP Hub tiene que estar abierto y la Bóveda desbloqueada para que funcione.</span></div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="vr-ok">Conectar</button></div>`);
  $('#vr-ok').onclick = async () => {
    try { reportErrors((await api('/api/vault/register', { targets: readTargets() })).errors) && toast('Bóveda conectada a los agentes'); closeModal(); await refresh(); loadVault(); }
    catch (e) { toast(e.message, true); }
  };
}

function changeMaster() {
  modal(`<div class="mhead">${logo('vault', 40)}<div><small>Bóveda</small><h2>Cambiar contraseña maestra</h2></div></div>
    <div class="form"><label>Contraseña actual<input id="cm-old" type="password" class="field"></label>
    <label>Nueva contraseña<input id="cm-new" type="password" class="field"></label>
    <label>Repítela<input id="cm-new2" type="password" class="field"></label></div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="cm-ok">Cambiar</button></div>`);
  $('#cm-ok').onclick = async () => {
    if ($('#cm-new').value !== $('#cm-new2').value) return toast('Las contraseñas no coinciden', true);
    try { await api('/api/vault/password', { old: $('#cm-old').value, new: $('#cm-new').value }); toast('Contraseña cambiada'); closeModal(); }
    catch (e) { toast(e.message, true); }
  };
}

loadVault();
