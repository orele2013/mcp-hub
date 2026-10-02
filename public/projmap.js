'use strict';
// Mapa del proyecto: módulos (o archivos) y sus dependencias según los imports reales. Se actualiza solo mientras está abierto.
const PM = { dir: null, map: null, mode: 'modules', sel: null, view: { x: 0, y: 0, k: 1 }, timer: null, layoutKey: null, pos: null };

async function loadMap(force) {
  PM.dir ||= (() => { try { return localStorage.getItem('mcphub.map.dir'); } catch { return null; } })() || S.recentDirs?.[0] || S.home;
  if (!PM.map || force) $('#map-body').innerHTML = mapShell('<p class="hint" style="padding:20px"><span class="spin"></span> Analizando el código…</p>');
  bindMapShell();
  try {
    const m = await api(`/api/map?dir=${encodeURIComponent(PM.dir)}`);
    const changed = !PM.map || m.sig !== PM.map.sig || JSON.stringify(m.descriptions) !== JSON.stringify(PM.map.descriptions) || m.describeJob !== PM.map.describeJob;
    if (!PM.map || PM.map.root !== m.root) { PM.mode = m.modules.length < 6 && m.files.length <= 300 ? 'files' : 'modules'; PM.pos = null; }
    PM.map = m;
    if (changed || force) renderMap();
  } catch (e) { $('#pm-canvas').innerHTML = `<p class="errtxt" style="padding:20px">${esc(e.message)}</p>`; }
  clearInterval(PM.timer);
  PM.timer = setInterval(() => { if (currentView === 'map' && !document.hidden) loadMap(); else clearInterval(PM.timer); }, 15000);
}
VIEW_LOADERS.map = () => loadMap(true);
document.addEventListener('hub:map', () => { if (currentView === 'map') loadMap(); });

const mapShell = (canvas) => `<header class="page-head"><div><h1>Mapa del proyecto</h1><p class="sub">Módulos y dependencias calculados leyendo los imports del código (JS/TS, Python, CSS, HTML). Se actualiza solo cuando cambia el proyecto.</p></div>
    <div class="actions pm-dirbar"><input id="pm-dir" class="field mono" list="pm-dirs" value="${esc(tilde(PM.dir))}"><datalist id="pm-dirs">${(S.recentDirs || []).map((d) => `<option value="${esc(tilde(d))}">`).join('')}</datalist>
      <button class="btn" id="pm-go">Ver</button></div></header>
  <div class="pm-wrap"><div class="pm-canvas" id="pm-canvas">${canvas}</div><aside class="pm-side" id="pm-side"></aside></div>`;
function bindMapShell() {
  const go = () => { PM.dir = $('#pm-dir').value.trim().replace(/^~(?=$|\/)/, S.home); try { localStorage.setItem('mcphub.map.dir', PM.dir); } catch {} PM.map = null; PM.sel = null; PM.pos = null; loadMap(true); };
  $('#pm-go').onclick = go;
  $('#pm-dir').onkeydown = (e) => { if (e.key === 'Enter') go(); };
}

const hue = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
function graphData() {
  const m = PM.map;
  if (PM.mode === 'modules') {
    return { nodes: m.modules.map((x) => ({ id: x.id, label: x.id, size: x.lines, group: x.id.split('/')[0], files: x.files.length })), edges: m.edges };
  }
  // Archivos: los 300 más conectados (para que el dibujo siga siendo legible)
  const deg = {};
  for (const e of m.fileEdges) { deg[e.from] = (deg[e.from] || 0) + 1; deg[e.to] = (deg[e.to] || 0) + 1; }
  const keep = new Set(m.files.sort((a, b) => (deg[b.id] || 0) - (deg[a.id] || 0)).slice(0, 300).map((f) => f.id));
  return { nodes: m.files.filter((f) => keep.has(f.id)).map((f) => ({ id: f.id, label: f.id.split('/').pop(), size: f.lines || 1, group: f.module })), edges: m.fileEdges.filter((e) => keep.has(e.from) && keep.has(e.to)), cut: m.files.length > 300 };
}
// Disposición por fuerzas (repulsión entre nodos, muelles en las aristas, gravedad al centro)
function layout(nodes, edges) {
  const key = PM.mode + '|' + nodes.map((n) => n.id).join(',') + '|' + edges.length;
  if (PM.layoutKey === key && PM.pos) return PM.pos;
  const pos = {}, N = nodes.length;
  nodes.forEach((n, i) => { const a = (i / Math.max(N, 1)) * Math.PI * 2; const r = 200 + (hue(n.group) % 60); pos[n.id] = { x: Math.cos(a) * r + (hue(n.group) % 40), y: Math.sin(a) * r, vx: 0, vy: 0 }; });
  const iters = N > 200 ? 160 : 300;
  for (let it = 0; it < iters; it++) {
    const t = 1 - it / iters;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const a = pos[nodes[i].id], b = pos[nodes[j].id];
      let dx = a.x - b.x, dy = a.y - b.y; const d2 = dx * dx + dy * dy + 0.01; const f = 2200 / d2;
      const d = Math.sqrt(d2); dx /= d; dy /= d;
      a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    }
    for (const e of edges) {
      const a = pos[e.from], b = pos[e.to]; if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, f = (d - 110) * 0.02;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const n of nodes) { const p = pos[n.id]; p.vx -= p.x * 0.004; p.vy -= p.y * 0.004; p.x += Math.max(-30, Math.min(30, p.vx)) * t; p.y += Math.max(-30, Math.min(30, p.vy)) * t; p.vx *= 0.5; p.vy *= 0.5; }
  }
  PM.layoutKey = key; PM.pos = pos;
  return pos;
}
function renderMap() {
  const m = PM.map;
  if (!$('#pm-canvas')) { $('#map-body').innerHTML = mapShell(''); bindMapShell(); }
  if (!m.files.length) { $('#pm-canvas').innerHTML = '<p class="sub" style="padding:20px">No se encontró código (JS/TS, Python, CSS o HTML) en esta carpeta.</p>'; $('#pm-side').innerHTML = ''; return; }
  const { nodes, edges, cut } = graphData();
  const pos = layout(nodes, edges);
  const xs = nodes.map((n) => pos[n.id].x), ys = nodes.map((n) => pos[n.id].y);
  // Tamaño mínimo del lienzo para que un proyecto con pocos nodos no se vea gigante
  const pad = 80, cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const w = Math.max(Math.max(...xs) - Math.min(...xs) + pad * 2, 900), h = Math.max(Math.max(...ys) - Math.min(...ys) + pad * 2, 560);
  const minX = cx - w / 2, minY = cy - h / 2;
  const maxSize = Math.max(...nodes.map((n) => n.size || 1));
  const r = (n) => 6 + Math.sqrt((n.size || 1) / maxSize) * (PM.mode === 'modules' ? 26 : 14);
  const maxW = Math.max(...edges.map((e) => e.w), 1);
  const sel = PM.sel;
  const linked = new Set(sel ? edges.filter((e) => e.from === sel || e.to === sel).flatMap((e) => [e.from, e.to]) : []);
  const svgEl = `<svg id="pm-svg" viewBox="${minX} ${minY} ${w} ${h}" preserveAspectRatio="xMidYMid meet">
    <defs><marker id="pm-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>
    <g id="pm-g" transform="translate(${PM.view.x} ${PM.view.y}) scale(${PM.view.k})">
    ${edges.map((e) => { const a = pos[e.from], b = pos[e.to]; if (!a || !b) return ''; const nb = nodes.find((n) => n.id === e.to); const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, rr = r(nb) + 3;
      return `<line class="pm-e ${sel && (e.from === sel || e.to === sel) ? 'hl' : sel ? 'dim' : ''}" x1="${a.x}" y1="${a.y}" x2="${b.x - (dx / d) * rr}" y2="${b.y - (dy / d) * rr}" stroke-width="${1 + (e.w / maxW) * 3}" marker-end="url(#pm-arr)"/>`; }).join('')}
    ${nodes.map((n) => { const p = pos[n.id]; return `<g class="pm-n ${n.id === sel ? 'sel' : sel && !linked.has(n.id) ? 'dim' : ''}" data-node="${esc(n.id)}" transform="translate(${p.x} ${p.y})">
      <circle r="${r(n)}" fill="hsl(${hue(n.group)} 55% 45%)"/><text y="${r(n) + 13}" text-anchor="middle">${esc(n.label)}</text></g>`; }).join('')}
    </g></svg>`;
  $('#pm-canvas').innerHTML = `<div class="pm-tools"><div class="seg"><button class="${PM.mode === 'modules' ? 'on' : ''}" data-pmm="modules">Módulos</button><button class="${PM.mode === 'files' ? 'on' : ''}" data-pmm="files">Archivos</button></div>
      <span class="hint">${m.files.length} archivos · ${m.modules.length} módulos${cut && PM.mode === 'files' ? ' · se muestran los 300 más conectados' : ''}${m.truncated ? ' · proyecto recortado a 4000 archivos' : ''} · actualizado ${new Date(m.at).toLocaleTimeString('es-ES')}</span>
      <button class="btn sm" id="pm-fit">Encajar</button></div>${svgEl}`;
  $$('#pm-canvas [data-pmm]').forEach((b) => (b.onclick = () => { PM.mode = b.dataset.pmm; PM.sel = null; PM.view = { x: 0, y: 0, k: 1 }; renderMap(); }));
  $('#pm-fit').onclick = () => { PM.view = { x: 0, y: 0, k: 1 }; renderMap(); };
  $$('#pm-svg [data-node]').forEach((g) => (g.onclick = (e) => { e.stopPropagation(); PM.sel = PM.sel === g.dataset.node ? null : g.dataset.node; renderMap(); }));
  // Zoom con la rueda y desplazamiento arrastrando
  const svgN = $('#pm-svg'), g = $('#pm-g');
  const apply = () => g.setAttribute('transform', `translate(${PM.view.x} ${PM.view.y}) scale(${PM.view.k})`);
  svgN.addEventListener('wheel', (e) => { e.preventDefault(); const k = Math.max(0.3, Math.min(4, PM.view.k * (e.deltaY < 0 ? 1.12 : 0.89))); PM.view.k = k; apply(); }, { passive: false });
  let drag = null;
  svgN.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-node]')) return; drag = { x: e.clientX, y: e.clientY, vx: PM.view.x, vy: PM.view.y }; svgN.setPointerCapture(e.pointerId); });
  svgN.addEventListener('pointermove', (e) => { if (!drag) return; const s = w / svgN.clientWidth; PM.view.x = drag.vx + (e.clientX - drag.x) * s; PM.view.y = drag.vy + (e.clientY - drag.y) * s; apply(); });
  svgN.addEventListener('pointerup', () => { drag = null; });
  svgN.addEventListener('click', () => { if (PM.sel) { PM.sel = null; renderMap(); } });
  renderMapSide();
}
function renderMapSide() {
  const m = PM.map, sel = PM.sel;
  const desc = (id) => m.descriptions?.[id];
  let html;
  if (!sel) {
    html = `<div class="side-title" style="padding-left:0">Proyecto</div><p class="mono hint">${esc(tilde(m.root))}</p>
      <div class="kv"><span>Archivos</span><span>${m.files.length}</span><span>Líneas</span><span>${m.files.reduce((s, f) => s + (f.lines || 0), 0).toLocaleString('es-ES')}</span><span>Módulos</span><span>${m.modules.length}</span></div>
      <button class="btn block" id="pm-describe" ${m.describeJob ? 'disabled' : ''}>${m.describeJob ? '<span class="spin"></span> Describiendo…' : `${svg('bolt')}${m.describedAt ? 'Volver a describir con IA' : 'Describir módulos con IA'}`}</button>
      <span class="hint">Un agente (solo lectura) escribe una frase sobre cada módulo. Las dependencias del mapa no usan IA.</span>
      ${m.external.length ? `<div class="side-title" style="padding-left:0">Paquetes externos</div><p class="pm-ext">${m.external.slice(0, 30).map((e) => `<span class="tag">${esc(e.name)} · ${e.uses}</span>`).join(' ')}</p>` : ''}
      <p class="hint">Pulsa un nodo para ver sus dependencias.</p>`;
  } else if (PM.mode === 'modules') {
    const mod = m.modules.find((x) => x.id === sel);
    const out = m.edges.filter((e) => e.from === sel), inc = m.edges.filter((e) => e.to === sel);
    html = `<div class="side-title" style="padding-left:0">Módulo</div><b>${esc(sel)}</b>${desc(sel) ? `<p>${esc(desc(sel))}</p>` : ''}
      <div class="kv"><span>Archivos</span><span>${mod.files.length}</span><span>Líneas</span><span>${mod.lines.toLocaleString('es-ES')}</span></div>
      ${out.length ? `<div class="flabel">Usa</div>${out.map((e) => `<a href="#" class="pm-link" data-go="${esc(e.to)}">${esc(e.to)}</a> <span class="hint">${e.w} import(s)</span>`).join('<br>')}` : ''}
      ${inc.length ? `<div class="flabel">Lo usan</div>${inc.map((e) => `<a href="#" class="pm-link" data-go="${esc(e.from)}">${esc(e.from)}</a> <span class="hint">${e.w}</span>`).join('<br>')}` : ''}
      <div class="flabel">Archivos</div><div class="pm-files mono">${mod.files.map((f) => `<div>${esc(f)} <span class="hint">${m.files.find((x) => x.id === f)?.lines ?? ''}</span></div>`).join('')}</div>`;
  } else {
    const f = m.files.find((x) => x.id === sel);
    const out = m.fileEdges.filter((e) => e.from === sel), inc = m.fileEdges.filter((e) => e.to === sel);
    html = `<div class="side-title" style="padding-left:0">Archivo</div><b class="mono">${esc(sel)}</b>
      <div class="kv"><span>Módulo</span><span>${esc(f?.module || '')}</span><span>Líneas</span><span>${f?.lines ?? '—'}</span></div>${desc(f?.module) ? `<p class="hint">${esc(desc(f.module))}</p>` : ''}
      ${out.length ? `<div class="flabel">Importa</div>${out.map((e) => `<a href="#" class="pm-link mono" data-go="${esc(e.to)}">${esc(e.to)}</a>`).join('<br>')}` : ''}
      ${inc.length ? `<div class="flabel">Lo importan</div>${inc.map((e) => `<a href="#" class="pm-link mono" data-go="${esc(e.from)}">${esc(e.from)}</a>`).join('<br>')}` : ''}`;
  }
  $('#pm-side').innerHTML = html;
  $$('#pm-side [data-go]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); PM.sel = a.dataset.go; renderMap(); }));
  $('#pm-describe')?.addEventListener('click', () => {
    const ag = (S.clients || []).filter((c) => c.installed);
    modal(`<div class="mhead"><div><small>Mapa del proyecto</small><h2>Describir módulos con IA</h2></div></div>
      <div class="form"><div class="row"><label>Agente<select id="pd-agent" class="field">${ag.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label>Modelo<input id="pd-model" class="field mono" value="haiku" placeholder="por defecto"></label></div>
      <span class="hint">Se lanza como encargo de solo lectura. Con Claude, "haiku" es lo más barato.</span></div>
      <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="pd-ok">Describir</button></div>`);
    $('#pd-agent').onchange = () => { $('#pd-model').value = $('#pd-agent').value === 'claude' ? 'haiku' : ''; };
    $('#pd-ok').onclick = async () => { try { await api('/api/map/describe', { dir: m.root, agent: $('#pd-agent').value, model: $('#pd-model').value.trim() || null }); closeModal(); toast('Describiendo módulos…'); loadMap(); } catch (e) { toast(e.message, true); } };
  });
}
