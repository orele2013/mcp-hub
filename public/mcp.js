'use strict';
// Explorador MCP: herramientas, recursos y prompts de cada servidor, probador de herramientas con formularios
// generados desde el esquema, comprobaciones de compatibilidad, revisión de seguridad e historial de salud.
Object.assign(ICONS, {
  explore: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4M8 11h6M11 8v6',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
});

let HEALTH = {};
async function loadHealth() {
  try { HEALTH = (await api('/api/mcp/health')).health || {}; } catch {}
  $$('[data-hdot]').forEach((el) => { el.outerHTML = healthDot(el.dataset.hdot); });
}
const hAgo = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? 'hace un momento' : s < 3600 ? `hace ${Math.floor(s / 60)} min` : s < 86400 ? `hace ${Math.floor(s / 3600)} h` : new Date(t).toLocaleDateString('es-ES'); };
function healthDot(name) {
  const h = HEALTH[name] || [], last = h.at(-1);
  const title = last ? `${last.ok ? 'Funcionaba' : 'Falló'} ${hAgo(last.at)}${last.ms ? ` · ${last.ms} ms` : ''}${last.error ? ` · ${last.error}` : ''}` : 'Sin comprobar todavía';
  return `<span class="hdot ${!last ? '' : last.ok ? 'ok' : 'err'}" data-hdot="${esc(name)}" title="${esc(title)}"></span>`;
}

// ---------------- Revisión de seguridad (formularios de añadir/editar) ----------------
let reviewT;
function reviewInto(el, server) {
  clearTimeout(reviewT);
  reviewT = setTimeout(async () => {
    try { const r = await api('/api/mcp/review', { server }); el.innerHTML = findingsHtml(r.findings, 'Revisión de seguridad'); } catch { el.innerHTML = ''; }
  }, 350);
}
const LEVEL = { error: ['err', 'warn'], warn: ['warn', 'warn'], info: ['', 'info'], ok: ['ok', 'check'] };
function findingsHtml(list, title) {
  if (!list?.length) return '';
  return `<div class="findings">${title ? `<div class="flabel">${esc(title)}</div>` : ''}${list.map((f) => `<div class="finding ${LEVEL[f.level]?.[0] || ''}">${svg(LEVEL[f.level]?.[1] || 'info')}<span>${esc(f.text)}</span></div>`).join('')}</div>`;
}

// ---------------- Explorador ----------------
let EX = null;
async function exploreServer(name) {
  EX = { name, tab: 'tools', data: null };
  modal(`<div class="mhead">${logo(serverKey(name, S.servers[name]), 40)}<div><small>Explorador MCP</small><h2>${esc(name)}</h2></div><button class="btn icon sm" data-close aria-label="Cerrar">${svg('x')}</button></div>
    <div id="ex-body"><p class="hint"><span class="spin"></span> Conectando con el servidor…</p></div>`, { sheet: true });
  try { EX.data = await api('/api/mcp/explore', { name }); } catch (e) { EX.data = { ok: false, error: e.message }; }
  loadHealth();
  renderExplorer();
}

function renderExplorer() {
  const d = EX.data, box = $('#ex-body'); if (!box) return;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const tabs = [['tools', 'Herramientas', arr(d.tools).length], ['resources', 'Recursos', arr(d.resources).length + arr(d.templates).length], ['prompts', 'Prompts', arr(d.prompts).length],
    ['compat', 'Compatibilidad', (d.checks || []).filter((c) => c.level === 'error' || c.level === 'warn').length], ['security', 'Seguridad', (d.review || []).filter((c) => c.level === 'error' || c.level === 'warn').length], ['health', 'Salud', (d.health || []).length]];
  const head = d.ok
    ? `<div class="ex-info"><span><b>${esc(d.info.serverInfo?.name || '—')}</b> ${esc(d.info.serverInfo?.version || '')}</span><span>Protocolo ${esc(d.info.protocolVersion || '?')}</span><span>Conexión ${d.info.connectMs} ms</span>
        <span>${Object.keys(d.info.capabilities || {}).map(esc).join(', ') || 'sin capacidades'}</span></div>${d.info.instructions ? `<p class="hint">${esc(d.info.instructions.slice(0, 400))}</p>` : ''}`
    : `<pre class="err">${esc(d.error || 'No se pudo conectar')}${d.stderr ? '\n\n' + esc(d.stderr) : ''}</pre>`;
  box.innerHTML = `${head}
    <div class="seg ex-tabs">${tabs.map(([k, l, n]) => `<button data-ex="${k}" class="${EX.tab === k ? 'on' : ''}">${l}${n ? ` · ${n}` : ''}</button>`).join('')}</div>
    <div id="ex-pane"></div>`;
  $$('[data-ex]').forEach((b) => (b.onclick = () => { EX.tab = b.dataset.ex; renderExplorer(); }));
  const pane = $('#ex-pane');
  if (EX.tab === 'tools') {
    if (d.tools?.error) pane.innerHTML = `<pre class="err">${esc(d.tools.error)}</pre>`;
    else pane.innerHTML = arr(d.tools).length ? `<p class="hint">Probar una herramienta la ejecuta de verdad (puede crear, cambiar o borrar cosas).</p>${arr(d.tools).map((t, i) => `<details class="ex-item" data-i="${i}"><summary><code>${esc(t.name)}</code><span>${esc((t.description || '').split('\n')[0].slice(0, 140))}</span></summary>
        <div class="ex-detail">${t.description ? `<p class="ex-desc">${esc(t.description)}</p>` : ''}${t.annotations ? `<p class="hint">${Object.entries(t.annotations).filter(([, v]) => v === true).map(([k]) => esc({ readOnlyHint: 'solo lectura', destructiveHint: 'destructiva', idempotentHint: 'idempotente', openWorldHint: 'accede a internet' }[k] || k)).join(' · ')}</p>` : ''}
        <form class="form ex-form" data-tool="${esc(t.name)}">${schemaForm(t.inputSchema)}<div class="ex-run"><button class="btn primary sm">${svg('play')}Ejecutar</button><span class="hint"></span></div><div class="ex-out"></div></form></div></details>`).join('')}`
      : '<p class="sub">Este servidor no tiene herramientas.</p>';
    $$('.ex-form').forEach((f) => (f.onsubmit = (e) => { e.preventDefault(); runTool(f); }));
  } else if (EX.tab === 'resources') {
    pane.innerHTML = [
      ...arr(d.resources).map((r) => `<div class="ex-item flat"><div><code>${esc(r.uri)}</code> <span class="hint">${esc(r.name || '')}${r.mimeType ? ' · ' + esc(r.mimeType) : ''}</span>${r.description ? `<p class="hint">${esc(r.description)}</p>` : ''}</div><button class="btn sm" data-uri="${esc(r.uri)}">Leer</button><div class="ex-out"></div></div>`),
      ...arr(d.templates).map((r) => `<form class="ex-item flat ex-tpl" data-tpl="${esc(r.uriTemplate)}"><div><code>${esc(r.uriTemplate)}</code> <span class="hint">${esc(r.name || '')}</span>${r.description ? `<p class="hint">${esc(r.description)}</p>` : ''}
        <div class="row">${[...r.uriTemplate.matchAll(/\{([^}]+)\}/g)].map((m) => `<label>${esc(m[1])}<input class="field sm" name="${esc(m[1])}"></label>`).join('')}</div></div><button class="btn sm">Leer</button><div class="ex-out"></div></form>`),
    ].join('') || '<p class="sub">Este servidor no expone recursos.</p>';
    $$('[data-uri]').forEach((b) => (b.onclick = () => readRes(b.dataset.uri, b.parentElement.querySelector('.ex-out'))));
    $$('.ex-tpl').forEach((f) => (f.onsubmit = (e) => { e.preventDefault(); const uri = f.dataset.tpl.replace(/\{([^}]+)\}/g, (_, k) => encodeURIComponent(f.elements[k]?.value || '')); readRes(uri, f.querySelector('.ex-out')); }));
  } else if (EX.tab === 'prompts') {
    pane.innerHTML = arr(d.prompts).map((p) => `<form class="ex-item flat ex-prompt" data-prompt="${esc(p.name)}"><div><code>${esc(p.name)}</code>${p.description ? `<p class="hint">${esc(p.description)}</p>` : ''}
        <div class="row">${(p.arguments || []).map((a) => `<label>${esc(a.name)}${a.required ? ' *' : ''}<input class="field sm" name="${esc(a.name)}" placeholder="${esc(a.description || '')}" ${a.required ? 'required' : ''}></label>`).join('')}</div></div><button class="btn sm">Ver</button><div class="ex-out"></div></form>`).join('') || '<p class="sub">Este servidor no tiene prompts.</p>';
    $$('.ex-prompt').forEach((f) => (f.onsubmit = async (e) => {
      e.preventDefault();
      const args = Object.fromEntries([...f.querySelectorAll('input')].filter((i) => i.value).map((i) => [i.name, i.value]));
      const out = f.querySelector('.ex-out'); out.innerHTML = '<span class="spin"></span>';
      const r = await api('/api/mcp/prompt', { name: EX.name, prompt: f.dataset.prompt, args }).catch((er) => ({ ok: false, error: er.message }));
      out.innerHTML = r.ok ? `<p class="hint">${r.ms} ms</p>${(r.result.messages || []).map((m) => `<div class="flabel">${esc(m.role)}</div>${contentHtml([m.content].flat())}`).join('')}` : `<pre class="err">${esc(r.error)}</pre>`;
    }));
  } else if (EX.tab === 'compat') {
    pane.innerHTML = findingsHtml(d.checks || [{ level: 'error', text: d.error || 'No se pudo conectar' }]) + '<p class="hint">Son comprobaciones de problemas conocidos con los clientes; que no salgan avisos no garantiza que todo funcione.</p>';
  } else if (EX.tab === 'security') {
    pane.innerHTML = findingsHtml(d.review);
  } else if (EX.tab === 'health') {
    const h = (d.health || []).slice().reverse();
    const okN = h.filter((x) => x.ok).length;
    const lat = h.filter((x) => x.ok && x.ms).map((x) => x.ms);
    pane.innerHTML = h.length ? `<div class="stats ex-stats"><div class="stat"><span>Comprobaciones</span><b>${h.length}</b></div><div class="stat"><span>Correctas</span><b>${Math.round((okN / h.length) * 100)}%</b></div>
        <div class="stat"><span>Tiempo mediano</span><b>${lat.length ? lat.sort((a, b) => a - b)[Math.floor(lat.length / 2)] + ' ms' : '—'}</b></div></div>
      ${sparkline(h.slice().reverse())}
      <div class="log">${h.map((x) => `<div><span class="when">${new Date(x.at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span><span>${x.ok ? '✅ bien' : '❌ falló'}${x.ms ? ` · ${x.ms} ms` : ''}</span><span>${x.tools != null ? `${x.tools} herramientas` : ''}${x.error ? esc(x.error) : ''}</span></div>`).join('')}</div>
      <p class="hint">El tiempo incluye arrancar el servidor (en los locales, también descargarlo si hace falta). Solo se comprueba cuando pulsas Probar, Explorar o Comprobar todos.</p>`
      : '<p class="sub">Sin historial todavía.</p>';
  }
}

function sparkline(h) {
  const pts = h.filter((x) => x.ms != null);
  if (pts.length < 2) return '';
  const max = Math.max(...pts.map((x) => x.ms)), W = 600, H = 60;
  const xy = pts.map((x, i) => [(i / (pts.length - 1)) * W, H - 4 - (x.ms / max) * (H - 8)]);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Latencia de las últimas comprobaciones"><polyline points="${xy.map((p) => p.join(',')).join(' ')}"/>${pts.map((x, i) => (x.ok ? '' : `<circle cx="${xy[i][0]}" cy="${xy[i][1]}" r="3" class="bad"/>`)).join('')}</svg>`;
}

// Formulario a partir de un JSON Schema (lo más común; lo demás se edita como JSON)
function schemaForm(schema) {
  const props = schema?.properties || {};
  const req = new Set(schema?.required || []);
  const keys = Object.keys(props);
  if (!keys.length) return '<p class="hint">Sin argumentos.</p>';
  return keys.map((k) => {
    const p = props[k] || {}, type = Array.isArray(p.type) ? p.type.find((t) => t !== 'null') : p.type;
    const hint = [p.description, p.default !== undefined && `por defecto: ${JSON.stringify(p.default)}`, p.examples && `ej.: ${p.examples.map((x) => JSON.stringify(x)).join(', ')}`].filter(Boolean).join(' · ');
    const ph = esc(p.examples?.[0] !== undefined ? (typeof p.examples[0] === 'string' ? p.examples[0] : JSON.stringify(p.examples[0])) : p.default !== undefined ? (typeof p.default === 'string' ? p.default : JSON.stringify(p.default)) : '');
    const label = `<span>${esc(k)}${req.has(k) ? ' <b class="req">*</b>' : ''} <span class="hint">${esc(type || 'json')}</span></span>`;
    let input;
    if (p.enum) input = `<select class="field sm" name="${esc(k)}" data-type="enum">${req.has(k) ? '' : '<option value="">—</option>'}${p.enum.map((v) => `<option value='${esc(JSON.stringify(v))}'>${esc(String(v))}</option>`).join('')}</select>`;
    else if (type === 'boolean') input = `<select class="field sm" name="${esc(k)}" data-type="boolean">${req.has(k) ? '' : '<option value="">—</option>'}<option value="true">true</option><option value="false">false</option></select>`;
    else if (type === 'number' || type === 'integer') input = `<input class="field sm" type="number" step="${type === 'integer' ? 1 : 'any'}" name="${esc(k)}" data-type="number" placeholder="${ph}" ${req.has(k) ? 'required' : ''}>`;
    else if (type === 'string') input = (p.format === 'textarea' || (p.maxLength || 0) > 200 || /content|text|body|query|code|prompt/i.test(k))
      ? `<textarea class="field sm mono" name="${esc(k)}" data-type="string" rows="3" placeholder="${ph}" ${req.has(k) ? 'required' : ''}></textarea>`
      : `<input class="field sm" name="${esc(k)}" data-type="string" placeholder="${ph}" ${req.has(k) ? 'required' : ''}>`;
    else if (type === 'array' && ['string', 'number', 'integer'].includes(p.items?.type)) input = `<textarea class="field sm mono" name="${esc(k)}" data-type="lines-${p.items.type}" rows="2" placeholder="uno por línea"></textarea>`;
    else input = `<textarea class="field sm mono" name="${esc(k)}" data-type="json" rows="3" placeholder='${esc(JSON.stringify(p.default ?? (type === 'array' ? [] : {})))}'></textarea>`;
    return `<label class="ex-field">${label}${input}${hint ? `<span class="hint">${esc(hint.slice(0, 300))}</span>` : ''}</label>`;
  }).join('');
}
function readForm(f) {
  const args = {};
  for (const el of f.querySelectorAll('[name]')) {
    const v = el.value, t = el.dataset.type;
    if (v === '') continue;
    if (t === 'number') args[el.name] = Number(v);
    else if (t === 'boolean') args[el.name] = v === 'true';
    else if (t === 'enum') args[el.name] = JSON.parse(v);
    else if (t?.startsWith('lines-')) args[el.name] = v.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => (t === 'lines-string' ? x : Number(x)));
    else if (t === 'json') { try { args[el.name] = JSON.parse(v); } catch { throw new Error(`“${el.name}” no es JSON válido`); } }
    else args[el.name] = v;
  }
  return args;
}
async function runTool(f) {
  const out = f.querySelector('.ex-out'), st = f.querySelector('.ex-run .hint'), btn = f.querySelector('button');
  let args;
  try { args = readForm(f); } catch (e) { out.innerHTML = `<pre class="err">${esc(e.message)}</pre>`; return; }
  btn.disabled = true; st.innerHTML = '<span class="spin"></span> Ejecutando…'; out.innerHTML = '';
  const r = await api('/api/mcp/call', { name: EX.name, tool: f.dataset.tool, args }).catch((e) => ({ ok: false, error: e.message }));
  btn.disabled = false;
  st.textContent = r.ok ? `${r.ms} ms${r.result?.isError ? ' · la herramienta devolvió un error' : ''}` : '';
  out.innerHTML = r.ok ? `${contentHtml(r.result.content || [])}${r.result.structuredContent ? `<div class="flabel">Resultado estructurado</div><pre>${esc(JSON.stringify(r.result.structuredContent, null, 2))}</pre>` : ''}`
    : `<pre class="err">${esc(r.error)}${r.stderr ? '\n\n' + esc(r.stderr) : ''}</pre>`;
}
async function readRes(uri, out) {
  out.innerHTML = '<span class="spin"></span>';
  const r = await api('/api/mcp/resource', { name: EX.name, uri }).catch((e) => ({ ok: false, error: e.message }));
  out.innerHTML = r.ok ? `<p class="hint">${r.ms} ms</p>${(r.result.contents || []).map((c) => (c.text != null ? `<pre>${esc(c.text.slice(0, 50000))}</pre>` : c.blob && /^image\//.test(c.mimeType || '') ? `<img class="ex-img" src="data:${esc(c.mimeType)};base64,${c.blob}" alt="">` : `<p class="hint">Contenido binario (${esc(c.mimeType || '?')})</p>`)).join('')}` : `<pre class="err">${esc(r.error)}</pre>`;
}
function contentHtml(items) {
  return items.map((c) => {
    if (c.type === 'text') { let t = c.text; try { t = JSON.stringify(JSON.parse(t), null, 2); } catch {} return `<pre>${esc(t.slice(0, 100000))}</pre>`; }
    if (c.type === 'image') return `<img class="ex-img" src="data:${esc(c.mimeType)};base64,${c.data}" alt="">`;
    if (c.type === 'resource') return `<pre>${esc(c.resource?.text || JSON.stringify(c.resource, null, 2))}</pre>`;
    if (c.type === 'resource_link') return `<p><code>${esc(c.uri)}</code> ${esc(c.name || '')}</p>`;
    return `<pre>${esc(JSON.stringify(c, null, 2))}</pre>`;
  }).join('') || '<p class="hint">(sin contenido)</p>';
}

// Comprobar todos los servidores de golpe
document.getElementById('btn-health')?.addEventListener('click', async (e) => {
  const b = e.currentTarget; b.disabled = true; const label = b.innerHTML; b.innerHTML = '<span class="spin"></span> Comprobando…';
  try { HEALTH = (await api('/api/mcp/health/check', {})).health; const names = Object.keys(S.servers); const bad = names.filter((n) => HEALTH[n]?.at(-1) && !HEALTH[n].at(-1).ok); toast(bad.length ? `Fallan: ${bad.join(', ')}` : `Los ${names.length} servidores responden`, !!bad.length); renderServers(); }
  catch (err) { toast(err.message, true); }
  finally { b.disabled = false; b.innerHTML = label; }
});
loadHealth();
