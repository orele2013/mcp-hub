'use strict';
const TOKEN = document.querySelector('meta[name=token]').content;
const REMOTE = document.querySelector('meta[name=remote]')?.content === '1';
if (REMOTE) document.documentElement.classList.add('remote');
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------- Iconos propios ----------------
const ICONS = {
  servers: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3ZM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5',
  shell: 'M5 8l4 4-4 4M12 17h7',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  memory: 'M8.5 6a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM20.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM12.5 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM8.4 6.3l7.2 1.4M6.8 8.4l2.4 7.2M16.4 10.2l-4.8 5.6',
  steps: 'M10 6h10M10 12h10M10 18h10M6 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM6 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM6 18a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2',
  plug: 'M9 3v4M15 3v4M6 7h12v4a6 6 0 0 1-12 0V7ZM12 17v4',
  shield: 'M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3ZM9 12l2 2 4-4',
  key: 'M12 15a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM11 12l9-9M17 6l3 3M15 8l2 2',
  bolt: 'M13 3 5 13h6l-1 8 8-10h-6l1-8Z',
  x: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  check: 'm5 12 5 5 9-10',
  warn: 'M12 4 2.5 20h19L12 4ZM12 10v4M12 17.5v.01',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  play: 'M7 5v14l12-7L7 5Z',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  sync: 'M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  up: 'M12 19V5M6 11l6-6 6 6',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v5M12 8v.01',
};
const svg = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;

// ---------------- Logos ----------------
const IMG = (f) => ({ img: `/logos/${f}.svg` });
const LOGOS = {
  // agentes
  claude: IMG('claude'), codex: IMG('codex'), opencode: IMG('opencode'), gemini: IMG('googlegemini'),
  cursor: IMG('cursor'), shell: { icon: 'shell', fg: '#4ADE9A', bg: '#0F1A14', line: '#1D3A2A' },
  // MCPs
  filesystem: { icon: 'folder' }, memory: { icon: 'memory' }, 'sequential-thinking': { icon: 'steps' }, fetch: { icon: 'globe' },
  time: { icon: 'clock' }, git: IMG('git'), sqlite: IMG('sqlite'), postgres: IMG('postgresql'), playwright: { t: 'PW', fg: '#45BA4B' },
  'chrome-devtools': IMG('googlechrome'), 'brave-search': IMG('brave'), firecrawl: { t: 'FC', fg: '#FF7A1A' },
  exa: { t: 'Exa', fg: '#fff', bg: '#1F40ED' }, context7: IMG('upstash'), deepwiki: { t: 'DW', fg: '#6CB6FF' },
  'cloudflare-docs': IMG('cloudflare'), huggingface: IMG('huggingface'), github: IMG('github'), sentry: IMG('sentry'),
  linear: IMG('linear'), notion: IMG('notion'), vercel: IMG('vercel'), stripe: IMG('stripe'), supabase: IMG('supabase'),
  n8n: IMG('n8n'), figma: IMG('figma'), blender: IMG('blender'), 'desktop-commander': { t: 'DC', fg: '#D6D8DE' },
  roblox: IMG('robloxstudio'), node: IMG('nodedotjs'), mcp: IMG('modelcontextprotocol'),
  // proveedores
  openrouter: IMG('openrouter'), deepseek: IMG('deepseek'), moonshot: IMG('kimi'), zai: { t: 'Z', fg: '#fff', bg: '#2E5BFF' },
  openai: IMG('codex'), anthropic: IMG('anthropic'), google: IMG('googlegemini'),
  groq: { t: 'gq', fg: '#fff', bg: '#F55036' }, mistral: IMG('mistralai'), xai: { t: 'xAI', fg: '#111', bg: '#EDEBE5' },
  together: { t: 'T', fg: '#fff', bg: '#0F6FFF' }, ollama: IMG('ollama'), lmstudio: IMG('lmstudio'), custom: { icon: 'plug' },
  copilot: IMG('githubcopilot'),
};
function logo(key, size = 40, { plain = false, alt = '' } = {}) {
  const d = LOGOS[key] || LOGOS.mcp;
  const r = Math.round(size * 0.28);
  const box = `width:${size}px;height:${size}px;border-radius:${r}px;`;
  const k = ` data-k="${esc(String(key))}"`;
  if (d.img) return `<span class="logo${plain ? ' plain' : ''}"${k} style="${box}"><img src="${d.img}" alt="${esc(alt)}" width="${Math.round(size * 0.55)}" height="${Math.round(size * 0.55)}"></span>`;
  if (d.t) {
    const fs = size * (d.t.length > 2 ? 0.3 : 0.36);
    return `<span class="logo"${k} style="${box}font-size:${fs}px;color:${d.fg};${d.bg ? `background:${d.bg};border-color:${d.bg};` : ''}" ${alt ? `aria-label="${esc(alt)}"` : ''}>${d.t}</span>`;
  }
  const custom = d.fg ? `color:${d.fg};background:${d.bg};border-color:${d.line};` : '';
  return `<span class="logo${d.fg ? '' : ' mine'}"${k} style="${box}${custom}">${svg(d.icon)}</span>`;
}
const KEYWORDS = [
  ['blender', ['blender']], ['n8n', ['n8n']], ['roblox', ['roblox']], ['playwright', ['playwright']], ['chrome-devtools', ['chrome-devtools']],
  ['github', ['github']], ['notion', ['notion']], ['supabase', ['supabase']], ['figma', ['figma']], ['linear', ['linear.app']],
  ['sentry', ['sentry']], ['stripe', ['stripe']], ['vercel', ['vercel']], ['cloudflare-docs', ['cloudflare']], ['huggingface', ['huggingface']],
  ['brave-search', ['brave']], ['postgres', ['postgres']], ['sqlite', ['sqlite']], ['context7', ['context7']], ['deepwiki', ['deepwiki']],
  ['exa', ['exa.ai']], ['firecrawl', ['firecrawl']], ['filesystem', ['server-filesystem']], ['memory', ['server-memory']],
  ['sequential-thinking', ['sequential']], ['fetch', ['mcp-server-fetch']], ['time', ['mcp-server-time']], ['git', ['mcp-server-git']],
  ['desktop-commander', ['desktop-commander']], ['node', ['node_repl', 'nodejs', '/node ']],
];
function serverKey(name, s = {}) {
  if (s.catalogId && LOGOS[s.catalogId]) return s.catalogId;
  const h = [name, s.command, ...(s.args || []), s.url].join(' ').toLowerCase();
  for (const [k, words] of KEYWORDS) if (words.some((w) => h.includes(w))) return k;
  return 'mcp';
}
function providerKey(id, p = {}) {
  if (LOGOS[id]) return id;
  const h = `${id} ${p.name} ${p.openaiUrl} ${p.anthropicUrl}`.toLowerCase();
  const map = [['openrouter', 'openrouter'], ['deepseek', 'deepseek'], ['moonshot', 'moonshot'], ['moonshot', 'kimi'], ['zai', 'z.ai'], ['zai', 'glm'],
    ['anthropic', 'anthropic'], ['google', 'gemini'], ['google', 'googleapis'], ['groq', 'groq'], ['mistral', 'mistral'], ['xai', 'x.ai'],
    ['together', 'together'], ['ollama', 'ollama'], ['ollama', '11434'], ['lmstudio', 'lm studio'], ['lmstudio', ':1234'], ['openai', 'openai']];
  for (const [k, w] of map) if (h.includes(w)) return k;
  return 'custom';
}

// ---------------- Estado ----------------
let S = { servers: {}, clients: [], catalog: [], external: [], recentDirs: [], providers: {}, presets: [], sessions: [], projectProfiles: [] };
const authCache = {};
let catFilter = 'Todos';
let ignored = new Set();
try { ignored = new Set(JSON.parse(localStorage.getItem('mcphub.ignored') || '[]')); } catch {}
let lastLaunch = {};
try { lastLaunch = JSON.parse(localStorage.getItem('mcphub.last') || '{}'); } catch {}
const saveLocal = () => { try { localStorage.setItem('mcphub.last', JSON.stringify(lastLaunch)); localStorage.setItem('mcphub.ignored', JSON.stringify([...ignored])); } catch {} };

async function api(path, body) {
  const r = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-token': TOKEN, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
function toast(msg, err = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.innerHTML = svg(err ? 'warn' : 'check') + `<span>${esc(msg)}</span>`;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), err ? 9000 : 3800);
}
function reportErrors(errors) {
  const lines = [];
  const walk = (o, p) => Object.entries(o || {}).forEach(([k, v]) => (typeof v === 'object' ? walk(v, p + k + ' → ') : lines.push(`${p}${clientName(k)}: ${v}`)));
  walk(errors, '');
  if (lines.length) toast('No se pudo escribir la configuración:\n' + lines.join('\n'), true);
  return !lines.length;
}
const clientName = (id) => S.clients.find((c) => c.id === id)?.name || id;
const client = (id) => S.clients.find((c) => c.id === id);
const summary = (s) => (!s ? '' : s.transport === 'stdio' ? [s.command, ...(s.args || [])].join(' ') : s.url);
const tilde = (p) => String(p || '').replace(S.home, '~');

async function refresh() {
  S = { ...S, ...(await api('/api/state')) };
  render();
}

// ---------------- Navegación ----------------
let currentView = 'servers';
// La cifra de la sección (la misma del índice lateral) va en la esquina de la banda, como el número de colección de una portada
function syncBand() {
  const h = document.querySelector('.view.active .page-head'); if (!h) return;
  const n = document.querySelector(`nav button[data-view="${currentView}"] em`)?.textContent.trim();
  if (n) h.dataset.count = n; else delete h.dataset.count;
}
setInterval(syncBand, 1500);
function show(view) {
  currentView = view;
  document.body.classList.remove('nav-open');
  const navBtn = $(`nav button[data-view="${view}"] span`);
  if (navBtn) $('#m-title').textContent = navBtn.textContent;
  $$('nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'terms') requestAnimationFrame(fitActive);
  requestAnimationFrame(syncBand);
  if (view === 'agents' || view === 'providers') loadAuth();
  if (view === 'agents' && typeof loadDelegations === 'function') loadDelegations();
  if (view === 'vault' && typeof loadVault === 'function') loadVault();
  if (view === 'skills' && typeof loadSkills === 'function') loadSkills();
  if (view === 'messaging' && typeof loadMessaging === 'function') loadMessaging();
  if (view === 'remote' && typeof loadRemote === 'function') loadRemote();
  if (view === 'design' && typeof loadDesign === 'function') { if (DZ.slug) requestAnimationFrame(layoutStage); else loadDesign(); }
  VIEW_LOADERS[view]?.();
}
// Las secciones nuevas registran aquí su función de carga (chat, tablero, proyectos, monitores, integraciones)
const VIEW_LOADERS = {};
window.show = show;
$$('nav button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));

function render() {
  $('#brand-addr').textContent = location.host;
  $('#count-servers').textContent = Object.keys(S.servers).length || '';
  $('#count-catalog').textContent = S.catalog.length || '';
  $('#count-agents').textContent = S.clients.filter((c) => c.installed).length || '';
  $('#count-providers').textContent = Object.keys(S.providers).length || '';
  renderServers(); renderCatalog(); renderAgents(); renderProviders(); renderQuick(); syncTabs();
}

// ---------------- Servidores ----------------
function issues() {
  const out = [];
  for (const [name, s] of Object.entries(S.servers)) {
    for (const c of S.clients) {
      const want = !!s.targets?.[c.id], has = c.servers[name];
      const key = `${name}|${c.id}`;
      if (ignored.has(key)) continue;
      if (has && !want) out.push({ name, c, key, kind: summary(has) !== summary(s) ? 'differs' : 'unmarked', other: summary(has) });
      else if (want && !has) out.push({ name, c, key, kind: 'missing' });
    }
  }
  return out;
}

function renderServers() {
  const names = Object.keys(S.servers).sort((a, b) => a.localeCompare(b));
  const cols = S.clients;
  const iss = issues();
  const active = names.reduce((n, name) => n + cols.filter((c) => S.servers[name].targets?.[c.id] && c.servers[name]).length, 0);
  const installed = cols.filter((c) => c.installed);

  $('#stats').innerHTML = `
    <div class="stat"><span>Servidores</span><b>${names.length}</b></div>
    <div class="stat"><span>Agentes detectados</span><div class="row"><b>${installed.length}</b><div class="logos">${installed.map((c) => logo(c.id, 18, { plain: true, alt: c.name })).join('')}</div></div></div>
    <div class="stat"><span>Conexiones activas</span><b>${active}</b></div>
    <div class="stat ${iss.length ? 'warn' : ''}"><span>Por revisar</span><b>${iss.length}</b></div>`;

  const ext = [...new Set(S.external.map((e) => e.name))];
  $('#banners').innerHTML = (ext.length ? `<div class="banner">${svg('info')}<span>Hay ${ext.length} servidor(es) en tus agentes que aún no están en MCP Hub: <b>${esc(ext.join(', '))}</b></span><button class="btn sm warn" data-act="import">Importar</button></div>` : '')
    + iss.slice(0, 4).map((x) => `<div class="banner" data-key="${esc(x.key)}" data-name="${esc(x.name)}" data-client="${x.c.id}">${svg('warn')}<span>${
      x.kind === 'differs' ? `<b>${esc(x.name)}</b> tiene una configuración distinta en ${esc(x.c.name)} <span class="mono">(${esc(tilde(x.other).slice(0, 70))})</span>.`
      : x.kind === 'unmarked' ? `<b>${esc(x.name)}</b> está en ${esc(x.c.name)} pero no está marcado aquí.`
      : `<b>${esc(x.name)}</b> está marcado para ${esc(x.c.name)} pero falta en su configuración.`}</span>
      <button class="btn sm warn-ghost" data-act="ignore">Ignorar</button>
      <button class="btn sm warn" data-act="apply">${x.kind === 'missing' ? 'Escribir config' : x.kind === 'differs' ? 'Usar la de MCP Hub' : 'Marcar'}</button></div>`).join('');
  $$('#banners [data-act]').forEach((b) => (b.onclick = async () => {
    if (b.dataset.act === 'import') return doImport();
    const box = b.closest('.banner');
    if (b.dataset.act === 'ignore') { ignored.add(box.dataset.key); saveLocal(); return renderServers(); }
    b.disabled = true;
    try { reportErrors((await api('/api/target', { name: box.dataset.name, client: box.dataset.client, on: true })).errors); } catch (e) { toast(e.message, true); }
    refresh();
  }));

  if (!names.length) {
    $('#servers-table').innerHTML = `<div class="empty-state">${logo('mcp', 48)}<p><b>No hay servidores todavía</b></p><p>Importa los que ya tienes, instala desde el catálogo o añade uno.</p></div>`;
  } else {
    const grid = `grid-template-columns: minmax(0,1fr) repeat(${cols.length}, 84px) 150px;`;
    let h = `<div class="table"><div class="trow head" style="${grid}"><span>Servidor</span>${cols.map((c) =>
      `<span class="col ${c.installed ? '' : 'dim'}" title="${esc(c.configFile)}">${logo(c.id, 18, { plain: true })}${esc(c.name.split(' ')[0])}</span>`).join('')}<span></span></div>`;
    for (const n of names) {
      const s = S.servers[n];
      h += `<div class="trow" style="${grid}" data-name="${esc(n)}"><div class="srv">${logo(serverKey(n, s), 40)}<div class="meta"><div class="name">${typeof healthDot === 'function' ? healthDot(n) : ''}<span class="nm">${esc(n)}</span><span class="tag ${s.transport}">${s.transport}</span></div><span class="cmd" title="${esc(summary(s))}">${esc(tilde(summary(s)))}</span></div></div>`;
      for (const c of cols) {
        const want = !!s.targets?.[c.id], has = !!c.servers[n];
        h += `<button class="sw ${want !== has && !ignored.has(`${n}|${c.id}`) ? 'mismatch' : ''}" aria-pressed="${want}" aria-label="${esc(n)} en ${esc(c.name)}" data-client="${c.id}"><span class="track"><span class="knob"></span></span></button>`;
      }
      h += `<div class="row-actions"><button class="btn sm" data-act="explore" title="Herramientas, recursos, prompts, compatibilidad, seguridad y salud">${svg('explore')}Explorar</button><button class="btn sm icon" data-act="edit" aria-label="Editar ${esc(n)}" title="Editar">${svg('edit')}</button><button class="btn sm icon" data-act="del" aria-label="Eliminar ${esc(n)}" title="Eliminar">${svg('trash')}</button></div></div>`;
    }
    $('#servers-table').innerHTML = h + '</div>';
  }
  $$('#servers-table .sw').forEach((b) => b.addEventListener('click', async () => {
    const name = b.closest('.trow').dataset.name;
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', on); b.classList.add('busy');
    try { reportErrors((await api('/api/target', { name, client: b.dataset.client, on })).errors); } catch (e) { toast(e.message, true); }
    await refresh();
  }));
  $$('#servers-table [data-act]').forEach((b) => b.addEventListener('click', () => {
    const name = b.closest('.trow').dataset.name;
    ({ test: testServer, explore: exploreServer, edit: editServer, del: deleteServer })[b.dataset.act](name, b);
  }));

  const have = new Set(Object.values(S.servers).map((s) => s.catalogId).filter(Boolean).concat(names));
  const rest = S.catalog.filter((c) => !have.has(c.id));
  const sug = rest.slice(0, 6);
  $('#suggest').innerHTML = sug.length ? `<div class="suggest"><div class="stack">${sug.map((c) => logo(c.id, 36)).join('')}</div>
    <div><b>Añade más capacidades</b><span>${esc(sug.slice(0, 4).map((c) => c.name).join(', '))}${rest.length > 4 ? ` y ${rest.length - 4} más` : ''}, listos para instalar.</span></div>
    <button class="btn" id="go-catalog">Abrir catálogo ${svg('arrow')}</button></div>` : '';
  $('#go-catalog')?.addEventListener('click', () => show('catalog'));
}

async function testServer(name, btn) {
  const row = btn.closest('.trow');
  if (row.nextElementSibling?.classList.contains('test-row')) { row.nextElementSibling.remove(); return; }
  const box = document.createElement('div');
  box.className = 'test-row';
  box.innerHTML = `<span class="spin"></span> Arrancando <b>${esc(name)}</b>… la primera vez puede tardar mientras descarga el paquete.`;
  row.after(box);
  btn.disabled = true;
  try { box.innerHTML = testHtml(await api('/api/test', { name })); }
  catch (e) { box.innerHTML = `<pre class="err">${esc(e.message)}</pre>`; }
  btn.disabled = false;
}
function testHtml(r) {
  if (r.ok) return `<span class="pill ok">${svg('check')}Funciona</span> &nbsp;${esc(r.serverInfo?.name || '')} <span class="mono" style="color:var(--dim)">${esc(r.serverInfo?.version || '')}</span> · ${r.tools.length} herramientas${r.note ? ` · ${esc(r.note)}` : ''}
    <div class="tools">${r.tools.map((t) => `<span title="${esc(t.description || '')}">${esc(t.name)}</span>`).join('')}</div>`;
  return `<span class="pill ${r.auth ? 'warn' : 'err'}">${r.auth ? 'Requiere login' : 'Error'}</span> &nbsp;${esc(r.error)}${r.stderr ? `<pre class="err">${esc(r.stderr)}</pre>` : ''}`;
}

function deleteServer(name) {
  modal(`<div class="mhead">${logo(serverKey(name, S.servers[name]), 40)}<div><small>Eliminar servidor</small><h2>${esc(name)}</h2></div></div>
    <p class="sub" style="margin-top:14px">Se quitará de MCP Hub y de la configuración de todos los agentes donde esté.</p>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn danger" id="m-ok">${svg('trash')}Eliminar</button></div>`);
  $('#m-ok').onclick = async () => {
    try { reportErrors((await api('/api/delete', { name })).errors); toast(`${name} eliminado`); closeModal(); refresh(); }
    catch (e) { toast(e.message, true); }
  };
}

const tick = `<svg class="tick" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS.check}"/></svg>`;
const targetsChecks = (targets) => `<div class="checks">${S.clients.map((c) =>
  `<label class="check"><input type="checkbox" name="target" value="${c.id}" ${(targets ? targets[c.id] : c.installed) ? 'checked' : ''}>${logo(c.id, 16, { plain: true })}${esc(c.name)}${tick}</label>`).join('')}</div>`;
const readTargets = () => Object.fromEntries($$('#modal input[name=target]').map((i) => [i.value, i.checked]));
const kvText = (o, sep) => Object.entries(o || {}).map(([k, v]) => `${k}${sep}${v}`).join('\n');
const parseKv = (txt, sep) => Object.fromEntries(txt.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
  const i = l.indexOf(sep); return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + sep.length).trim()];
}));

function editServer(name) {
  const s = name ? S.servers[name] : { transport: 'stdio', command: '', args: [], env: {}, url: '', headers: {}, description: '' };
  let transport = s.transport;
  modal(`<div class="mhead">${logo(name ? serverKey(name, s) : 'mcp', 40)}<div><small>${name ? 'Editar' : 'Nuevo'} servidor MCP</small><h2>${esc(name || 'Añadir servidor')}</h2></div></div>
    <div class="form">
      <div class="row"><label>Nombre<input id="f-name" class="field" value="${esc(name || '')}" placeholder="mi-servidor"></label>
      <div class="flabel">Transporte<div class="seg" id="f-transport">${['stdio', 'http', 'sse'].map((t) => `<button type="button" data-t="${t}">${t === 'stdio' ? 'Local' : t.toUpperCase()}</button>`).join('')}</div></div></div>
      <div id="f-stdio" class="form" style="margin:0">
        <label>Comando<input id="f-cmd" class="field mono" value="${esc(s.command || '')}" placeholder="npx"></label>
        <label>Argumentos <span class="hint">uno por línea</span><textarea id="f-args" class="field mono" placeholder="-y&#10;@paquete/mcp-server">${esc((s.args || []).join('\n'))}</textarea></label>
        <label>Variables de entorno <span class="hint">CLAVE=valor, una por línea</span><textarea id="f-env" class="field mono">${esc(kvText(s.env, '='))}</textarea></label>
      </div>
      <div id="f-http" class="form" style="margin:0">
        <label>URL<input id="f-url" class="field mono" value="${esc(s.url || '')}" placeholder="https://ejemplo.com/mcp"></label>
        <label>Cabeceras <span class="hint">Nombre: valor, una por línea</span><textarea id="f-headers" class="field mono" placeholder="Authorization: Bearer …">${esc(kvText(s.headers, ': '))}</textarea></label>
      </div>
      <label>Descripción<input id="f-desc" class="field" value="${esc(s.description || '')}"></label>
      <div class="flabel">Conectar a${targetsChecks(name ? s.targets : null)}</div>
      <div id="f-review"></div>
      <div id="f-test"></div>
    </div>
    <div class="mfoot"><button class="btn" id="f-try">${svg('bolt')}Probar</button><span style="flex:1"></span><button class="btn" data-close>Cancelar</button><button class="btn primary" id="f-save">Guardar</button></div>`);
  const sync = () => {
    $$('#f-transport button').forEach((b) => b.classList.toggle('on', b.dataset.t === transport));
    $('#f-stdio').style.display = transport === 'stdio' ? '' : 'none';
    $('#f-http').style.display = transport === 'stdio' ? 'none' : '';
  };
  $$('#f-transport button').forEach((b) => (b.onclick = () => { transport = b.dataset.t; sync(); }));
  sync();
  const collect = () => ({
    transport, command: $('#f-cmd').value.trim(), args: $('#f-args').value.split('\n').map((x) => x.trim()).filter(Boolean),
    env: parseKv($('#f-env').value, '='), url: $('#f-url').value.trim(), headers: parseKv($('#f-headers').value, ':'),
    description: $('#f-desc').value.trim(), targets: readTargets(), catalogId: s.catalogId,
  });
  const review = () => { if (typeof reviewInto === 'function') reviewInto($('#f-review'), collect()); };
  $('#modal-box').addEventListener('input', review);
  $$('#f-transport button').forEach((b) => b.addEventListener('click', review));
  review();
  $('#f-try').onclick = async () => {
    $('#f-test').innerHTML = '<span class="spin"></span> Probando…';
    try { $('#f-test').innerHTML = testHtml(await api('/api/test', { server: collect() })); }
    catch (e) { $('#f-test').innerHTML = `<pre class="err">${esc(e.message)}</pre>`; }
  };
  $('#f-save').onclick = async () => {
    const newName = $('#f-name').value.trim();
    $('#f-save').disabled = true;
    try {
      const r = await api('/api/servers', { name: newName, oldName: name, server: collect() });
      reportErrors(r.errors) && toast(`${newName} guardado`);
      closeModal(); refresh();
    } catch (e) { toast(e.message, true); $('#f-save').disabled = false; }
  };
}

function pasteJson() {
  modal(`<div class="mhead">${logo('mcp', 40)}<div><small>Añadir desde el README</small><h2>Pegar JSON</h2></div></div>
    <p class="sub" style="margin-top:12px">Acepta el formato de Claude/Cursor (<code>mcpServers</code>), VS Code (<code>servers</code>) u OpenCode (<code>mcp</code>).</p>
    <div class="form"><textarea id="j-text" class="field mono" rows="11" placeholder='{
  "mcpServers": {
    "mi-servidor": { "command": "npx", "args": ["-y", "paquete"] }
  }
}'></textarea>
    <div class="flabel">Conectar a${targetsChecks(null)}</div></div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="j-ok">Añadir</button></div>`);
  $('#j-ok').onclick = async () => {
    try {
      const r = await api('/api/import-json', { json: $('#j-text').value, targets: readTargets() });
      reportErrors(r.errors); toast(`Añadidos: ${r.names.join(', ')}`); closeModal(); refresh();
    } catch (e) { toast(e.message, true); }
  };
}

async function doImport() {
  try { const r = await api('/api/import', {}); toast(r.added ? `${r.added} servidor(es) importados` : 'Nada nuevo que importar'); refresh(); }
  catch (e) { toast(e.message, true); }
}
$('#btn-import').onclick = doImport;
$('#btn-add').onclick = () => editServer(null);
$('#btn-paste').onclick = pasteJson;
$('#btn-sync').onclick = async (e) => {
  const b = e.currentTarget;
  b.disabled = true; b.innerHTML = '<span class="spin"></span>Sincronizando';
  try { reportErrors((await api('/api/sync', {})).errors) && toast('Configuraciones sincronizadas'); }
  catch (err) { toast(err.message, true); }
  b.disabled = false; b.innerHTML = svg('sync') + 'Sincronizar';
  refresh();
};

// ---------------- Catálogo ----------------
function renderCatalog() {
  const q = $('#catalog-search').value.toLowerCase();
  const names = new Set(Object.keys(S.servers));
  const installedIds = new Set(Object.values(S.servers).map((s) => s.catalogId).filter(Boolean));
  const isInst = (c) => installedIds.has(c.id) || names.has(c.id);
  const nInst = S.catalog.filter(isInst).length;
  $('#catalog-sub').textContent = `${S.catalog.length} servidores MCP listos para instalar en todos tus agentes a la vez.`;
  const cats = ['Todos', ...new Set(S.catalog.map((c) => c.cat)), 'Instalados'];
  $('#catalog-cats').innerHTML = cats.map((c) => `<button class="chip ${c === catFilter ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}${c === 'Instalados' ? ` · ${nInst}` : ''}</button>`).join('');
  $$('#catalog-cats .chip').forEach((b) => (b.onclick = () => { catFilter = b.dataset.cat; renderCatalog(); }));
  const list = S.catalog.filter((c) => (!q || (c.name + c.desc + c.cat).toLowerCase().includes(q))
    && (catFilter === 'Todos' || (catFilter === 'Instalados' ? isInst(c) : c.cat === catFilter)));
  $('#catalog-grid').innerHTML = list.map((c) => {
    const inst = isInst(c);
    const secret = (c.fields || []).some((f) => f.type === 'secret');
    const run = c.spec.transport === 'stdio' ? c.spec.command : /127\.0\.0\.1|localhost/.test(c.spec.url) ? 'local · http' : 'remoto';
    return `<article class="card ${inst ? 'installed' : ''}"><div class="head">${logo(c.id, 40)}<div><b>${esc(c.name)}</b><small>${esc(c.cat)}</small></div></div>
      <p>${esc(c.desc)}</p>
      <div class="foot"><span class="runtag">${esc(run)}${secret ? ' · token' : ''}</span>
      ${inst ? `<span class="done">${svg('check')}Instalado</span>` : `<button class="btn sm" data-cat="${c.id}">Instalar</button>`}</div></article>`;
  }).join('') || '<div class="empty-state" style="grid-column:1/-1"><p>No hay resultados.</p></div>';
  $$('#catalog-grid [data-cat]').forEach((b) => (b.onclick = () => installCatalog(b.dataset.cat)));
}
$('#catalog-search').addEventListener('input', renderCatalog);

function installCatalog(id) {
  const c = S.catalog.find((x) => x.id === id);
  modal(`<div class="mhead">${logo(c.id, 44)}<div><small>${esc(c.cat)}</small><h2>Instalar ${esc(c.name)}</h2></div></div>
    <p class="sub" style="margin-top:12px">${esc(c.desc)}</p>
    <div class="form">
      <label>Nombre<input id="i-name" class="field" value="${esc(c.id)}"></label>
      ${(c.fields || []).map((f) => `<label>${esc(f.label)}<input data-field="${f.key}" type="${f.type === 'secret' ? 'password' : 'text'}" class="field mono" value="${esc(f.default || '')}" placeholder="${esc(f.placeholder || '')}"></label>`).join('')}
      <div class="flabel">Conectar a${targetsChecks(null)}</div>
      <label class="check" style="align-self:flex-start"><input type="checkbox" id="i-test" checked>Probar tras instalar (descarga el paquete ahora)${tick}</label>
      <div id="i-result"></div>
    </div>
    <div class="mfoot"><button class="btn" data-close>Cerrar</button><button class="btn primary" id="i-ok">Instalar</button></div>`);
  $('#i-ok').onclick = async () => {
    const values = Object.fromEntries($$('#modal [data-field]').map((i) => [i.dataset.field, i.value.trim()]));
    $('#i-ok').disabled = true;
    try {
      const r = await api('/api/install', { catalogId: id, name: $('#i-name').value.trim(), values, targets: readTargets() });
      reportErrors(r.errors);
      toast(`${r.name} instalado y conectado`);
      refresh();
      if ($('#i-test').checked) {
        $('#i-result').innerHTML = '<span class="spin"></span> Probando el servidor…';
        $('#i-result').innerHTML = testHtml(await api('/api/test', { name: r.name }));
      } else closeModal();
    } catch (e) { toast(e.message, true); }
    const ok = $('#i-ok'); if (ok) ok.disabled = false;
  };
}

// ---------------- Agentes ----------------
const AUTH = {
  subscription: { cls: 'ok', icon: 'shield', label: 'Suscripción' },
  apikey: { cls: '', icon: 'key', label: 'API key' },
  none: { cls: 'err', icon: null, label: 'Sin sesión' },
  unknown: { cls: '', icon: null, label: null },
};
function authInfo(c) {
  const a = authCache[c.id];
  if (!a) return { pill: '<span class="pill"><span class="spin"></span></span>', line: c.plan, kind: 'loading' };
  const m = AUTH[a.kind] || AUTH.unknown;
  const pill = `<span class="pill ${m.cls}" title="${esc(a.text)}">${m.icon ? svg(m.icon) : m.cls === 'err' ? '<span class="dot err"></span>' : ''}${esc(m.label || c.plan)}</span>`;
  const line = a.kind === 'subscription' ? `${c.plan}${/claude\.ai/.test(a.text) ? ' · claude.ai' : ''}`
    : a.kind === 'apikey' ? 'Usa una API key · pago por uso' : c.plan;
  return { pill, line, kind: a.kind };
}
async function loadAuth(force) {
  for (const c of S.clients) {
    if (!c.installed || (authCache[c.id] && !force)) continue;
    if (force) delete authCache[c.id];
    api('/api/auth-status', { client: c.id }).then((r) => { authCache[c.id] = r; renderAgents(); renderProviders(); }).catch(() => {});
  }
  if (force) { renderAgents(); renderProviders(); }
}
$('#btn-refresh-auth').onclick = () => loadAuth(true);

function renderAgents() {
  $('#agents-grid').innerHTML = S.clients.map((c) => {
    const mcps = Object.keys(c.servers);
    const a = c.installed ? authInfo(c) : null;
    let second = '';
    if (c.installed) {
      if (a.kind === 'apikey') second = `<button class="btn warn-ghost" data-login="${c.id}">Usar ${esc(c.plan)}</button>`;
      else if (a.kind === 'none') second = `<button class="btn" data-login="${c.id}">Iniciar sesión</button>`;
      else second = `<button class="btn icon" data-login="${c.id}" aria-label="Cuenta de ${esc(c.name)}" title="Cuenta">${svg('shield')}</button>`;
    }
    return `<article class="card agent"><div class="head">${logo(c.id, 44)}<div><b>${esc(c.name)}</b><small class="mono">${c.installed ? esc(c.version || c.bin) : 'No instalado'}</small></div>${c.installed ? a.pill : ''}</div>
      <div class="line"><span>${c.installed ? esc(a.line) : `<span class="mono">${esc(c.install)}</span>`}</span>
        <span>${mcps.length ? `${mcps.length} MCP${mcps.length > 1 ? 's' : ''} ${mcps.slice(0, 4).map((n) => logo(serverKey(n, c.servers[n]), 16, { plain: true, alt: n })).join('')}` : 'Sin MCPs'}</span></div>
      ${c.error ? `<pre class="err">${esc(c.error)}</pre>` : ''}
      <div class="btns">${c.installed ? `<button class="btn primary" data-launch="${c.id}">${svg('play')}Abrir</button>${second}`
        : `<button class="btn primary" data-install="${c.id}">Instalar ${esc(c.name)}</button>`}</div></article>`;
  }).join('') + `<article class="card agent ghost"><div class="head">${logo('shell', 44)}<div><b>Shell</b><small>Terminal normal en una carpeta</small></div></div>
      <div class="line"><span>Para comandos sueltos o instalar otros agentes.</span></div>
      <div class="btns"><button class="btn" data-launch="shell">${svg('shell')}Abrir shell</button></div></article>`;
  $$('#agents-grid [data-launch]').forEach((b) => (b.onclick = () => launchSheet(b.dataset.launch)));
  $$('#agents-grid [data-install]').forEach((b) => (b.onclick = () => openSession({ client: b.dataset.install, install: true, cwd: '~' })));
  $$('#agents-grid [data-login]').forEach((b) => (b.onclick = () => loginDialog(b.dataset.login)));
}

function loginDialog(id) {
  const c = client(id);
  const a = authCache[id];
  const notes = {
    claude: 'Se abrirá <code>claude auth login</code>. Elige la cuenta con suscripción (Pro/Max) para no usar la API.',
    codex: 'Se abrirá <code>codex login</code>: elige “Sign in with ChatGPT” (Plus/Pro/Business). <b>Sustituye</b> el login actual con API key.',
    opencode: 'Se abrirá <code>opencode auth login</code>. Elige un proveedor con suscripción: OpenAI (ChatGPT Plus/Pro), GitHub Copilot u OpenCode Zen.',
    gemini: 'Se abrirá Gemini CLI: elige “Login with Google” para usar tu cuenta en lugar de una API key.',
    cursor: 'Se abrirá <code>cursor-agent login</code> con tu cuenta de Cursor.',
  };
  modal(`<div class="mhead">${logo(id, 44)}<div><small>Cuenta · ${esc(c.plan)}</small><h2>Iniciar sesión en ${esc(c.name)}</h2></div></div>
    <p class="sub" style="margin-top:14px">${notes[id] || ''}</p>
    ${a ? `<div class="form"><div class="flabel">Estado actual<pre class="box">${esc(a.text)}</pre></div></div>` : ''}
    <p class="hint" style="margin-top:14px">Las API keys se quitan del entorno durante el login para que se use la suscripción.</p>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="l-ok">${svg('shield')}Abrir login</button></div>`);
  $('#l-ok').onclick = () => { closeModal(); delete authCache[id]; openSession({ client: id, login: true, cwd: '~' }); };
}

function launchSheet(id, preset = {}) {
  const c = client(id);
  const basePrefs = { ...(lastLaunch[id] || {}), ...preset };
  const availableProfiles = (S.projectProfiles || []).filter((p) => p.client === id);
  const autoProfile = !Object.hasOwn(preset, 'profileId') && preset.account === undefined && preset.mode === undefined
    ? availableProfiles.find((p) => p.cwd === (basePrefs.cwd || S.recentDirs[0] || S.home)) : null;
  const wantedProfileId = Object.hasOwn(preset, 'profileId') ? preset.profileId : (basePrefs.profileId || autoProfile?.id || '');
  const activeProfile = availableProfiles.find((p) => p.id === wantedProfileId) || null;
  const prev = activeProfile ? { ...basePrefs, ...activeProfile, profileId: activeProfile.id, profileInstructions: activeProfile.instructions }
    : { ...basePrefs, profileId: '' };
  let cwd = prev.cwd || S.recentDirs[0] || S.home;
  let mode = c?.strict ? prev.mode || 'all' : 'all';
  let where = prev.external ? 'external' : 'app';
  const servers = Object.keys(S.servers).sort();
  const connected = new Set(Object.keys(c?.servers || {}));
  const sel = new Set(prev.mcps || [...connected]);
  const accounts = [];
  if (c) {
    accounts.push({ v: 'subscription', title: 'Suscripción', sub: `${c.plan} · sin API keys en el entorno`, icon: 'shield' });
    for (const [pid, p] of Object.entries(S.providers)) if (p.compatible.includes(id)) accounts.push({ v: `provider:${pid}`, title: `API · ${p.name}`, sub: p.defaultModel || 'Pago por uso', logo: providerKey(pid, p) });
    accounts.push({ v: 'default', title: 'Configuración del agente', sub: 'Tal cual, con su entorno actual', icon: 'servers' });
  }
  const acc0 = accounts.some((x) => x.v === prev.account) ? prev.account : 'subscription';

  modal(`<div class="mhead">${logo(id, 40)}<div><small>Nueva sesión</small><h2>Abrir ${esc(c?.name || 'shell')}</h2></div><button class="btn icon sm" data-close aria-label="Cerrar">${svg('x')}</button></div>
    <div class="form">
      ${c ? `<div class="flabel">Perfil de proyecto
        <select id="l-profile" class="field"><option value="">Sin perfil</option>${availableProfiles.map((p) => `<option value="${p.id}" ${p.id === activeProfile?.id ? 'selected' : ''}>${esc(p.name)} · ${esc(tilde(p.cwd))}</option>`).join('')}</select>
        <span class="hint">Un perfil fija la carpeta, el agente, la cuenta, los MCPs y las credenciales autorizadas. <a href="#" id="l-manage-profiles">Gestionar perfiles</a></span>
      </div>` : ''}
      <div class="flabel">Carpeta de trabajo
        <input id="l-cwd" class="field mono" value="${esc(tilde(cwd))}">
        <div class="recent">${S.recentDirs.slice(0, 6).map((d) => `<button type="button" data-dir="${esc(d)}">${esc(tilde(d))}</button>`).join('')}</div>
        <div class="dirs" id="l-dirs"></div>
      </div>
      ${c ? `
      <div class="flabel">Cuenta<div class="radio-list">${accounts.map((x) => `<label class="radio-card"><input type="radio" name="acc" value="${esc(x.v)}" ${x.v === acc0 ? 'checked' : ''}><span><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></span>${x.logo ? logo(x.logo, 22, { plain: true }) : `<span style="color:${x.v === 'subscription' ? 'var(--ok-text)' : 'var(--dim)'}">${svg(x.icon)}</span>`}</label>`).join('')}</div>
        ${Object.keys(S.providers).length ? '' : `<span class="hint">¿Otra IA? Añade un proveedor en <a href="#" id="l-goprov">Cuentas y APIs</a>.</span>`}</div>
      <label id="l-model-wrap">Modelo<input id="l-model" class="field mono" list="l-models" value="${esc(prev.model || '')}" placeholder="por defecto del proveedor"><datalist id="l-models"></datalist></label>
      <div class="flabel"><span style="display:flex;justify-content:space-between">MCPs para esta sesión <span class="hint" id="l-count"></span></span>
        <div class="seg" id="l-mode"><button type="button" data-m="all">Los conectados (${connected.size})</button><button type="button" data-m="selected" ${c.strict ? '' : 'disabled title="Este agente no permite elegir por sesión"'}>Elegir</button></div>
        <div class="checks" id="l-mcps">${servers.map((n) => `<label class="check"><input type="checkbox" value="${esc(n)}" ${sel.has(n) ? 'checked' : ''}>${logo(serverKey(n, S.servers[n]), 16, { plain: true })}${esc(n)}${tick}</label>`).join('') || '<span class="hint">No hay servidores en MCP Hub.</span>'}</div>
        ${id === 'gemini' ? '<span class="hint">Gemini solo puede filtrar entre los MCPs ya conectados a Gemini.</span>' : ''}
      </div>
      <div class="flabel">Credenciales como variables de entorno
        ${!S.vault?.unlocked ? `<span class="hint">${S.vault?.exists ? 'La Bóveda está bloqueada.' : 'Aún no tienes Bóveda.'} <a href="#" id="l-govault">Ir a la Bóveda</a></span>`
          : S.vault.env.length ? `<div class="checks" id="l-secrets">${S.vault.env.map((x) => `<label class="check"><input type="checkbox" value="${x.id}" ${(prev.secrets || []).includes(x.id) ? 'checked' : ''}>${logo(itemKey(x), 16, { plain: true })}<span class="mono" style="font-size:12px">${esc(x.envVar)}</span>${tick}</label>`).join('')}</div>`
          : '<span class="hint">Ninguna credencial tiene variable de entorno. Añádela al editarla en la Bóveda.</span>'}
      </div>
      <label>Instrucciones para el inicio <span class="hint">Se envían al agente como su primer mensaje.</span><textarea id="l-instructions" class="field" rows="4" maxlength="8000" placeholder="Convenciones del proyecto, objetivo o contexto inicial…">${esc(prev.profileInstructions || prev.initialPrompt || '')}</textarea></label>
      <label>Argumentos extra<input id="l-args" class="field mono" value="${esc(prev.extraArgs || '')}" placeholder="${id === 'claude' ? '--continue' : id === 'codex' ? '--full-auto' : ''}"></label>` : ''}
      <div class="flabel">Abrir en<div class="seg" id="l-where"><button type="button" data-w="app">Pestaña de MCP Hub</button><button type="button" data-w="external">Terminal externa</button></div></div>
    </div>
    <div class="mfoot">${c ? `<button class="btn" id="l-save-profile">${svg('plus')}Guardar como perfil</button>` : ''}<button class="btn primary go" id="l-go">${svg('play')}Abrir ${esc(c?.name || 'shell')} <span class="kbd">Ctrl ↵</span></button></div>`, { sheet: true });

  $('#l-goprov')?.addEventListener('click', (e) => { e.preventDefault(); closeModal(); show('providers'); });
  $('#l-govault')?.addEventListener('click', (e) => { e.preventDefault(); closeModal(); show('vault'); });
  $('#l-manage-profiles')?.addEventListener('click', (e) => { e.preventDefault(); window.openProjectProfiles?.(); });
  $('#l-profile')?.addEventListener('change', () => {
    const selected = $('#l-profile').value;
    const current = {
      profileId: selected,
      cwd: tilde($('#l-cwd').value), external: where === 'external',
      mode, mcps: $$('#l-mcps input:checked').map((i) => i.value),
      account: $('input[name=acc]:checked')?.value, model: $('#l-model')?.value || '',
      secrets: $$('#l-secrets input:checked').map((i) => i.value),
      profileInstructions: $('#l-instructions')?.value || '', extraArgs: $('#l-args')?.value || '',
    };
    launchSheet(id, current);
  });
  if (activeProfile) $$('#l-secrets input').forEach((input) => { input.disabled = true; });
  const loadDirs = async (p) => {
    try {
      const r = await api('/api/dirs?path=' + encodeURIComponent(p));
      cwd = r.path; $('#l-cwd').value = tilde(r.path);
      $$('.recent button').forEach((b) => b.classList.toggle('on', b.dataset.dir === r.path));
      $('#l-dirs').innerHTML = `<button type="button" data-sub="${esc(r.parent)}">${svg('up')}..</button>` + r.entries.map((e) => `<button type="button" data-sub="${esc(r.path.replace(/\/$/, '') + '/' + e)}">${svg('folder')}${esc(e)}</button>`).join('');
      $$('#l-dirs [data-sub]').forEach((d) => (d.onclick = () => loadDirs(d.dataset.sub)));
    } catch (e) { $('#l-dirs').innerHTML = `<div class="hint warn" style="padding:8px 10px">${esc(e.message)}</div>`; }
  };
  loadDirs(cwd);
  $('#l-cwd').addEventListener('change', () => loadDirs($('#l-cwd').value));
  $$('.recent [data-dir]').forEach((b) => (b.onclick = () => loadDirs(b.dataset.dir)));

  const segs = () => {
    $$('#l-where button').forEach((b) => b.classList.toggle('on', b.dataset.w === where));
    if (!c) return;
    $$('#l-mode button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
    $('#l-mcps').style.display = mode === 'selected' ? '' : 'none';
    $('#l-count').textContent = mode === 'selected' ? `${$$('#l-mcps input:checked').length} de ${servers.length}` : '';
  };
  $$('#l-where button').forEach((b) => (b.onclick = () => { where = b.dataset.w; segs(); }));
  if (c) {
    $$('#l-mode button').forEach((b) => (b.onclick = () => { mode = b.dataset.m; segs(); }));
    $('#l-mcps').addEventListener('change', segs);
    const acc = () => {
      const v = $('input[name=acc]:checked').value;
      const isProv = v.startsWith('provider:');
      $('#l-model-wrap').style.display = isProv ? '' : 'none';
      if (isProv) {
        const p = S.providers[v.slice(9)];
        $('#l-models').innerHTML = (p.models || []).map((m) => `<option value="${esc(m)}">`).join('');
        if (prev.account !== v) $('#l-model').value = p.defaultModel || '';
      }
    };
    $$('input[name=acc]').forEach((r) => (r.onchange = acc)); acc();
  }
  segs();
  const go = () => {
    const opts = { client: id, cwd, external: where === 'external' };
    if (c) Object.assign(opts, {
      mode, mcps: $$('#l-mcps input:checked').map((i) => i.value), extraArgs: $('#l-args').value,
      account: $('input[name=acc]:checked').value, model: $('#l-model').value.trim(),
      secrets: $$('#l-secrets input:checked').map((i) => i.value),
    });
    if (activeProfile) {
      opts.profileId = activeProfile.id;
      opts.profileInstructions = $('#l-instructions').value;
    } else if (c) opts.initialPrompt = $('#l-instructions').value.trim();
    lastLaunch[id] = opts; saveLocal();
    closeModal();
    openSession(opts);
  };
  $('#l-save-profile')?.addEventListener('click', () => window.openProjectProfileEditor?.({
    name: activeProfile?.name || '', cwd, client: id, account: $('input[name=acc]:checked')?.value || 'subscription',
    model: $('#l-model')?.value || '', mode, mcps: $$('#l-mcps input:checked').map((i) => i.value),
    skills: activeProfile?.skills || [], instructions: $('#l-instructions')?.value || '',
    secrets: $$('#l-secrets input:checked').map((i) => i.value),
  }, activeProfile?.id));
  $('#l-go').onclick = go;
  $('#modal-box').onkeydown = (e) => { if (e.key === 'Enter' && e.ctrlKey) go(); };
}

async function openSession(opts) {
  try {
    const t = $('#term-host');
    const r = await api('/api/sessions', { ...opts, cols: Math.floor((t.clientWidth || 1000) / 8.2), rows: Math.floor((t.clientHeight || 600) / 18) });
    if (!r.session) { toast('Abierto en una terminal externa'); return; }
    S.sessions = [...S.sessions.filter((s) => s.id !== r.session.id), r.session];
    activeId = r.session.id;
    show('terms'); syncTabs();
  } catch (e) { toast(e.message, true); }
}

function renderQuick() {
  const items = [...S.clients.map((c) => [c.id, c.name, c.installed]), ['shell', 'Shell', true]];
  $('#quick-launch').innerHTML = items.map(([id, name, ok]) =>
    `<button data-q="${id}" ${ok ? '' : 'disabled'} aria-label="Abrir ${esc(name)}" title="${esc(name)} — clic: última configuración · Mayús+clic: opciones">${logo(id, 24, { plain: true })}</button>`).join('');
  $$('#quick-launch [data-q]').forEach((b) => (b.onclick = (e) => {
    const id = b.dataset.q;
    if (e.shiftKey || !lastLaunch[id]) return launchSheet(id);
    openSession({ ...lastLaunch[id], external: false });
  }));
}

// ---------------- Cuentas y APIs ----------------
function renderProviders() {
  const subs = [['claude', 'Claude Pro / Max'], ['codex', 'ChatGPT Plus / Pro'], ['opencode', 'OpenCode'], ['gemini', 'Cuenta de Google'], ['cursor', 'Cursor Pro']];
  $('#subs').innerHTML = subs.map(([id, title]) => {
    const c = client(id); if (!c) return '';
    const a = authCache[id];
    let state = 'Sin comprobar', cls = '', btn = `<button class="btn xs" data-login="${id}">Conectar</button>`;
    if (!c.installed) { state = 'Agente no instalado'; btn = ''; }
    else if (!a) { state = '<span class="spin"></span>'; btn = ''; }
    else if (a.kind === 'subscription') { state = '<span><span class="dot ok"></span>&nbsp; Sesión iniciada</span>'; cls = 'ok'; btn = ''; }
    else if (a.kind === 'apikey') { state = `${esc(c.name)} usa una API key`; cls = 'warn'; btn = `<button class="btn xs warn" data-login="${id}">Conectar</button>`; }
    else if (a.kind === 'none') { state = 'Sin sesión'; cls = 'err'; }
    return `<article class="card sub-card ${cls === 'warn' ? 'warn' : ''}"><div class="head">${logo(id, 36)}<div><b>${esc(title)}</b><small>${esc(id === 'opencode' ? 'ChatGPT, Copilot u OpenCode Zen' : c.name)}</small></div></div>
      <div class="state ${cls}">${state}${btn}</div></article>`;
  }).join('');
  $$('#subs [data-login]').forEach((b) => (b.onclick = () => loginDialog(b.dataset.login)));

  const list = Object.entries(S.providers);
  $('#providers-list').innerHTML = !list.length
    ? `<div class="empty-state">${logo('custom', 44)}<p><b>Sin proveedores todavía</b></p><p>Añade una API para usar otros modelos dentro de Claude Code, Codex u OpenCode.</p></div>`
    : `<div class="table">${list.map(([id, p]) => {
      const host = (p.openaiUrl || p.anthropicUrl || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      const local = /localhost|127\.0\.0\.1/.test(host);
      return `<div class="prow" data-id="${esc(id)}">
        <div class="srv">${logo(providerKey(id, p), 40)}<div class="meta"><div class="name">${esc(p.name)}${local ? '<span class="tag local">local</span>' : ''}</div><span class="cmd">${esc(host)}</span></div></div>
        <span class="mono" style="color:var(--n8)">${p.apiKey ? esc(p.apiKey) : '<span style="color:var(--dim);font-family:var(--sans)">Sin key</span>'}</span>
        <div class="compat">${p.compatible.map((c) => `<button class="btn icon xs" style="width:30px" data-use="${c}" aria-label="Abrir con ${esc(clientName(c))}" title="Abrir con ${esc(clientName(c))}">${logo(c, 18, { plain: true })}</button>`).join('')}</div>
        <span class="model ${p.defaultModel ? '' : 'empty'}">${esc(p.defaultModel || 'elige un modelo')}</span>
        <div class="row-actions"><button class="btn sm" data-act="models">${svg('bolt')}Probar</button><button class="btn sm icon" data-act="edit" aria-label="Editar">${svg('edit')}</button><button class="btn sm icon" data-act="del" aria-label="Eliminar">${svg('trash')}</button></div>
        <div class="models"></div></div>`;
    }).join('')}</div>`;
  $$('#providers-list [data-use]').forEach((b) => (b.onclick = () => {
    const id = b.closest('.prow').dataset.id;
    launchSheet(b.dataset.use, { account: `provider:${id}`, model: S.providers[id].defaultModel });
  }));
  $$('#providers-list [data-act]').forEach((b) => (b.onclick = async () => {
    const row = b.closest('.prow'), id = row.dataset.id;
    if (b.dataset.act === 'edit') return editProvider(id);
    if (b.dataset.act === 'del') {
      if (b.dataset.confirm) { await api('/api/providers/delete', { id }); toast('Proveedor eliminado'); return refresh(); }
      b.dataset.confirm = 1; b.classList.add('danger'); b.title = 'Pulsa otra vez para eliminar'; return;
    }
    const box = $('.models', row);
    box.innerHTML = '<span class="spin"></span>';
    try {
      const r = await api('/api/providers/models', { id });
      box.innerHTML = `<span class="pill ok">${svg('check')}Funciona · ${r.models.length} modelos</span> <span class="hint">clic en uno para usarlo por defecto</span><div class="tools">${r.models.slice(0, 80).map((m) => `<span style="cursor:pointer">${esc(m)}</span>`).join('')}</div>`;
      $$('.tools span', box).forEach((s) => (s.onclick = async () => {
        const p = S.providers[id];
        await api('/api/providers', { id, provider: { ...p, defaultModel: s.textContent, models: [...new Set([...(p.models || []), s.textContent])] } });
        toast(`Modelo por defecto: ${s.textContent}`); refresh();
      }));
    } catch (e) { box.innerHTML = `<pre class="err">${esc(e.message)}</pre>`; }
  }));

  $('#presets').innerHTML = S.presets.map((x) => `<button class="preset" data-preset="${x.id}">${logo(x.id, 28)}${esc(x.name)}</button>`).join('');
  $$('#presets [data-preset]').forEach((b) => (b.onclick = () => editProvider(null, b.dataset.preset)));
}

function editProvider(id, presetId) {
  const p = id ? S.providers[id] : null;
  modal(`<div class="mhead"><span id="p-logo">${logo(p ? providerKey(id, p) : presetId || 'custom', 44)}</span><div><small>Proveedor de IA por API</small><h2 id="p-title">${esc(p?.name || 'Añadir proveedor')}</h2></div></div>
    <p class="sub" style="margin-top:12px">Endpoint <b>OpenAI‑compatible</b> → Codex y OpenCode. Endpoint <b>Anthropic‑compatible</b> → Claude Code (y OpenCode).</p>
    <div class="form">
      ${p ? '' : `<label>Plantilla<select id="p-preset" class="field"><option value="">— Elegir —</option>${S.presets.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>`}
      <div class="row"><label>Nombre<input id="p-name" class="field" value="${esc(p?.name || '')}"></label><label>Identificador<input id="p-id" class="field mono" value="${esc(id || '')}" ${p ? 'disabled' : ''} placeholder="openrouter"></label></div>
      <label>URL OpenAI‑compatible<input id="p-openai" class="field mono" value="${esc(p?.openaiUrl || '')}" placeholder="https://…/v1"></label>
      <label>URL Anthropic‑compatible<input id="p-anthropic" class="field mono" value="${esc(p?.anthropicUrl || '')}" placeholder="https://…/anthropic"></label>
      <label><span>API key <span id="p-keylink"></span></span><input id="p-key" type="password" class="field mono" value="${esc(p?.apiKey || '')}" placeholder="sk-…"></label>
      <div class="row"><label>Modelos <span class="hint">separados por coma</span><input id="p-models" class="field mono" value="${esc((p?.models || []).join(', '))}"></label>
      <label>Modelo por defecto<input id="p-default" class="field mono" value="${esc(p?.defaultModel || '')}"></label></div>
      <label>API para Codex<select id="p-wire" class="field"><option value="chat">Chat Completions (la mayoría)</option><option value="responses">Responses (OpenAI, OpenRouter)</option></select></label>
      <span class="hint">La key se guarda en <code>~/.config/mcp-hub/servers.json</code> (solo tu usuario) y solo se pasa al agente al abrirlo.</span>
    </div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="p-ok">Guardar</button></div>`);
  $('#p-wire').value = p?.wireApi || 'chat';
  const applyPreset = (pid) => {
    const x = S.presets.find((y) => y.id === pid); if (!x) return;
    $('#p-name').value = x.custom ? '' : x.name; $('#p-id').value = x.custom ? '' : x.id;
    $('#p-openai').value = x.openaiUrl || ''; $('#p-anthropic').value = x.anthropicUrl || '';
    $('#p-models').value = (x.models || []).join(', '); $('#p-default').value = (x.models || [])[0] || '';
    $('#p-wire').value = x.wireApi || 'chat';
    $('#p-key').placeholder = x.noKey ? 'No necesita key (local)' : 'sk-…';
    $('#p-keylink').innerHTML = x.keyUrl ? `· <a href="${esc(x.keyUrl)}" target="_blank">conseguir key</a>` : '';
    $('#p-title').textContent = x.custom ? 'Proveedor personalizado' : x.name;
    $('#p-logo').innerHTML = logo(x.id, 44);
  };
  $('#p-preset')?.addEventListener('change', (e) => applyPreset(e.target.value));
  if (presetId && $('#p-preset')) { $('#p-preset').value = presetId; applyPreset(presetId); }
  $('#p-ok').onclick = async () => {
    try {
      await api('/api/providers', { id: $('#p-id').value.trim(), provider: {
        name: $('#p-name').value.trim(), openaiUrl: $('#p-openai').value.trim(), anthropicUrl: $('#p-anthropic').value.trim(),
        apiKey: $('#p-key').value.trim(), models: $('#p-models').value.split(',').map((x) => x.trim()).filter(Boolean),
        defaultModel: $('#p-default').value.trim(), wireApi: $('#p-wire').value } });
      toast('Proveedor guardado'); closeModal(); refresh();
    } catch (e) { toast(e.message, true); }
  };
}
$('#btn-add-provider').onclick = () => editProvider(null);

// ---------------- Terminales ----------------
const terms = new Map();
let activeId = null;

function sessionLabel(s) {
  const i = s.title.lastIndexOf(' · ');
  return i < 0 ? esc(s.title) : `${esc(s.title.slice(0, i))}<span> · ${esc(s.title.slice(i + 3))}</span>`;
}

function syncTabs() {
  const live = S.sessions.filter((s) => !s.exited);
  $('#count-terms').textContent = live.length || '';
  for (const [id, t] of terms) if (!S.sessions.find((s) => s.id === id)) { t.ws?.close(); t.term.dispose(); t.el.remove(); terms.delete(id); }
  if (!S.sessions.find((s) => s.id === activeId)) activeId = S.sessions.at(-1)?.id || null;

  $('#term-tabs').innerHTML = S.sessions.map((s) => `<div class="tab ${s.id === activeId ? 'active' : ''} ${s.exited ? 'exited' : ''}" data-id="${s.id}" role="tab" aria-selected="${s.id === activeId}" tabindex="0" title="${esc(s.cwd)}">
    ${logo(s.client, 18, { plain: true })}<span class="label">${sessionLabel(s)}</span>${s.exited ? '' : '<span class="dot ok" style="width:6px;height:6px"></span>'}<span class="x" role="button" aria-label="Cerrar pestaña">${svg('x')}</span></div>`).join('')
    + `<button class="tab-new" id="tab-new" aria-label="Nueva sesión" title="Nueva sesión">${svg('plus')}</button>`;
  $('#tab-new').onclick = () => show('agents');
  $$('#term-tabs .tab').forEach((el) => {
    el.onclick = (e) => { if (e.target.closest('.x')) return closeSession(el.dataset.id); if (el.dataset.id !== activeId) { activeId = el.dataset.id; syncTabs(); } };
    el.onauxclick = (e) => { if (e.button === 1) closeSession(el.dataset.id); };
    el.ondblclick = () => {
      const s = S.sessions.find((x) => x.id === el.dataset.id);
      const lbl = el.querySelector('.label');
      lbl.textContent = s.title; lbl.contentEditable = true; lbl.focus();
      const done = () => { lbl.contentEditable = false; api('/api/sessions/rename', { id: s.id, title: lbl.textContent.trim() || s.title }); };
      lbl.onblur = done; lbl.onkeydown = (k) => { if (k.key === 'Enter') { k.preventDefault(); lbl.blur(); } };
    };
  });

  $('#side-sessions-wrap').classList.toggle('hidden', !live.length);
  $('#side-sessions').innerHTML = live.map((s) => `<button class="side-sess" data-id="${s.id}">${logo(s.client, 24)}<span class="t">${sessionLabel(s)}</span><span class="dot ok"></span></button>`).join('');
  $$('#side-sessions .side-sess').forEach((b) => (b.onclick = () => { activeId = b.dataset.id; show('terms'); syncTabs(); }));

  $('#term-empty').style.display = S.sessions.length ? 'none' : '';
  $('#foot-count').textContent = `${live.length} ${live.length === 1 ? 'sesión' : 'sesiones'}`;
  for (const s of S.sessions) if (!terms.has(s.id)) attach(s);
  for (const [id, t] of terms) t.el.classList.toggle('active', id === activeId);
  renderSide();
  requestAnimationFrame(fitActive);
}

function renderSide() {
  const s = S.sessions.find((x) => x.id === activeId);
  if (!s) { $('#term-side').innerHTML = ''; return; }
  const mins = Math.max(0, Math.round((Date.now() - s.created) / 60000));
  const accStyle = /Suscripción/.test(s.account || '') ? 'color:var(--ok-text)' : '';
  $('#term-side').innerHTML = `
    <div><div class="side-title" style="padding-left:0">Sesión</div>
      <div class="kv"><span>Agente</span><span>${logo(s.client, 16, { plain: true })}${esc(s.client === 'shell' ? 'Shell' : clientName(s.client))}</span>
      ${s.account ? `<span>Cuenta</span><span style="${accStyle}" title="${esc(s.account)}">${esc(s.account)}</span>` : ''}
      <span>Carpeta</span><span class="mono" title="${esc(s.cwd)}">${esc(tilde(s.cwd))}</span>
      <span>Estado</span><span>${s.exited ? `Terminada (${s.exitCode})` : `<span class="dot ok"></span> Activa · ${mins} min`}</span></div></div>
    ${s.mcps?.length ? `<div><div class="side-title" style="padding-left:0">MCPs conectados</div>${s.mcps.map((n) => `<div class="mcp-item">${logo(serverKey(n, S.servers[n] || client(s.client)?.servers[n]), 18, { plain: true })}<span>${esc(n)}</span></div>`).join('')}</div>` : ''}
    ${s.secrets?.length ? `<div><div class="side-title" style="padding-left:0">Variables de la Bóveda</div>${s.secrets.map((x) => `<div class="mcp-item">${logo('vault', 18, { plain: true })}<span class="mono" style="font-size:12px">${esc(x.envVar)}</span></div>`).join('')}</div>` : ''}
    ${window.sideExtras?.(s) || ''}
    <div class="btns">
      ${s.opts ? `<button class="btn block" data-side="clone" title="Abre otra sesión con la misma configuración para probar otro modelo, cuenta o enfoque">${svg('plus')}Clonar (otro modelo o enfoque)</button>
        <button class="btn block" data-side="ext">${svg('ext')}Abrir en terminal externa</button><button class="btn block" data-side="restart">${svg('sync')}Reiniciar sesión</button>` : ''}
      <button class="btn block danger" data-side="kill">${s.exited ? 'Cerrar' : 'Terminar'}</button>
    </div>`;
  $$('#term-side [data-side]').forEach((b) => (b.onclick = async () => {
    if (b.dataset.side === 'kill') return closeSession(s.id);
    if (b.dataset.side === 'ext') return openSession({ ...s.opts, external: true });
    if (b.dataset.side === 'clone') return launchSheet(s.client, { ...s.opts, external: false });
    await closeSession(s.id);
    openSession({ ...s.opts, external: false });
  }));
  window.bindSideExtras?.(s);
}

function attach(s) {
  const el = document.createElement('div');
  el.className = 'term';
  $('#term-host').append(el);
  const term = new Terminal({
    fontFamily: '"Geist Mono Variable", "JetBrainsMono Nerd Font", ui-monospace, monospace', fontSize: 13.5, lineHeight: 1.15,
    cursorBlink: true, allowProposedApi: true, scrollback: 10000,
    theme: { background: '#141413', foreground: '#E9E7E0', cursor: '#E8A21A', cursorAccent: '#141413', selectionBackground: '#4A4740',
      black: '#1A1D24', brightBlack: '#5C6370', red: '#FF8A8A', green: '#4ADE9A', yellow: '#F5C668', blue: '#6CB6FF',
      magenta: '#C9A6E8', cyan: '#62D2E0', white: '#D6D8DE', brightWhite: '#FFFFFF' },
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon.WebLinksAddon((_e, uri) => window.open(uri, '_blank')));
  term.open(el);
  const t = { term, fit, el, ws: null };
  terms.set(s.id, t);
  const connect = () => {
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/term/${s.id}?token=${TOKEN}`);
    t.ws = ws;
    let first = true;
    ws.onmessage = (e) => {
      if (e.data.startsWith('{"t":"exit"')) return;
      if (first) { term.reset(); first = false; }
      term.write(e.data);
    };
    ws.onopen = () => sendSize(s.id);
    ws.onclose = () => { if (terms.has(s.id) && !S.sessions.find((x) => x.id === s.id)?.exited) setTimeout(() => terms.has(s.id) && connect(), 1500); };
  };
  term.onData((d) => t.ws?.readyState === 1 && t.ws.send(JSON.stringify({ t: 'i', d })));
  term.attachCustomKeyEventHandler((e) => {
    if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && e.code === 'KeyC') { navigator.clipboard.writeText(term.getSelection()); return false; }
    if (e.type === 'keydown' && e.ctrlKey && e.shiftKey && e.code === 'KeyV') { navigator.clipboard.readText().then((x) => term.paste(x)); return false; }
    return true;
  });
  connect();
}
function sendSize(id) {
  const t = terms.get(id);
  if (!t || !t.el.classList.contains('active')) return;
  try { t.fit.fit(); } catch {}
  $('#foot-size').textContent = `${t.term.cols} × ${t.term.rows}`;
  t.ws?.readyState === 1 && t.ws.send(JSON.stringify({ t: 'r', cols: t.term.cols, rows: t.term.rows }));
}
function fitActive() { if (activeId && currentView === 'terms') { sendSize(activeId); terms.get(activeId)?.term.focus(); } }
new ResizeObserver(() => fitActive()).observe($('#term-host'));

async function closeSession(id) {
  await api('/api/sessions/kill', { id }).catch(() => {});
  S.sessions = S.sessions.filter((s) => s.id !== id);
  syncTabs();
}

// ---------------- Modal ----------------
function modal(html, { sheet = false } = {}) {
  $('#modal-box').innerHTML = html;
  $('#modal-box').onkeydown = null;
  $('#modal').classList.toggle('sheet', sheet);
  $('#modal').classList.remove('hidden');
  $$('#modal [data-close]').forEach((b) => (b.onclick = closeModal));
  setTimeout(() => $('#modal-box input:not([disabled]):not([type=radio]):not([type=checkbox]), #modal-box textarea')?.focus(), 30);
}
function closeModal() { $('#modal').classList.add('hidden'); $('#modal-box').innerHTML = ''; }
$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal(); });

// ---------------- Eventos del servidor ----------------
function events() {
  const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/events?token=${TOKEN}`);
  ws.onopen = () => { $('#status-dot').className = 'dot ok'; $('#m-dot').className = 'dot ok'; $('#status-text').textContent = REMOTE ? 'Conectado al ordenador' : 'Servidor en línea'; };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'sessions') { S.sessions = m.sessions; syncTabs(); if (currentView === 'messaging' && typeof renderMessaging === 'function') renderMessaging(); }
    if (m.t === 'delegations' && typeof loadDelegations === 'function') loadDelegations();
    if (m.t === 'remote' && typeof loadRemote === 'function') loadRemote();
    if ((m.t === 'design' || m.t === 'design-open') && typeof onDesignEvent === 'function') onDesignEvent(m);
    if (m.t === 'messaging' && typeof loadMessaging === 'function') { clearTimeout(window.msgT); window.msgT = setTimeout(loadMessaging, 300); }
    document.dispatchEvent(new CustomEvent('hub:' + m.t, { detail: m }));
  };
  ws.onclose = () => { $('#status-dot').className = 'dot err'; $('#m-dot').className = 'dot err'; $('#status-text').textContent = 'Reconectando…'; setTimeout(events, 2000); };
}
events();
setInterval(() => { if (currentView === 'terms') renderSide(); }, 60000);
if (location.hash && !location.hash.includes('/')) show(location.hash.slice(1));
refresh().then(() => { if (!Object.keys(S.servers).length && S.external.length) doImport(); loadAuth(); });

// ---------------- Móvil y tablet ----------------
$('#m-menu').onclick = () => document.body.classList.toggle('nav-open');
$('#nav-scrim').onclick = () => document.body.classList.remove('nav-open');
$$('#side-sessions, .side-bottom').forEach((el) => el.addEventListener('click', (e) => { if (e.target.closest('button')) document.body.classList.remove('nav-open'); }));
// Barra de teclas y caja de texto para las terminales en pantallas táctiles
const TERM_KEYS = { esc: '\x1b', tab: '\t', up: '\x1b[A', down: '\x1b[B', left: '\x1b[D', right: '\x1b[C', ctrlc: '\x03', enter: '\r' };
const termSend = (d) => { const t = terms.get(activeId); if (t?.ws?.readyState === 1) t.ws.send(JSON.stringify({ t: 'i', d })); else toast('No hay ninguna terminal activa', true); };
$$('#term-keys [data-k]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); termSend(TERM_KEYS[b.dataset.k]); }));
const tkSend = () => { const i = $('#tk-text'); if (!i.value) return termSend('\r'); termSend(i.value); i.value = ''; setTimeout(() => termSend('\r'), 150); };
$('#tk-send').onclick = tkSend;
$('#tk-text').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); tkSend(); } };
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('/sw.js').catch(() => {});

// ---------------- Sesiones de antes del reinicio ----------------
let prevSessions = [];
async function loadPrevious() {
  try { prevSessions = (await api('/api/sessions/previous')).sessions; } catch { prevSessions = []; }
  renderPrevious();
}
function renderPrevious() {
  const box = $('#term-restore'); if (!box) return;
  if (!prevSessions.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="restore">${svg('sync')}<span><b>Al cerrarse MCP Hub tenías ${prevSessions.length} sesión${prevSessions.length > 1 ? 'es' : ''} abierta${prevSessions.length > 1 ? 's' : ''}:</b>
      ${prevSessions.map((p) => `${logo(p.client, 14, { plain: true })} ${esc(p.title)}`).join(' · ')}</span>
    <button class="btn sm primary" id="pr-all" title="Vuelve a abrirlas y retoma la última conversación de cada agente en su carpeta">Restaurar</button>
    <button class="btn sm" id="pr-new" title="Vuelve a abrirlas empezando conversaciones nuevas">Abrir de nuevo</button>
    <button class="btn sm icon" id="pr-x" aria-label="Descartar" title="Descartar">${svg('x')}</button></div>`;
  const go = async (resume) => {
    try { const r = await api('/api/sessions/restore', { resume }); prevSessions = []; renderPrevious(); if (r.errors.length) toast(r.errors.join('\n'), true); else toast(`${r.restored.length} sesión(es) restaurada(s)`); show('terms'); }
    catch (e) { toast(e.message, true); }
  };
  $('#pr-all').onclick = () => go(true);
  $('#pr-new').onclick = () => go(false);
  $('#pr-x').onclick = async () => { await api('/api/sessions/previous/dismiss', {}); prevSessions = []; renderPrevious(); };
}
loadPrevious();
