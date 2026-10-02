'use strict';
// Skills desde skills.sh: buscar, revisar el SKILL.md, instalar en los agentes y quitar.
Object.assign(ICONS, {
  star: 'M12 3l2.2 5.3L20 9l-4.4 3.8L17 18.5 12 15.5l-5 3 1.4-5.7L4 9l5.8-.7L12 3Z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
});
const SKILL_CLIENTS = ['claude', 'codex', 'opencode', 'gemini', 'cursor'];

let SK = { tab: 'popular', items: [], installed: null, loading: false, q: '' };
let skTimer = null;

const fmtN = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n));
const avatar = (source, size = 40) => {
  const owner = String(source || '').split('/')[0];
  return `<span class="avatar" style="width:${size}px;height:${size}px">${svg('star')}${owner ? `<img src="https://github.com/${encodeURIComponent(owner)}.png?size=${size * 2}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
};
const starTile = (size = 44) => `<span class="avatar" style="width:${size}px;height:${size}px">${svg('star')}</span>`;

async function loadSkills(force) {
  if (!SK.installed || force) loadInstalled();
  if (SK.tab === 'installed') return renderSkills();
  if (SK.items.length && !force) return renderSkills();
  await fetchSkills();
}
async function fetchSkills() {
  SK.loading = true; renderSkills();
  try { SK.items = (await api('/api/skills/search?q=' + encodeURIComponent(SK.q))).items; }
  catch (e) { SK.items = []; SK.error = e.message; }
  SK.loading = false; renderSkills();
}
async function loadInstalled() {
  try { SK.installed = (await api('/api/skills/installed')).items; }
  catch (e) { SK.installed = []; SK.installedError = e.message; }
  $('#count-skills').textContent = SK.installed.length || '';
  renderSkills();
}

$('#skills-search').addEventListener('input', (e) => {
  clearTimeout(skTimer);
  skTimer = setTimeout(() => { SK.q = e.target.value.trim(); if (SK.tab === 'installed') SK.tab = 'popular'; fetchSkills(); }, 350);
});

function renderSkills() {
  const inst = SK.installed || [];
  const instNames = new Set(inst.map((s) => s.name));
  $('#skills-tabs').innerHTML = [['popular', SK.q.length >= 2 ? `Resultados para “${esc(SK.q)}”` : 'Populares'], ['installed', `Instaladas${SK.installed ? ` · ${inst.length}` : ''}`]]
    .map(([k, l]) => `<button class="chip ${SK.tab === k ? 'on' : ''}" data-sk="${k}">${l}</button>`).join('')
    + '<a class="chip" href="https://skills.sh" target="_blank" style="display:inline-flex;align-items:center;text-decoration:none">skills.sh ↗</a>';
  $$('#skills-tabs [data-sk]').forEach((b) => (b.onclick = () => { SK.tab = b.dataset.sk; renderSkills(); }));

  const body = $('#skills-body');
  if (SK.tab === 'installed') {
    if (!SK.installed) { body.innerHTML = '<p class="sub"><span class="spin"></span> Leyendo las skills instaladas…</p>'; return; }
    if (!inst.length) { body.innerHTML = `<div class="empty-state">${starTile(44)}<p><b>No tienes skills instaladas</b></p><p>Busca una arriba o mira las populares.</p></div>`; return; }
    body.innerHTML = `<div class="grid skills">${inst.map((s) => `<article class="card"><div class="head">${avatar(s.source)}<div><b>${esc(s.name)}</b><span class="src">${esc(s.source || tilde(s.path))}</span></div></div>
        <div class="foot"><span class="agents-mini">${s.agents.map((a) => logo(a, 18, { plain: true, alt: clientName(a) })).join('')}${s.otherAgents.length ? `<span class="hint" title="${esc(s.otherAgents.join(', '))}">+${s.otherAgents.length}</span>` : ''}</span>
        <span style="display:flex;gap:6px">${s.source ? `<button class="btn sm" data-sview="${esc(s.source)}|${esc(s.name)}">Ver</button>` : ''}<button class="btn sm icon" data-srm="${esc(s.name)}" aria-label="Quitar ${esc(s.name)}" title="Quitar">${svg('trash')}</button></span></div></article>`).join('')}</div>`;
  } else if (SK.loading) {
    body.innerHTML = '<p class="sub"><span class="spin"></span> Buscando en skills.sh…</p>';
  } else if (!SK.items.length) {
    body.innerHTML = `<div class="empty-state"><p><b>${SK.error ? 'No se pudo contactar con skills.sh' : 'Sin resultados'}</b></p><p>${esc(SK.error || 'Prueba con otra búsqueda.')}</p></div>`;
  } else {
    body.innerHTML = `<div class="grid skills">${SK.items.map((s) => `<article class="card ${instNames.has(s.slug) ? 'installed' : ''}">
        <div class="head">${avatar(s.source)}<div><b>${esc(s.name)}</b><span class="src">${esc(s.source)}</span></div></div>
        <div class="foot"><span class="installs">${svg('download')}${fmtN(s.installs)} instalaciones</span>
        <span style="display:flex;gap:6px"><button class="btn sm" data-sview="${esc(s.source)}|${esc(s.slug)}">Ver</button>
        ${instNames.has(s.slug) ? `<span class="done">${svg('check')}Instalada</span>` : `<button class="btn sm soft" data-sview="${esc(s.source)}|${esc(s.slug)}" data-install="1">Instalar</button>`}</span></div></article>`).join('')}</div>`;
  }
  $$('#skills-body [data-sview]').forEach((b) => (b.onclick = () => { const [src, slug] = b.dataset.sview.split('|'); skillSheet(src, slug); }));
  $$('#skills-body [data-srm]').forEach((b) => (b.onclick = () => removeSkillDialog(b.dataset.srm)));
}

// Markdown mínimo y seguro (se escapa todo primero)
function miniMd(src) {
  const text = src.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const blocks = text.split(/```[^\n]*\n([\s\S]*?)```/g);
  return blocks.map((b, i) => {
    if (i % 2) return `<pre>${esc(b)}</pre>`;
    return esc(b).split(/\n{2,}/).map((p) => {
      const t = p.trim(); if (!t) return '';
      const h = /^(#{1,3})\s+(.*)$/.exec(t);
      if (h && !t.includes('\n')) return `<h${h[1].length}>${h[2]}</h${h[1].length}>`;
      const inline = (x) => x.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
      if (/^[-*] /m.test(t) && t.split('\n').every((l) => /^\s*[-*] /.test(l) || /^\s{2,}/.test(l))) return `<ul>${t.split('\n').map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`).join('')}</ul>`;
      return t.split('\n').map((l) => { const hh = /^(#{1,3})\s+(.*)$/.exec(l); return hh ? `<h${hh[1].length}>${inline(hh[2])}</h${hh[1].length}>` : `<p>${inline(l)}</p>`; }).join('');
    }).join('');
  }).join('');
}

async function skillSheet(source, slug) {
  const known = SK.items.find((s) => s.source === source && s.slug === slug);
  const installed = (SK.installed || []).find((s) => s.name === slug);
  modal(`<div class="mhead">${avatar(source, 40)}<div><small>${esc(source)}</small><h2>${esc(known?.name || slug)}</h2></div><button class="btn icon sm" data-close aria-label="Cerrar">${svg('x')}</button></div>
    <div id="sk-detail"><p class="sub"><span class="spin"></span> Descargando SKILL.md para revisarlo…</p></div>`, { sheet: true });
  let d;
  try { d = await api(`/api/skills/detail?source=${encodeURIComponent(source)}&slug=${encodeURIComponent(slug)}`); }
  catch (e) { $('#sk-detail').innerHTML = `<pre class="err">${esc(e.message)}</pre>`; return; }
  const def = installed ? installed.agents : SKILL_CLIENTS.filter((c) => client(c)?.installed);
  $('#sk-detail').outerHTML = `<div class="form">
      ${d.description ? `<p class="sub" style="margin:0">${esc(d.description)}</p>` : ''}
      <div style="display:flex;gap:12px;flex-wrap:wrap" class="hint">${known ? `<span class="installs">${svg('download')}${fmtN(known.installs)} instalaciones</span>` : ''}<span>${d.files.length} archivos</span>
        <a href="https://skills.sh/${esc(source)}/${esc(slug)}" target="_blank">Ver en skills.sh ↗</a><a href="https://github.com/${esc(source)}" target="_blank">GitHub ↗</a></div>
      ${d.scripts.length ? `<div class="banner" style="margin:0">${svg('warn')}<span>Incluye ${d.scripts.length} script(s) que el agente podría ejecutar con tus permisos. Revísalos en GitHub si no conoces al autor.</span></div>` : ''}
      <div class="flabel">SKILL.md<div class="md">${miniMd(d.skillMd) || '<p>(vacío)</p>'}</div></div>
      <div class="flabel">Archivos<div class="filelist">${d.files.slice(0, 120).map((f) => `<span class="${d.scripts.includes(f.path) ? 'script' : ''}">${esc(f.path)}</span>`).join('')}</div></div>
      <div class="flabel">Instalar en<div class="checks">${SKILL_CLIENTS.map((c) => `<label class="check"><input type="checkbox" name="skagent" value="${c}" ${def.includes(c) ? 'checked' : ''}>${logo(c, 16, { plain: true })}${esc(clientName(c))}${tick}</label>`).join('')}</div>
        <span class="hint">Se instala para tu usuario (global): <code>npx skills add ${esc(source)} --skill ${esc(slug)} -g</code></span></div>
    </div>
    <div class="mfoot"><button class="btn primary go" id="sk-go">${svg('download')}${installed ? 'Reinstalar / actualizar agentes' : 'Instalar skill'}</button></div>`;
  $('#sk-go').onclick = async () => {
    const clients = $$('input[name=skagent]:checked').map((i) => i.value);
    if (!clients.length) return toast('Elige al menos un agente', true);
    const b = $('#sk-go'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Instalando…';
    try {
      await api('/api/skills/install', { source, slug, clients });
      toast(`${slug} instalada en ${clients.map(clientName).join(', ')}`);
      closeModal(); await loadInstalled();
    } catch (e) { toast(e.message, true); b.disabled = false; b.innerHTML = svg('download') + 'Instalar skill'; }
  };
}

function removeSkillDialog(name) {
  modal(`<div class="mhead">${starTile(40)}<div><small>Quitar skill</small><h2>${esc(name)}</h2></div></div>
    <p class="sub" style="margin-top:14px">Se quitará de todos los agentes donde esté instalada.</p>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn danger" id="skr-ok">${svg('trash')}Quitar</button></div>`);
  $('#skr-ok').onclick = async () => {
    const b = $('#skr-ok'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Quitando…';
    try { await api('/api/skills/remove', { name }); toast(`${name} quitada`); closeModal(); loadInstalled(); }
    catch (e) { toast(e.message, true); b.disabled = false; }
  };
}
if (currentView === 'skills') loadSkills();
