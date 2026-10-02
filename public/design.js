'use strict';
// Diseño: prototipos, presentaciones y diseños con cualquier agente. Lienzo en vivo, comentarios sobre elementos,
// edición de textos, ajustes, dibujo, versiones, sistemas de diseño, exportación y paso a código.
Object.assign(ICONS, {
  design: 'M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.6-9-7.6ZM7.5 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM10.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM15 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  cursor: 'M5 3l6 16 2.5-6.5L20 10 5 3Z',
  comment: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8 9.5h8M8 12.5h5',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  pen: 'M4 20l4-1L19 8l-3-3L5 16l-1 4ZM14 7l3 3',
  back: 'M15 6l-6 6 6 6',
  reload: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4',
  stop: 'M7 7h10v10H7z',
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4',
  present: 'M3 4h18v12H3zM8 20h8M12 16v4',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  dup: 'M8 8h11v11H8zM5 16V5h11',
  chev: 'M6 9l6 6 6-6',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
});
Object.assign(LOGOS, { design: { icon: 'design' } });

const DZ_TYPES = { blank: 'En blanco', prototype: 'Prototipo', mobile: 'App móvil', slides: 'Presentación', doc: 'Documento', wireframe: 'Wireframe', animation: 'Animación',
  mockups: 'Mockups de UI', resume: 'Currículum', model3d: 'Objeto 3D', research: 'Investigación', email: 'Email HTML', palette: 'Color + tipografía', system: 'Sistema de diseño' };
const FRAMES = { desktop: [1440, 900, 'Escritorio'], laptop: [1280, 800, 'Portátil'], tablet: [834, 1112, 'Tablet'], mobile: [390, 844, 'Móvil'], fit: [0, 0, 'Ajustar'] };
const TEMPLATES = [
  { id: 'landing', name: 'Landing page', type: 'prototype', desc: 'Página de producto con hero, ventajas, precios y CTA',
    prompt: 'Una landing page para un producto SaaS: hero con propuesta de valor y captura del producto, logos de clientes, 3–6 ventajas, cómo funciona, testimonios, tabla de precios con 3 planes, FAQ y CTA final. Navegación fija y versión móvil.' },
  { id: 'dashboard', name: 'Dashboard', type: 'prototype', desc: 'Panel de analítica con gráficos y tablas',
    prompt: 'Un dashboard de analítica: barra lateral de navegación, KPIs con tendencia, gráfico principal de líneas, gráfico de barras, tabla de datos con filtros y paginación, y panel de actividad. Datos de ejemplo realistas; pestañas y filtros que funcionen.' },
  { id: 'mobile', name: 'App móvil', type: 'prototype', frame: 'mobile', desc: 'Pantallas de una app con navegación',
    prompt: 'Prototipo de app móvil (390×844): onboarding de 3 pasos, inicio con contenido personalizado, detalle, perfil y ajustes, con barra de pestañas inferior y transiciones entre pantallas.' },
  { id: 'shop', name: 'Tienda online', type: 'prototype', desc: 'Catálogo, ficha de producto y carrito',
    prompt: 'Una tienda online: home con categorías y destacados, listado con filtros, ficha de producto con galería y variantes, carrito lateral y checkout de un paso. Todo navegable.' },
  { id: 'pitch', name: 'Pitch deck', type: 'slides', desc: 'Presentación para inversores, 10–12 diapositivas',
    prompt: 'Un pitch deck para inversores de 10–12 diapositivas: portada, problema, solución, producto, mercado (TAM/SAM/SOM), modelo de negocio, tracción con gráfico, competencia, equipo, financiación y cierre.' },
  { id: 'product-deck', name: 'Presentación de producto', type: 'slides', desc: 'Lanzamiento o demo interna',
    prompt: 'Una presentación de lanzamiento de producto de 8–10 diapositivas con portada, contexto, novedades destacadas con capturas, métricas, hoja de ruta y siguientes pasos.' },
  { id: 'onepager', name: 'One-pager', type: 'doc', desc: 'Resumen de una página, listo para PDF',
    prompt: 'Un one-pager (A4) que resuma un proyecto: título, resumen, problema/solución, métricas clave, hitos y contacto. Maquetación editorial e imprimible.' },
  { id: 'portfolio', name: 'Portfolio', type: 'prototype', desc: 'Web personal con proyectos',
    prompt: 'Un portfolio personal: presentación, proyectos destacados con página de detalle, sobre mí, experiencia y contacto. Estética cuidada y animaciones sutiles.' },
  { id: 'email', name: 'Email / newsletter', type: 'blank', desc: 'Email HTML compatible con clientes de correo',
    prompt: 'Una newsletter en HTML para email (600 px, tablas, estilos en línea, compatible con Gmail/Outlook) con cabecera, artículo destacado, 3 noticias, CTA y pie.' },
];

let DZ = { projects: [], agents: [], tab: 'projects', slug: null, p: null, panel: 'chat', mode: 'view', frame: 'desktop', zoom: 'fit',
  tweakDefs: [], tweakDefaults: {}, slides: { count: 0, current: 1 }, scroll: 0, version: null, versions: [], pendingImages: [], pendingComments: [], edits: [], live: [] };
try { Object.assign(DZ, JSON.parse(localStorage.getItem('mcphub.design') || '{}'), { slug: null, p: null }); } catch {}
const dzSave = () => { try { localStorage.setItem('mcphub.design', JSON.stringify({ tab: DZ.tab, frame: DZ.frame, zoom: DZ.zoom, list: { ...DZ.list, q: '' } })); } catch {} };
const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? 'ahora' : s < 3600 ? `hace ${Math.floor(s / 60)} min` : s < 86400 ? `hace ${Math.floor(s / 3600)} h` : new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }); };
const thumbUrl = (p) => `/api/design/thumb?slug=${p.slug}&token=${TOKEN}&t=${p.updated}`;
const agentName = (id) => DZ.agents.find((a) => a.id === id)?.name || id;

async function loadDesign() {
  try { Object.assign(DZ, await api('/api/design')); } catch (e) { return toast(e.message, true); }
  $('#count-design').textContent = DZ.projects.filter((p) => p.type !== 'system').length || '';
  if (currentView === 'design' && !DZ.slug) { if ($('.dz-home')) renderDesignList(); else renderDesignHome(); }
}

// ---------------- Inicio ----------------
// Tipos de proyecto (como las plantillas de Claude Design), con su ilustración
const KINDS = [
  { id: 'blank', name: 'En blanco', ph: 'Describe lo que quieres crear…',
    art: '<path d="M18 8h18l10 10v34H18z"/><path d="M36 8v10h10"/>' },
  { id: 'mobile', name: 'App móvil', frame: 'mobile', ph: 'Describe la app: para quién es, qué pantallas y qué debe transmitir…',
    art: '<rect x="20" y="6" width="24" height="48" rx="5"/><rect x="24" y="12" width="16" height="9" rx="2" class="f"/><path d="M24 26h16M24 30h12M24 34h16M24 38h10"/><path d="M29 48h6"/>' },
  { id: 'slides', name: 'Presentación', ph: 'Tema de la presentación, público, número de diapositivas, tono…',
    art: '<rect x="8" y="14" width="40" height="28" rx="2"/><rect x="16" y="20" width="40" height="28" rx="2" class="b"/><path d="M21 27h14M21 31h10"/><rect x="40" y="26" width="11" height="10" rx="1" class="f"/>' },
  { id: 'doc', name: 'Documento', ph: 'Qué documento es y qué contenido lleva…',
    art: '<path d="M18 8h18l10 10v34H18z"/><path d="M36 8v10h10M23 22h10M23 28h18M23 33h18M23 38h18M23 43h12"/>' },
  { id: 'wireframe', name: 'Wireframe', ph: 'Qué pantallas y qué flujo quieres estructurar…',
    art: '<rect x="8" y="12" width="48" height="36" rx="2"/><path d="M8 20h48"/><rect x="13" y="25" width="38" height="12" class="d"/><path d="M13 25l38 12M51 25 13 37"/><rect x="36" y="41" width="15" height="4" rx="2"/>' },
  { id: 'animation', name: 'Animación', frame: 'fit', ph: 'Qué debe contar la animación, duración, estilo…',
    art: '<rect x="12" y="10" width="40" height="28" rx="3"/><circle cx="32" cy="24" r="7" class="f"/><path d="m30 21 5 3-5 3z"/><path d="M12 46h40" /><circle cx="28" cy="46" r="2.5" class="f"/>' },
  { id: 'mockups', name: 'Mockups de UI', ph: 'Qué interfaz quieres explorar y cuántas variantes…',
    art: '<rect x="8" y="14" width="34" height="30" rx="2" class="b"/><rect x="20" y="20" width="36" height="30" rx="2"/><path d="M25 26h12M25 30h20M25 34h16"/><rect x="25" y="40" width="10" height="4" rx="2" class="f"/>' },
  { id: 'resume', name: 'Currículum', ph: 'Tu perfil, experiencia y el puesto al que apuntas (o adjunta tu CV)…',
    art: '<path d="M18 8h18l10 10v34H18z"/><circle cx="25" cy="18" r="3" class="f"/><path d="M31 17h8M23 26h18M23 31h14M23 37h18M23 42h12"/><path d="M23 47h10" class="r"/>' },
  { id: 'model3d', name: 'Objeto 3D', frame: 'fit', ph: 'Qué objeto, materiales, estilo e interacción…',
    art: '<path d="M32 10 50 19v20L32 50 14 39V19z"/><path d="M14 19l18 9 18-9M32 28v22"/><path d="M32 10 50 19 32 28 14 19z" class="f"/>' },
  { id: 'research', name: 'Investigación', ph: 'Qué quieres investigar y para qué lo necesitas…',
    art: '<path d="M16 8h18l10 10v34H16z"/><path d="M21 22h10M21 28h16M21 33h10"/><circle cx="38" cy="38" r="7"/><path d="m43 43 6 6"/>' },
  { id: 'email', name: 'Email HTML', ph: 'Tipo de email (bienvenida, newsletter, promo…), marca y contenido…',
    art: '<rect x="12" y="10" width="40" height="40" rx="3"/><circle cx="18" cy="16" r="2" class="f"/><path d="M17 24h30M17 29h22M17 34h26"/><rect x="22" y="40" width="20" height="5" rx="2.5" class="r"/>' },
  { id: 'clone', type: 'prototype', name: 'Desde captura', needs: 'image', ph: 'Adjunta (o pega) una captura de una web o app. Opcional: qué cambiar o qué debe hacer…',
    auto: 'Reproduce fielmente la captura adjunta como un prototipo HTML editable: misma estructura, jerarquía, espaciado, colores, tipografía (la más parecida en Google Fonts), iconos e imágenes (equivalentes reales o SVG). Textos tal cual. Haz interactivos los elementos que lo serían (menús, pestañas, botones, formularios). Expón los colores y la tipografía como Ajustes.',
    art: '<rect x="8" y="12" width="30" height="24" rx="2"/><path d="M12 32l7-8 5 5 4-4 6 7" class="r"/><path d="M40 24h6M43 21l3 3-3 3"/><rect x="48" y="16" width="10" height="16" rx="1.5" class="f"/>' },
  { id: 'repo-slides', type: 'slides', name: 'Presentación de un proyecto', needs: 'codebase', ph: 'Enlaza el código con </> y di para quién es la presentación (equipo, inversores, clientes…)',
    auto: 'Crea una presentación que explique el proyecto de código enlazado, con información REAL sacada del código (léelo: README, estructura, dependencias, rutas, modelos de datos): qué es y qué problema resuelve, para quién, cómo se usa, arquitectura (con un diagrama de módulos), tecnologías, funcionalidades clave con ejemplos, estado actual y próximos pasos. 8–12 diapositivas, una idea por diapositiva.',
    art: '<rect x="8" y="14" width="40" height="28" rx="2"/><path d="m16 24-4 4 4 4M24 24l4 4-4 4" class="r"/><rect x="32" y="22" width="11" height="12" rx="1" class="f"/><path d="M28 46h8"/>' },
  { id: 'palette', name: 'Color + tipografía', ph: 'Marca, sensaciones y público para explorar paletas y tipografías…',
    art: '<rect x="12" y="10" width="40" height="40" rx="3"/><text x="18" y="30" class="t">Aa</text><path d="M37 22h10"/><rect x="17" y="38" width="7" height="6" rx="1" class="r"/><rect x="27" y="38" width="7" height="6" rx="1" class="f"/><rect x="37" y="38" width="7" height="6" rx="1" class="b"/>' },
];
const kindArt = (k, size = 64) => `<svg class="dz-art" viewBox="0 0 64 60" width="${size}" height="${Math.round(size * 0.94)}" aria-hidden="true">${k.art}</svg>`;
const MODEL_HINTS = { claude: ['opus', 'sonnet', 'haiku'] };

DZ.compose ||= { text: '', kind: 'blank', system: '', codebase: '', agent: '', model: '', files: [], tplOpen: true };
DZ.list ||= { view: 'list', starred: false, q: '', sort: 'viewed' };

function renderDesignHome() {
  $('#view-design').classList.remove('dz-open');
  const C = DZ.compose;
  C.agent ||= defaultAgent();
  const systems = DZ.projects.filter((p) => p.type === 'system' && !p.template);
  const sys = systems.find((s) => s.slug === C.system);
  const kind = KINDS.find((k) => k.id === C.kind) || KINDS[0];
  $('#design-body').innerHTML = `
    <div class="dz-home">
      <h1 class="dz-hero">¿Qué creamos?</h1>
      <div class="dz-composer ${C.tplOpen ? 'open' : ''}">
        <div class="dz-cbox">
          ${C.files.length ? `<div class="dz-chips">${C.files.map((f, i) => `<span class="dz-chip">${f.type.startsWith('image/') ? `<img src="${f.url}" alt="">` : svg('note')}${esc(f.name.slice(0, 28))}<button data-rmf="${i}" aria-label="Quitar">×</button></span>`).join('')}</div>` : ''}
          <textarea id="dzc-text" rows="2" placeholder="Adjunta un archivo, elige tu sistema de diseño o describe lo que quieres crear">${esc(C.text)}</textarea>
          <div class="dz-cbar">
            <label class="dz-cbtn sq" title="Adjuntar archivos" aria-label="Adjuntar archivos">${svg('plus')}<input type="file" multiple hidden id="dzc-files"></label>
            <div class="dz-pick-wrap"><button class="dz-cbtn dz-sysbtn" id="dzc-sys">
              <span class="dz-systhumb">${sys ? `<img src="${thumbUrl(sys)}" alt="" onerror="this.remove()">` : svg('sliders')}</span>
              <span class="dz-cbl"><small>Sistema de diseño</small><b>${esc(sys?.name || 'Ninguno')}</b></span>${svg('chev', 'i dz-caret')}</button>
              <div class="dz-pop2 hidden" id="dzc-sys-pop"></div></div>
            <div class="dz-pick-wrap"><button class="dz-cbtn sq ${C.codebase ? 'on' : ''}" id="dzc-code" title="${C.codebase ? 'Código enlazado: ' + esc(C.codebase) : 'Enlazar tu código como referencia'}" aria-label="Enlazar código">${svg('code')}</button>
              <div class="dz-pop2 hidden" id="dzc-code-pop"></div></div>
            ${C.codebase ? `<span class="dz-codetag mono">${esc(tilde(C.codebase))}</span>` : ''}
            <span class="dz-spacer"></span>
            <div class="dz-pick-wrap"><button class="dz-cbtn" id="dzc-model">${logo(C.agent, 18, { plain: true })}<span class="dz-cbl"><small>Agente · modelo</small><b>${esc(agentName(C.agent))}${C.model ? ' · ' + esc(C.model) : ''}</b></span>${svg('chev', 'i dz-caret')}</button>
              <div class="dz-pop2 right hidden" id="dzc-model-pop"></div></div>
            <button class="dz-send" id="dzc-send" aria-label="Crear" ${C.text.trim() ? '' : 'disabled'}>${svg('up')}</button>
          </div>
        </div>
        <div class="dz-kinds">
          <button class="dz-kinds-head" id="dzc-tpl-toggle">ELIGE UNA PLANTILLA ${svg('chev', 'i dz-caret')}</button>
          ${C.tplOpen ? `<div class="dz-kgrid">${KINDS.map((k) => `<button class="dz-kind ${k.id === C.kind ? 'on' : ''}" data-kind="${k.id}">${kindArt(k)}<span>${k.name}</span></button>`).join('')}</div>` : ''}
        </div>
        ${C.kind === 'model3d' ? GUIDE_3D : ''}
      </div>

      <div class="dz-listbar">
        <div class="dz-ltabs">${[['projects', 'Proyectos'], ['systems', 'Sistemas de diseño'], ['templates', 'Plantillas']].map(([k, l]) => `<button data-dt="${k}" class="${DZ.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <span class="dz-spacer"></span>
        <label class="search sm"><svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input id="dzl-q" placeholder="Buscar" value="${esc(DZ.list.q)}" aria-label="Buscar"></label>
        <button class="btn icon ${DZ.list.starred ? 'on' : ''}" id="dzl-star" title="Solo favoritos" aria-label="Solo favoritos">${svg('star')}</button>
        <div class="seg dz-viewseg"><button data-lv="list" class="${DZ.list.view === 'list' ? 'on' : ''}" aria-label="Lista">${svg('list')}</button><button data-lv="grid" class="${DZ.list.view === 'grid' ? 'on' : ''}" aria-label="Cuadrícula">${svg('grid')}</button></div>
      </div>
      <div id="dz-list"></div>
      <p class="hint dz-mcpnote">${svg('plug')} ${DZ.registered && Object.values(DZ.registered).some(Boolean)
        ? `Tus agentes pueden usar Diseño con el MCP <code>mcp-hub-design</code> (${Object.entries(DZ.registered).filter(([, v]) => v).map(([k]) => esc(agentName(k))).join(', ')}). <a href="#" id="dz-mcp">Cambiar</a>`
        : `<a href="#" id="dz-mcp">Conecta Diseño a tus agentes</a> para que puedan crear, iterar, ver y exportar diseños desde cualquier terminal.`}</p>
    </div>`;

  // --- compositor ---
  const ta = $('#dzc-text');
  const autoSize = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 260) + 'px'; };
  autoSize();
  ta.placeholder = C.kind === 'blank' ? 'Adjunta un archivo, elige tu sistema de diseño o describe lo que quieres crear' : kind.ph;
  ta.oninput = () => { C.text = ta.value; $('#dzc-send').disabled = !C.text.trim(); autoSize(); };
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); createFromComposer(); } };
  ta.onpaste = (e) => { const f = [...(e.clipboardData?.files || [])]; if (f.length) { e.preventDefault(); addComposerFiles(f); } };
  $('.dz-composer').ondragover = (e) => e.preventDefault();
  $('.dz-composer').ondrop = (e) => { e.preventDefault(); addComposerFiles([...e.dataTransfer.files]); };
  $('#dzc-files').onchange = (e) => addComposerFiles([...e.target.files]);
  $$('[data-rmf]').forEach((b) => (b.onclick = () => { C.files.splice(Number(b.dataset.rmf), 1); renderDesignHome(); }));
  $('#dzc-send').onclick = createFromComposer;
  $('#dzc-tpl-toggle').onclick = () => { C.tplOpen = !C.tplOpen; renderDesignHome(); };
  $$('[data-kind]').forEach((b) => (b.onclick = () => { C.kind = b.dataset.kind; renderDesignHome(); $('#dzc-text').focus(); }));

  const pop = (btnId, popId, html, bind) => {
    $(btnId).onclick = (e) => {
      e.stopPropagation();
      const el = $(popId), wasHidden = el.classList.contains('hidden');
      $$('.dz-pop2').forEach((p) => p.classList.add('hidden'));
      if (!wasHidden) return;
      el.innerHTML = html(); el.classList.remove('hidden'); bind(el);
    };
  };
  pop('#dzc-sys', '#dzc-sys-pop', () => `
      <button class="dz-sysopt ${!C.system ? 'on' : ''}" data-sys=""><span class="dz-systhumb">${svg('x')}</span><span><b>Ninguno</b><small>El agente decide el estilo</small></span></button>
      ${systems.map((s) => `<button class="dz-sysopt ${C.system === s.slug ? 'on' : ''}" data-sys="${s.slug}"><span class="dz-systhumb"><img src="${thumbUrl(s)}" alt="" onerror="this.remove()"></span><span><b>${esc(s.name)}</b><small>${ago(s.updated)}</small></span></button>`).join('')}
      <hr><button class="dz-sysopt" data-sys="__new"><span class="dz-systhumb">${svg('plus')}</span><span><b>Crear sistema de diseño</b><small>Desde tu código, una web o una descripción</small></span></button>`,
    (el) => $$('[data-sys]', el).forEach((b) => (b.onclick = () => { if (b.dataset.sys === '__new') return newSystem(); C.system = b.dataset.sys; renderDesignHome(); })));
  pop('#dzc-code', '#dzc-code-pop', () => `
      <div class="form"><label>Carpeta de tu código <span class="hint">el agente la lee como referencia, sin modificarla</span>
        <input id="dzc-cb" class="field mono" list="dzc-dirs" value="${esc(C.codebase ? tilde(C.codebase) : '')}" placeholder="~/Projects/mi-app"></label>
        <datalist id="dzc-dirs">${S.recentDirs.map((d) => `<option value="${esc(tilde(d))}">`).join('')}</datalist>
        <div class="dz-popfoot">${C.codebase ? '<button class="btn sm" id="dzc-cb-clear">Quitar</button>' : ''}<button class="btn sm primary" id="dzc-cb-ok">Enlazar</button></div></div>`,
    (el) => {
      const i = $('#dzc-cb', el); i.focus();
      const ok = () => { C.codebase = i.value.trim().replace(/^~(?=$|\/)/, S.home); renderDesignHome(); };
      $('#dzc-cb-ok', el).onclick = ok; i.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
      $('#dzc-cb-clear', el)?.addEventListener('click', () => { C.codebase = ''; renderDesignHome(); });
    });
  pop('#dzc-model', '#dzc-model-pop', () => `
      ${DZ.agents.map((a) => `<button class="dz-sysopt ${C.agent === a.id ? 'on' : ''}" data-ag="${a.id}" ${a.installed ? '' : 'disabled'}>${logo(a.id, 26)}<span><b>${esc(a.name)}</b><small>${a.installed ? 'Instalado' : 'No instalado'}</small></span></button>`).join('')}
      <hr><div class="form"><label>Modelo <span class="hint">vacío = el predeterminado del agente</span><input id="dzc-model-in" class="field mono" value="${esc(C.model)}" placeholder="por defecto"></label>
      <div class="dz-mhints">${(MODEL_HINTS[C.agent] || []).map((m) => `<button class="chip ${C.model === m ? 'on' : ''}" data-mh="${m}">${m}</button>`).join('')}</div></div>`,
    (el) => {
      $$('[data-ag]', el).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); C.agent = b.dataset.ag; C.model = ''; renderDesignHome(); $('#dzc-model').click(); }));
      $$('[data-mh]', el).forEach((b) => (b.onclick = () => { C.model = b.dataset.mh; renderDesignHome(); }));
      const mi = $('#dzc-model-in', el);
      mi.onclick = (e) => e.stopPropagation();
      mi.onchange = () => { C.model = mi.value.trim(); renderDesignHome(); };
    });

  // --- lista ---
  $$('[data-dt]').forEach((b) => (b.onclick = () => { DZ.tab = b.dataset.dt; dzSave(); renderDesignHome(); }));
  $('#dzl-q').oninput = (e) => { DZ.list.q = e.target.value; renderDesignList(); };
  $('#dzl-star').onclick = () => { DZ.list.starred = !DZ.list.starred; dzSave(); renderDesignHome(); };
  $$('[data-lv]').forEach((b) => (b.onclick = () => { DZ.list.view = b.dataset.lv; dzSave(); renderDesignHome(); }));
  $('#dz-mcp').onclick = (e) => { e.preventDefault(); registerDesignMcp(); };
  renderDesignList();
}
function registerDesignMcp() {
  modal(`<div class="mhead">${logo('design', 44)}<div><small>Servidor MCP</small><h2>Diseño para tus agentes</h2></div></div>
    <p class="sub" style="margin-top:12px">Añade <code>mcp-hub-design</code> a los agentes que elijas. Podrán crear diseños (<code>design_create</code>), iterarlos (<code>design_message</code>), verlos como imagen (<code>design_screenshot</code>), exportarlos (<code>design_export</code>) y abrirlos aquí para ti (<code>design_open</code>).</p>
    <div class="form"><div class="flabel">Conectar a${targetsChecks(DZ.registered || null)}</div><span class="hint">MCP Hub tiene que estar abierto.</span></div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="dm-ok">Conectar</button></div>`);
  $('#dm-ok').onclick = async () => {
    try { reportErrors((await api('/api/design/register', { targets: readTargets() })).errors) && toast('Diseño conectado a los agentes'); closeModal(); await refresh(); loadDesign().then(renderDesignHome); }
    catch (e) { toast(e.message, true); }
  };
}
document.addEventListener('click', (e) => { if (!e.target.closest('.dz-pick-wrap, .dz-rowmenu')) { $$('.dz-pop2').forEach((p) => p.classList.add('hidden')); $('.dz-rowmenu')?.remove(); } });

// Guía para el usuario: cómo pedir un buen objeto 3D (se muestra al elegir «Objeto 3D»)
const GUIDE_3D = `<details class="dz-guide" open><summary>${svg('info')}Cómo conseguir un buen objeto 3D</summary><div class="dz-guide-body">
  <ol>
    <li><b>Describe las piezas y sus medidas</b>, no solo el nombre: «frasco rectangular de 9 × 7 × 3 cm, tapón cúbico dorado de 3 cm, etiqueta negra con el texto NOIR».</li>
    <li><b>Adjunta una foto</b> de frente (y otra de lado si puedes): el agente copia la silueta, los colores y los textos que se vean.</li>
    <li><b>Di los materiales</b>: cristal, metal pulido o cepillado, plástico mate o brillante, madera, tela, laca… Es lo que más realismo da.</li>
    <li><b>Pide los cambios de uno en uno</b> («el tapón más alto», «cristal ahumado», «gíralo de frente») o marca la pieza con <b>Comentarios</b> en el lienzo.</li>
    <li><b>Para estilo vóxel o Minecraft</b>, dilo tal cual: se construye con cubos.</li>
  </ol>
  <p>El agente parte de una escena ya preparada (luz de estudio, reflejos, sombra, giro con el ratón) y solo modela el objeto; al terminar se mira desde el frente, el lado y arriba, y corrige lo que vea mal.</p>
  <p><b>Descargar</b>: Exportar → Modelo 3D: GLB, glTF, FBX, OBJ, BLEND, USDZ, USD, STL, PLY y Alembic. Solo se exporta el objeto, sin fondo ni suelo.</p>
  <p><b>¿Claude o Codex?</b> Con el mismo encargo (un frasco de perfume), Claude tardó unos 1,5 min y Codex entre 2 y 4 según su esfuerzo de razonamiento; los dos dieron un buen resultado. Con Codex, en la barra del proyecto puedes elegir el esfuerzo: «medio» (por defecto) es el equilibrio; «bajo» es aún más rápido para probar ideas; «máximo» detalla algo más pero tarda el doble.</p>
</div></details>`;
function addComposerFiles(files) {
  for (const f of files) DZ.compose.files.push(Object.assign(f, { url: f.type.startsWith('image/') ? URL.createObjectURL(f) : '' }));
  const keep = $('#dzc-text')?.value; renderDesignHome(); if (keep != null) $('#dzc-text').value = keep;
}

async function createFromComposer() {
  const C = DZ.compose;
  const kind = KINDS.find((k) => k.id === C.kind) || { id: DZ_TYPES[C.kind] ? C.kind : 'blank' };
  if (kind.needs === 'image' && !C.files.length) return toast('Adjunta la captura que quieres convertir (botón de adjuntar, arrastrar o pegar)', true);
  if (kind.needs === 'codebase' && !C.codebase) return toast('Enlaza primero el código del proyecto con el botón </>', true);
  const text = kind.auto ? `${kind.auto}${C.text.trim() ? `\n\nIndicaciones del usuario: ${C.text.trim()}` : ''}` : C.text.trim();
  if (!text) return $('#dzc-text').focus();
  const btn = $('#dzc-send'); btn.disabled = true; btn.classList.add('busy');
  try {
    const name = (kind.auto ? `${kind.name}${C.text.trim() ? ': ' + C.text.trim() : C.codebase ? ': ' + C.codebase.split('/').pop() : ''}` : text).replace(/\s+/g, ' ').split(/[.\n:;]/)[0].slice(0, 48);
    const { slug } = await api('/api/design/create', { name, type: kind.type || kind.id, agent: C.agent, model: C.model, system: C.system || null, codebase: C.codebase || null });
    const images = [];
    for (const f of await readFilesAsData(C.files)) images.push((await api('/api/design/attach', { slug, ...f })).path);
    await api('/api/design/run', { slug, text, images, display: kind.auto ? (C.text.trim() || kind.name) : undefined });
    if (kind.frame) DZ.frame = kind.frame;
    Object.assign(C, { text: '', files: [] });
    openDesign(slug);
  } catch (e) { toast(e.message, true); btn.disabled = false; btn.classList.remove('busy'); }
}

function renderDesignList() {
  const box = $('#dz-list'); if (!box) return;
  const q = DZ.list.q.trim().toLowerCase();
  let items = DZ.projects.filter((p) => (DZ.tab === 'templates' ? p.template : !p.template && (DZ.tab === 'systems' ? p.type === 'system' : p.type !== 'system')))
    .filter((p) => (!q || p.name.toLowerCase().includes(q)) && (!DZ.list.starred || p.starred));
  items.sort(DZ.list.sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => (b.viewed || b.updated) - (a.viewed || a.updated));
  const typeName = (p) => KINDS.find((k) => k.id === p.type)?.name || DZ_TYPES[p.type] || p.type;
  const examples = DZ.tab === 'templates' && !q && !DZ.list.starred ? `<h2 class="section-title">Ejemplos para empezar</h2>
    <div class="grid dz-templates">${TEMPLATES.map((t) => `<button class="card dz-tpl" data-tpl="${t.id}"><div class="head">${kindArt(KINDS.find((k) => k.id === (t.frame === 'mobile' ? 'mobile' : t.type === 'prototype' ? 'mockups' : t.type)) || KINDS[0], 40)}<div><b>${esc(t.name)}</b><small>${esc(KINDS.find((k) => k.id === t.type)?.name || DZ_TYPES[t.type])}</small></div></div><p>${esc(t.desc)}</p></button>`).join('')}</div>` : '';
  const empty = `<div class="dz-empty">${DZ.tab === 'templates' ? 'Aún no has guardado plantillas. En cualquier proyecto: ··· → <b>Guardar como plantilla</b>.'
    : DZ.tab === 'systems' ? 'Aún no tienes sistemas de diseño. <a href="#" id="dzl-newsys">Crea uno</a> desde tu código, una web o una descripción.'
    : q || DZ.list.starred ? 'Nada coincide con el filtro.' : 'Aún no tienes proyectos. Describe arriba lo que quieres crear.'}</div>`;
  const star = (p) => `<button class="dz-star ${p.starred ? 'on' : ''}" data-act="star" aria-label="Favorito" title="Favorito">${svg('star')}</button>`;
  const more = `<button class="btn sm icon dz-more" data-act="menu" aria-label="Más opciones">${svg('dots')}</button>`;
  box.innerHTML = (DZ.tab === 'templates' && items.length ? '<h2 class="section-title">Tus plantillas</h2>' : '') + (!items.length ? (DZ.tab === 'templates' ? '' : empty)
    : DZ.list.view === 'grid' ? `<div class="grid dz-grid">${items.map((p) => `<article class="dz-card" data-slug="${p.slug}">
        <div class="dz-thumb"><img src="${thumbUrl(p)}" alt="" onerror="this.remove()">${p.running ? '<span class="pill warn dz-run">Trabajando…</span>' : ''}</div>
        <div class="dz-card-meta"><div><b>${esc(p.name)}</b><small>${esc(typeName(p))} · ${ago(p.viewed || p.updated)}</small></div>${star(p)}${more}</div></article>`).join('')}</div>`
    : `<div class="dz-table"><div class="dz-tr head"><span></span><button data-sort="name">Nombre${DZ.list.sort === 'name' ? ' ↓' : ''}</button><button data-sort="viewed">Última vista${DZ.list.sort === 'viewed' ? ' ↓' : ''}</button><span>Tipo</span><span>Agente</span><span></span><span></span></div>
        ${items.map((p) => `<div class="dz-tr" data-slug="${p.slug}"><span class="dz-mini"><img src="${thumbUrl(p)}" alt="" onerror="this.remove()"></span>
          <span class="dz-tname">${esc(p.name)}${p.running ? ' <span class="pill warn">Trabajando…</span>' : ''}</span><span class="hint">${ago(p.viewed || p.updated)}</span>
          <span class="hint">${esc(typeName(p))}</span><span class="dz-tagent">${logo(p.agent, 18, { plain: true })}${esc(agentName(p.agent))}</span>${more}${star(p)}</div>`).join('')}</div>`)
    + (DZ.tab === 'templates' && !items.length && !examples ? empty : '') + examples;

  $('#dzl-newsys')?.addEventListener('click', (e) => { e.preventDefault(); newSystem(); });
  $$('[data-sort]').forEach((b) => (b.onclick = () => { DZ.list.sort = b.dataset.sort; dzSave(); renderDesignList(); }));
  $$('#dz-list [data-tpl]').forEach((b) => (b.onclick = () => {
    const t = TEMPLATES.find((x) => x.id === b.dataset.tpl);
    Object.assign(DZ.compose, { text: t.prompt, kind: t.frame === 'mobile' ? 'mobile' : t.type });
    renderDesignHome(); $('#design-body').closest('.view').scrollTo({ top: 0, behavior: 'smooth' }); $('#dzc-text').focus();
  }));
  $$('#dz-list [data-slug]').forEach((row) => (row.onclick = async (e) => {
    const slug = row.dataset.slug, p = DZ.projects.find((x) => x.slug === slug), act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return p.template ? useTemplate(p) : openDesign(slug);
    e.stopPropagation();
    if (act === 'star') { await api('/api/design/update', { slug, starred: !p.starred }); return loadDesign(); }
    if (act === 'menu') return rowMenu(e.target.closest('[data-act]'), p);
  }));
}

function rowMenu(anchor, p) {
  $('.dz-rowmenu')?.remove();
  const m = document.createElement('div');
  m.className = 'dz-menu dz-rowmenu';
  const items = p.template
    ? [['use', 'Usar plantilla'], ['rename', 'Renombrar'], ['edit', 'Editar plantilla'], ['untemplate', 'Quitar de plantillas'], ['folder', 'Abrir la carpeta'], ['del', 'Eliminar']]
    : [['open', 'Abrir'], ['rename', 'Renombrar'], ['dup', 'Duplicar'], ['template', 'Guardar como plantilla'], ['folder', 'Abrir la carpeta'], ['del', 'Eliminar']];
  m.innerHTML = items.map(([k, l]) => `${k === 'del' ? '<hr>' : ''}<button data-m="${k}" class="${k === 'del' ? 'danger' : ''}">${l}</button>`).join('');
  document.body.append(m);
  const r = anchor.getBoundingClientRect();
  Object.assign(m.style, { position: 'fixed', top: Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 10) + 'px', left: Math.max(10, r.right - m.offsetWidth) + 'px', right: 'auto' });
  $$('button', m).forEach((b) => (b.onclick = async () => {
    m.remove();
    const slug = p.slug;
    try {
      if (b.dataset.m === 'open' || b.dataset.m === 'edit') return openDesign(slug);
      if (b.dataset.m === 'use') return useTemplate(p);
      if (b.dataset.m === 'dup') { await api('/api/design/duplicate', { slug }); toast('Duplicado'); return loadDesign(); }
      if (b.dataset.m === 'template') { await api('/api/design/duplicate', { slug, template: true }); toast('Guardado en Plantillas'); return loadDesign(); }
      if (b.dataset.m === 'untemplate') { await api('/api/design/update', { slug, template: false }); toast('Movido a Proyectos'); return loadDesign(); }
      if (b.dataset.m === 'folder') return api('/api/design/open-folder', { slug });
      if (b.dataset.m === 'rename') {
        modal(`<div class="mhead">${logo('design', 40)}<div><small>Renombrar</small><h2>${esc(p.name)}</h2></div></div>
          <div class="form"><label>Nombre<input id="rn-name" class="field" value="${esc(p.name)}"></label></div>
          <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="rn-ok">Guardar</button></div>`);
        const ok = async () => { await api('/api/design/update', { slug, name: $('#rn-name').value }); closeModal(); loadDesign(); };
        $('#rn-ok').onclick = ok; $('#rn-name').onkeydown = (e) => { if (e.key === 'Enter') ok(); };
        return;
      }
      if (b.dataset.m === 'del') {
        modal(`<div class="mhead">${logo('design', 40)}<div><small>Eliminar</small><h2>${esc(p.name)}</h2></div></div>
          <p class="sub" style="margin-top:14px">Se moverá a <code>~/Designs/.papelera</code> (puedes recuperarlo desde ahí).</p>
          <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn danger" id="dd-ok">${svg('trash')}Eliminar</button></div>`);
        $('#dd-ok').onclick = async () => { try { await api('/api/design/delete', { slug }); closeModal(); loadDesign(); } catch (err) { toast(err.message, true); } };
      }
    } catch (err) { toast(err.message, true); }
  }));
}

function useTemplate(p) {
  modal(`<div class="mhead">${logo('design', 40)}<div><small>Usar plantilla</small><h2>${esc(p.name)}</h2></div></div>
    <div class="form"><label>Nombre del nuevo proyecto<input id="ut-name" class="field" value="${esc(p.name)}"></label></div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="ut-ok">Crear proyecto</button></div>`);
  $('#ut-ok').onclick = async () => {
    try { const r = await api('/api/design/duplicate', { slug: p.slug, name: $('#ut-name').value, template: false }); closeModal(); openDesign(r.slug); }
    catch (e) { toast(e.message, true); }
  };
}

const agentOptions = (sel) => DZ.agents.map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''} ${a.installed ? '' : 'disabled'}>${esc(a.name)}${a.installed ? '' : ' (no instalado)'}</option>`).join('');
const defaultAgent = () => (DZ.agents.find((a) => a.id === 'claude' && a.installed) || DZ.agents.find((a) => a.installed))?.id;

function readFilesAsData(files) {
  return Promise.all([...files].map((f) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok({ name: f.name, data: r.result }); r.readAsDataURL(f); })));
}
// Abre la pantalla de inicio con el compositor listo (para "Nuevo diseño")
function newDesign() { DZ.slug = null; DZ.p = null; show('design'); renderDesignHome(); $('#dzc-text')?.focus(); }

function newSystem() {
  let src = 'folder';
  modal(`<div class="mhead">${logo('design', 44)}<div><small>Diseño</small><h2>Nuevo sistema de diseño</h2></div></div>
    <p class="sub" style="margin-top:10px">El agente crea <code>DESIGN.md</code> (reglas), <code>tokens.css</code> (variables y componentes) y una página de muestra. Luego lo eliges al crear diseños.</p>
    <div class="form">
      <div class="seg" id="ns-src"><button type="button" data-s="folder">Desde mi código</button><button type="button" data-s="url">Desde una web</button><button type="button" data-s="scratch">Desde cero</button></div>
      <label>Nombre<input id="ns-name" class="field" placeholder="Mi marca"></label>
      <label data-for="folder">Carpeta del proyecto<input id="ns-folder" class="field mono" list="ns-dirs" placeholder="~/Projects/mi-app"><datalist id="ns-dirs">${S.recentDirs.map((d) => `<option value="${esc(d)}">`).join('')}</datalist></label>
      <label data-for="url">URL<input id="ns-url" class="field mono" placeholder="https://…"></label>
      <label>Indicaciones <span class="hint" data-for="folder url">opcional</span><textarea id="ns-notes" class="field" rows="3" placeholder="Marca, tono, colores, tipografías, público…"></textarea></label>
      <div class="row"><label>Agente<select id="ns-agent" class="field">${agentOptions(defaultAgent())}</select></label><label>Modelo <span class="hint">opcional</span><input id="ns-model" class="field mono"></label></div>
    </div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="ns-ok">Crear</button></div>`);
  const sync = () => { $$('#ns-src button').forEach((b) => b.classList.toggle('on', b.dataset.s === src)); $$('#modal [data-for]').forEach((el) => (el.style.display = el.dataset.for.split(' ').includes(src) ? '' : 'none')); };
  $$('#ns-src button').forEach((b) => (b.onclick = () => { src = b.dataset.s; sync(); }));
  sync();
  $('#ns-ok').onclick = async (e) => {
    const source = src === 'folder' ? { folder: $('#ns-folder').value.trim() } : src === 'url' ? { url: $('#ns-url').value.trim() } : {};
    const notes = $('#ns-notes').value.trim();
    if (src === 'folder' && !source.folder) return toast('Indica la carpeta del proyecto', true);
    if (src === 'url' && !/^https?:\/\//.test(source.url)) return toast('Indica una URL válida', true);
    if (src === 'scratch' && !notes) return toast('Describe el sistema de diseño', true);
    e.target.disabled = true;
    try {
      const { slug } = await api('/api/design/create', { name: $('#ns-name').value.trim() || 'Sistema de diseño', type: 'system', agent: $('#ns-agent').value,
        model: $('#ns-model').value.trim(), source, prompt: notes });
      closeModal(); openDesign(slug);
    } catch (err) { toast(err.message, true); e.target.disabled = false; }
  };
}

// ---------------- Proyecto ----------------
async function openDesign(slug) {
  DZ.slug = slug; DZ.version = null; DZ.edits = []; DZ.pendingImages = []; DZ.pendingComments = []; DZ.mode = 'view'; DZ.live = [];
  if (currentView !== 'design') show('design');
  try { DZ.p = await api(`/api/design/project?slug=${slug}&view=1`); } catch (e) { DZ.slug = null; return toast(e.message, true); }
  const kindFrame = { mobile: 'mobile', animation: 'fit', model3d: 'fit' }[DZ.p.type];
  if (kindFrame) DZ.frame = kindFrame;
  DZ.live = DZ.p.runLog || [];
  if (DZ.p.type === 'slides') DZ.zoom = 'fit';
  renderProject();
}
function closeDesign() { DZ.slug = null; DZ.p = null; loadDesign(); }
async function reloadProject() {
  if (!DZ.slug) return;
  const live = DZ.live;
  DZ.p = await api(`/api/design/project?slug=${DZ.slug}`);
  DZ.live = DZ.p.running ? live : [];
}

function renderProject() {
  const p = DZ.p, slides = p.type === 'slides';
  $('#view-design').classList.add('dz-open');
  $('#design-body').innerHTML = `
    <div class="dz">
      <header class="dz-top">
        <button class="btn icon" id="dz-back" title="Todos los diseños" aria-label="Volver">${svg('back')}</button>
        <input id="dz-name" class="dz-name" value="${esc(p.name)}" aria-label="Nombre del diseño">
        <span class="tag">${DZ_TYPES[p.type] || p.type}</span>
        <button class="btn dz-mtoggle" id="dz-mtoggle" aria-label="Cambiar entre chat y lienzo">${svg('design')}<span>Ver lienzo</span></button>
        <div class="dz-agent">${logo(p.agent, 22, { plain: true })}<select id="dz-agent" aria-label="Agente">${agentOptions(p.agent)}</select>
          <input id="dz-model" class="mono" value="${esc(p.model || '')}" placeholder="modelo" aria-label="Modelo">
          ${p.agent === 'codex' ? `<select id="dz-effort" title="Esfuerzo de razonamiento de Codex: menos es más rápido" aria-label="Esfuerzo de razonamiento">${[['low', 'Esfuerzo bajo (más rápido)'], ['medium', 'Esfuerzo medio (recomendado)'], ['high', 'Esfuerzo alto'], ['xhigh', 'Esfuerzo máximo (lento)'], ['', 'Esfuerzo: el de tu config']].map(([v, l]) => `<option value="${v}" ${(p.effort ?? 'medium') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}</div>
        <span class="dz-spacer"></span>
        <div class="seg dz-modes" id="dz-modes">
          <button data-mode="view" title="Navegar (V)">${svg('cursor')}</button><button data-mode="comment" title="Comentar (C)">${svg('comment')}</button>
          <button data-mode="edit" title="Editar textos (E)">${svg('text')}</button><button data-mode="draw" title="Dibujar (D)">${svg('pen')}</button></div>
        ${slides ? '' : `<select id="dz-frame" class="field sm" aria-label="Tamaño">${Object.entries(FRAMES).map(([k, f]) => `<option value="${k}" ${DZ.frame === k ? 'selected' : ''}>${f[2]}${f[0] ? ` · ${f[0]}` : ''}</option>`).join('')}</select>
          <select id="dz-zoom" class="field sm" aria-label="Zoom">${[['fit', 'Encajar'], ['0.5', '50%'], ['0.75', '75%'], ['1', '100%']].map(([v, l]) => `<option value="${v}" ${DZ.zoom === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`}
        <button class="btn icon" id="dz-reload" title="Recargar" aria-label="Recargar">${svg('reload')}</button>
        <div class="dz-menu-wrap"><button class="btn" id="dz-export" title="Exportar y compartir">${svg('download')}<span class="lbl">Exportar</span></button><div class="dz-menu hidden" id="dz-export-menu">
          ${slides ? '<button data-x="present">Presentar a pantalla completa</button><button data-x="pptx">PowerPoint (.pptx)</button>' : ''}
          ${p.type === 'model3d' ? `<span class="dz-menu-h">Modelo 3D (solo el objeto)</span>${MODEL_FORMATS.map(([x, l, h]) => `<button data-x="${x}">${l}<small>${h}</small></button>`).join('')}<hr>` : ''}
          <button data-x="pdf">PDF</button><button data-x="png">${slides ? 'Imágenes PNG (.zip)' : 'Imagen PNG (página completa)'}</button>
          <button data-x="html">Archivo HTML único (para compartir)</button><button data-x="zip">Carpeta del proyecto (.zip)</button>
          <hr><button data-x="video-mp4">Vídeo de demostración (.mp4)</button><button data-x="video-gif">Demostración animada (.gif)</button>
          <hr><button data-x="open">Abrir en una ventana</button><button data-x="folder">Abrir la carpeta</button><button data-x="dup">Duplicar</button></div></div>
        <button class="btn primary" id="dz-handoff" title="Pasar a código">${svg('code')}<span class="lbl">Pasar a código</span></button>
      </header>
      <div class="dz-main">
        <aside class="dz-side">
          <div class="dz-tabs" role="tablist">${[['chat', 'Chat'], ['comments', 'Comentarios'], ['tweaks', 'Ajustes'], ['versions', 'Versiones']].map(([k, l]) =>
            `<button data-panel="${k}" class="${DZ.panel === k ? 'on' : ''}">${l}${k === 'comments' ? `<em id="dz-ccount"></em>` : ''}</button>`).join('')}</div>
          <div class="dz-panel" id="dz-panel"></div>
        </aside>
        <div class="dz-canvas" id="dz-canvas">
          <div class="dz-banner hidden" id="dz-banner"></div>
          <div class="dz-stage" id="dz-stage">
            <iframe id="dz-frame-el" title="Diseño" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox"></iframe>
            <canvas id="dz-draw" class="hidden"></canvas>
          </div>
          <div class="dz-floating" id="dz-drawbar"></div>
          <div class="dz-floating" id="dz-editbar"></div>
          <div class="dz-floating dz-slidenav hidden" id="dz-slidenav"><button data-s="-1" aria-label="Anterior">‹</button><span id="dz-slidepos"></span><button data-s="1" aria-label="Siguiente">›</button></div>
          <div class="dz-pop hidden" id="dz-pop"></div>
        </div>
      </div>
    </div>`;

  $('#dz-back').onclick = closeDesign;
  $('#dz-mtoggle').onclick = () => {
    const on = $('.dz').classList.toggle('m-canvas');
    $('#dz-mtoggle span').textContent = on ? 'Ver chat' : 'Ver lienzo';
    requestAnimationFrame(layoutStage);
  };
  $('#dz-effort')?.addEventListener('change', (e) => api('/api/design/update', { slug: DZ.slug, effort: e.target.value }).then((r) => { DZ.p.effort = r.effort; toast('Esfuerzo de Codex actualizado'); }).catch((err) => toast(err.message, true)));
  $('#dz-name').onchange = (e) => api('/api/design/update', { slug: DZ.slug, name: e.target.value }).then((r) => { DZ.p.name = r.name; }).catch((err) => toast(err.message, true));
  $('#dz-agent').onchange = async (e) => { try { DZ.p = { ...DZ.p, ...(await api('/api/design/update', { slug: DZ.slug, agent: e.target.value })) }; $('.dz-agent .logo')?.replaceWith(document.createRange().createContextualFragment(logo(e.target.value, 22, { plain: true }))); toast(`Ahora diseña ${agentName(e.target.value)}`); } catch (err) { toast(err.message, true); } };
  $('#dz-model').onchange = (e) => api('/api/design/update', { slug: DZ.slug, model: e.target.value }).catch((err) => toast(err.message, true));
  $$('#dz-modes button').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  $('#dz-frame')?.addEventListener('change', (e) => { DZ.frame = e.target.value; dzSave(); layoutStage(); });
  $('#dz-zoom')?.addEventListener('change', (e) => { DZ.zoom = e.target.value; dzSave(); layoutStage(); });
  $('#dz-reload').onclick = () => loadFrame();
  $('#dz-export').onclick = (e) => { e.stopPropagation(); $('#dz-export-menu').classList.toggle('hidden'); };
  $$('#dz-export-menu [data-x]').forEach((b) => (b.onclick = () => { $('#dz-export-menu').classList.add('hidden'); doExport(b.dataset.x); }));
  $('#dz-handoff').onclick = handoff;
  $$('.dz-tabs [data-panel]').forEach((b) => (b.onclick = () => { DZ.panel = b.dataset.panel; $$('.dz-tabs button').forEach((x) => x.classList.toggle('on', x === b)); renderPanel(); }));
  $$('#dz-slidenav [data-s]').forEach((b) => (b.onclick = () => frameMsg({ t: 'slide', n: DZ.slides.current + Number(b.dataset.s) })));
  new ResizeObserver(() => layoutStage()).observe($('#dz-canvas'));
  setupDraw();
  setMode(DZ.mode);
  loadFrame();
  renderPanel();
}

// ---------------- Lienzo ----------------
const frameEl = () => $('#dz-frame-el');
const frameMsg = (m) => frameEl()?.contentWindow?.postMessage({ dz: 1, ...m }, '*');
const dzPhone = () => matchMedia('(max-width: 900px)').matches;
function frameSize() {
  if (DZ.p?.type === 'slides' || DZ.frame === 'fit') { const c = $('#dz-canvas'); return [c.clientWidth - 48, c.clientHeight - 48]; }
  return FRAMES[DZ.frame].slice(0, 2);
}
function stageScale() {
  const [w, h] = frameSize(), c = $('#dz-canvas');
  if (DZ.p?.type === 'slides' || DZ.frame === 'fit') return 1;
  if (DZ.zoom !== 'fit' && !dzPhone()) return Number(DZ.zoom);
  return Math.min(1, (c.clientWidth - 48) / w, (c.clientHeight - 48) / h);
}
function layoutStage() {
  const st = $('#dz-stage'); if (!st) return;
  const [w, h] = frameSize(), s = stageScale();
  Object.assign(st.style, { width: w + 'px', height: h + 'px', transform: `scale(${s})` });
  st.parentElement.classList.toggle('dz-scroll', s * w > st.parentElement.clientWidth || s * h > st.parentElement.clientHeight);
  const cv = $('#dz-draw');
  if (cv && (cv.width !== w || cv.height !== h)) { const img = cv.width ? cv.getContext('2d').getImageData(0, 0, cv.width, cv.height) : null; cv.width = w; cv.height = h; if (img) cv.getContext('2d').putImageData(img, 0, 0); }
}
function loadFrame() {
  const el = frameEl(); if (!el) return;
  DZ.tweakDefs = []; DZ.slides = { count: 0, current: DZ.slides.current || 1 };
  el.src = `${DZ.version ? DZ.p.base.replace(/\/$/, '@' + DZ.version.sha + '/') : DZ.p.base}index.html?v=${Date.now()}`;
  layoutStage();
  const b = $('#dz-banner');
  b.classList.toggle('hidden', !DZ.version);
  if (DZ.version) {
    b.innerHTML = `<span>${svg('history')}Estás viendo <b>${esc(DZ.version.message)}</b></span><button class="btn sm" id="dz-v-restore">Restaurar esta versión</button><button class="btn sm" id="dz-v-back">Volver a la actual</button>`;
    $('#dz-v-back').onclick = () => { DZ.version = null; loadFrame(); };
    $('#dz-v-restore').onclick = () => restoreVersion(DZ.version);
  }
}
function setMode(mode) {
  if (mode === 'draw' && DZ.version) return toast('Vuelve a la versión actual para dibujar', true);
  DZ.mode = mode;
  $$('#dz-modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  $('#dz-draw')?.classList.toggle('hidden', mode !== 'draw');
  frameMsg({ t: 'mode', mode: mode === 'draw' ? 'view' : mode });
  renderDrawbar();
  if (mode !== 'comment') hidePop();
}
function sendPins() {
  const open = (DZ.p?.comments || []).filter((c) => c.status === 'open');
  frameMsg({ t: 'pins', items: open.map((c, i) => ({ id: c.id, n: i + 1, selector: c.selector, text: c.text, open: true })) });
  const n = $('#dz-ccount'); if (n) n.textContent = open.length || '';
}

window.addEventListener('message', (e) => {
  if (!DZ.slug || e.source !== frameEl()?.contentWindow || !e.data?.dz) return;
  const m = e.data;
  if (m.t === 'ready') {
    DZ.tweakDefs = m.tweaks || []; DZ.tweakDefaults = Object.fromEntries((m.tweaks || []).map((d) => [d.var, String(d.value)]));
    DZ.slides = { count: m.slides, current: m.current };
    frameMsg({ t: 'mode', mode: DZ.mode === 'draw' ? 'view' : DZ.mode });
    if (DZ.version) frameMsg({ t: 'tweaks', values: {} }); else sendPins();
    updateSlideNav();
    if (DZ.panel === 'tweaks') renderPanel();
  }
  if (m.t === 'slides') { DZ.slides = { count: m.count, current: m.current }; updateSlideNav(); }
  if (m.t === 'scroll') DZ.scroll = m.y;
  if (m.t === 'pick') showPop(m);
  if (m.t === 'edit') { DZ.edits = DZ.edits.filter((x) => x.selector !== m.selector).concat({ selector: m.selector, before: DZ.edits.find((x) => x.selector === m.selector)?.before ?? m.before, after: m.after, label: m.label }); renderEditbar(); }
  if (m.t === 'pin') { DZ.panel = 'comments'; $$('.dz-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.panel === 'comments')); renderPanel(m.id); }
  if (m.t === 'escape') { hidePop(); if (DZ.mode !== 'view') setMode('view'); }
});
function updateSlideNav() {
  const nav = $('#dz-slidenav'); if (!nav) return;
  nav.classList.toggle('hidden', !DZ.slides.count);
  $('#dz-slidepos').textContent = `${DZ.slides.current} / ${DZ.slides.count}`;
}
document.addEventListener('keydown', (e) => {
  if (currentView !== 'design' || !DZ.slug || e.target.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = { v: 'view', c: 'comment', e: 'edit', d: 'draw' }[e.key.toLowerCase()];
  if (k) { e.preventDefault(); setMode(k); }
  if (DZ.slides.count && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) frameMsg({ t: 'slide', n: DZ.slides.current + (e.key === 'ArrowRight' ? 1 : -1) });
});
document.addEventListener('click', (e) => { if (!e.target.closest('.dz-menu-wrap')) $('#dz-export-menu')?.classList.add('hidden'); });

// ---- Comentario sobre un elemento ----
function showPop(m) {
  const pop = $('#dz-pop'), st = $('#dz-stage'), cv = $('#dz-canvas');
  const sr = st.getBoundingClientRect(), cr = cv.getBoundingClientRect(), s = stageScale();
  let x = sr.left - cr.left + (m.rect.x + m.rect.w) * s + 10, y = sr.top - cr.top + m.rect.y * s;
  x = Math.min(x, cv.clientWidth - 330); y = Math.max(10, Math.min(y, cv.clientHeight - 210));
  pop.style.left = Math.max(10, x) + 'px'; pop.style.top = y + 'px';
  pop.innerHTML = `<div class="dz-pop-head">${svg('comment')}<span>${esc(m.label)}</span></div>
    <textarea id="dz-pop-text" class="field" rows="3" placeholder="¿Qué cambiarías aquí?"></textarea>
    <div class="dz-pop-foot"><button class="btn sm" id="dz-pop-save" title="Guardar para enviarlo luego junto a otros">Añadir a la lista</button><button class="btn sm primary" id="dz-pop-send">Enviar al agente</button></div>`;
  pop.classList.remove('hidden');
  const ta = $('#dz-pop-text'); ta.focus();
  const save = async (andSend) => {
    const text = ta.value.trim(); if (!text) return ta.focus();
    try {
      const c = await api('/api/design/comment', { slug: DZ.slug, selector: m.selector, html: m.html, label: m.label, text });
      DZ.p.comments.push(c); hidePop(); sendPins();
      if (andSend) runAgent({ text: '', comments: [c.id], display: `Comentario sobre ${m.label}: ${text}` });
      else { toast('Comentario añadido a la lista'); if (DZ.panel === 'comments') renderPanel(); }
    } catch (e) { toast(e.message, true); }
  };
  $('#dz-pop-save').onclick = () => save(false);
  $('#dz-pop-send').onclick = () => save(true);
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(true); } if (e.key === 'Escape') hidePop(); };
}
function hidePop() { $('#dz-pop')?.classList.add('hidden'); }

// ---- Edición de textos ----
function renderEditbar() {
  const bar = $('#dz-editbar'); if (!bar) return;
  if (!DZ.edits.length) { bar.innerHTML = ''; return; }
  bar.innerHTML = `<span>${svg('text')}${DZ.edits.length} texto${DZ.edits.length > 1 ? 's' : ''} cambiado${DZ.edits.length > 1 ? 's' : ''}</span><button class="btn sm" id="dz-ed-discard">Descartar</button><button class="btn sm primary" id="dz-ed-save">Guardar</button>`;
  $('#dz-ed-discard').onclick = () => { DZ.edits = []; renderEditbar(); loadFrame(); };
  $('#dz-ed-save').onclick = async () => {
    try {
      const r = await api('/api/design/edits', { slug: DZ.slug, edits: DZ.edits });
      DZ.edits = []; renderEditbar();
      if (r.pending.length) { toast(`${r.applied} guardado${r.applied === 1 ? '' : 's'}; el resto lo aplica el agente`); runAgent({ text: '', edits: r.pending, display: `Cambiar ${r.pending.length} texto${r.pending.length > 1 ? 's' : ''}` }); }
      else { toast('Textos guardados'); loadFrame(); }
    } catch (e) { toast(e.message, true); }
  };
}

// ---- Dibujo ----
const draw = { color: '#FF4D6D', width: 4, strokes: [], cur: null };
function setupDraw() {
  const cv = $('#dz-draw');
  const pt = (e) => { const r = cv.getBoundingClientRect(), s = stageScale(); return [(e.clientX - r.left) / s, (e.clientY - r.top) / s]; };
  cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); draw.cur = { color: draw.color, width: draw.width, pts: [pt(e)] }; draw.strokes.push(draw.cur); };
  cv.onpointermove = (e) => { if (!draw.cur) return; draw.cur.pts.push(pt(e)); paint(); };
  cv.onpointerup = () => { draw.cur = null; renderDrawbar(); };
}
function paint() {
  const cv = $('#dz-draw'), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of draw.strokes) {
    ctx.strokeStyle = s.color; ctx.lineWidth = s.width; ctx.beginPath();
    s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
    ctx.stroke();
  }
}
function renderDrawbar() {
  const bar = $('#dz-drawbar'); if (!bar) return;
  if (DZ.mode !== 'draw') { bar.innerHTML = ''; return; }
  bar.innerHTML = `${['#FF4D6D', '#FFC83D', '#3DDC97', '#4DA3FF', '#111111', '#FFFFFF'].map((c) => `<button class="dz-color ${draw.color === c ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}
    <select id="dz-w" class="field sm">${[[2, 'Fino'], [4, 'Medio'], [10, 'Grueso']].map(([v, l]) => `<option value="${v}" ${draw.width === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <button class="btn sm icon" id="dz-undo" title="Deshacer" aria-label="Deshacer" ${draw.strokes.length ? '' : 'disabled'}>${svg('undo')}</button>
    <button class="btn sm" id="dz-clear" ${draw.strokes.length ? '' : 'disabled'}>Borrar</button>
    <button class="btn sm primary" id="dz-sendraw" ${draw.strokes.length ? '' : 'disabled'}>Usar en el chat</button>`;
  $$('#dz-drawbar [data-c]').forEach((b) => (b.onclick = () => { draw.color = b.dataset.c; renderDrawbar(); }));
  $('#dz-w').onchange = (e) => { draw.width = Number(e.target.value); };
  $('#dz-undo').onclick = () => { draw.strokes.pop(); paint(); renderDrawbar(); };
  $('#dz-clear').onclick = () => { draw.strokes = []; paint(); renderDrawbar(); };
  $('#dz-sendraw').onclick = sendDrawing;
}
async function sendDrawing() {
  const btn = $('#dz-sendraw'); btn.disabled = true; btn.textContent = 'Preparando…';
  try {
    const [w, h] = frameSize();
    const q = new URLSearchParams({ slug: DZ.slug, w, h, scroll: DZ.scroll || 0, token: TOKEN, ...(DZ.slides.count ? { slide: DZ.slides.current } : {}) });
    const blob = await (await fetch('/api/design/shot?' + q)).blob();
    const img = await createImageBitmap(blob);
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const ctx = out.getContext('2d'); ctx.drawImage(img, 0, 0, w, h); ctx.drawImage($('#dz-draw'), 0, 0);
    const { path } = await api('/api/design/attach', { slug: DZ.slug, name: 'dibujo.png', data: out.toDataURL('image/png'), kind: 'sketch' });
    DZ.pendingImages.push(path);
    draw.strokes = []; paint(); setMode('view');
    DZ.panel = 'chat'; $$('.dz-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.panel === 'chat')); renderPanel();
    const ta = $('#dz-input'); ta.value = ta.value || 'Mira el dibujo: '; ta.focus();
  } catch (e) { toast(e.message, true); btn.disabled = false; btn.textContent = 'Usar en el chat'; }
}

// ---------------- Panel lateral ----------------
function renderPanel(focusComment) {
  const box = $('#dz-panel'); if (!box) return;
  sendPins();
  if (DZ.panel === 'chat') return renderChat(box);
  if (DZ.panel === 'comments') return renderComments(box, focusComment);
  if (DZ.panel === 'tweaks') return renderTweaks(box);
  if (DZ.panel === 'versions') return renderVersions(box);
}

function mdLite(t) {
  return esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
}
function renderChat(box) {
  const p = DZ.p;
  const msgs = p.chat.map((m) => m.role === 'user'
    ? `<div class="dz-msg dz-us"><div class="bubble">${mdLite(m.text || '')}${(m.comments || []).map((c) => `<div class="dz-cref">${svg('comment')}<b>${esc(c.label)}</b> ${esc(c.text)}</div>`).join('')}
        ${(m.images || []).map((i) => `<img src="${p.base}${esc(i)}" alt="" class="dz-att">`).join('')}</div></div>`
    : `<div class="dz-msg dz-ag dz-st-${m.status}">${logo(m.agent, 24, { plain: true })}<div class="body">
        ${m.status === 'running' ? `<div class="dz-working"><span class="spin"></span>${esc(agentName(m.agent))} está trabajando…</div>
          <div class="dz-live" id="dz-live">${DZ.live.filter((e) => e.kind === 'tool' || e.kind === 'text').slice(-30).map(liveLine).join('')}</div>`
        : `${m.steps?.length ? `<details class="dz-steps"><summary>${m.steps.length} paso${m.steps.length > 1 ? 's' : ''}${m.ms ? ` · ${Math.round(m.ms / 1000)} s` : ''}</summary>${m.steps.map((s) => `<div>${esc(s)}</div>`).join('')}</details>` : ''}
          <div class="text">${mdLite(m.text || '')}</div>
          ${m.version ? `<button class="dz-vchip" data-sha="${m.version.sha}">${svg('history')}v${m.version.n}</button>` : ''}`}
      </div></div>`).join('');
  const openComments = p.comments.filter((c) => c.status === 'open');
  box.innerHTML = `<div class="dz-msgs" id="dz-msgs">${msgs || `<div class="dz-hello">${logo('design', 40)}<p>Cuéntale al agente qué quieres diseñar o qué cambiar.</p><p class="hint">Consejo: usa <b>Comentar</b> (C) para señalar elementos concretos del lienzo.</p></div>`}</div>
    <div class="dz-compose">
      ${DZ.pendingImages.length || DZ.pendingComments.length || openComments.length ? `<div class="dz-chips">
        ${DZ.pendingImages.map((i, n) => `<span class="dz-chip"><img src="${p.base}${esc(i)}" alt="">${/dibujo-/.test(i) ? 'Dibujo' : 'Imagen'}<button data-rmimg="${n}" aria-label="Quitar">×</button></span>`).join('')}
        ${openComments.length ? `<label class="dz-chip check"><input type="checkbox" id="dz-with-comments" ${DZ.pendingComments.length ? 'checked' : ''}>${openComments.length} comentario${openComments.length > 1 ? 's' : ''}${tick}</label>` : ''}
      </div>` : ''}
      <textarea id="dz-input" class="field" rows="3" placeholder="${p.running ? 'El agente está trabajando…' : 'Describe un cambio… (Intro para enviar, Mayús+Intro nueva línea)'}"></textarea>
      <div class="dz-compose-foot">
        <label class="btn sm icon" title="Adjuntar imagen" aria-label="Adjuntar imagen">${svg('image')}<input type="file" accept="image/*" multiple hidden id="dz-file"></label>
        <span class="hint">${esc(agentName(p.agent))}${p.model ? ' · ' + esc(p.model) : ''}</span>
        ${p.running ? `<button class="btn sm" id="dz-stop">${svg('stop')}Parar</button>` : `<button class="btn sm primary" id="dz-send">${svg('send')}Enviar</button>`}
      </div>
    </div>`;
  const list = $('#dz-msgs'); list.scrollTop = list.scrollHeight;
  $$('#dz-msgs .dz-vchip').forEach((b) => (b.onclick = () => { const v = DZ.versions.find((x) => x.sha === b.dataset.sha) || { sha: b.dataset.sha, message: b.textContent.trim() }; viewVersion(v); }));
  $$('[data-rmimg]').forEach((b) => (b.onclick = () => { DZ.pendingImages.splice(Number(b.dataset.rmimg), 1); renderPanel(); }));
  $('#dz-with-comments')?.addEventListener('change', (e) => { DZ.pendingComments = e.target.checked ? openComments.map((c) => c.id) : []; });
  if (openComments.length && !DZ.pendingComments.length && $('#dz-with-comments')) DZ.pendingComments = [];
  const ta = $('#dz-input');
  const send = () => {
    const text = ta.value.trim();
    const comments = $('#dz-with-comments')?.checked ? openComments.map((c) => c.id) : [];
    if (!text && !comments.length && !DZ.pendingImages.length) return;
    runAgent({ text, comments, images: DZ.pendingImages.slice() });
  };
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!DZ.p.running) send(); } };
  ta.onpaste = (e) => { const f = [...(e.clipboardData?.files || [])].filter((x) => x.type.startsWith('image/')); if (f.length) { e.preventDefault(); attachFiles(f); } };
  box.ondragover = (e) => e.preventDefault();
  box.ondrop = (e) => { e.preventDefault(); attachFiles([...e.dataTransfer.files].filter((x) => x.type.startsWith('image/'))); };
  $('#dz-file').onchange = (e) => attachFiles(e.target.files);
  $('#dz-send')?.addEventListener('click', send);
  $('#dz-stop')?.addEventListener('click', () => api('/api/design/cancel', { slug: DZ.slug }));
}
const liveLine = (e) => (e.kind === 'tool' ? `<div class="tool">${esc(e.text)}</div>` : `<div class="txt">${esc(e.text.slice(0, 400))}</div>`);
async function attachFiles(files) {
  for (const f of await readFilesAsData(files)) {
    try { DZ.pendingImages.push((await api('/api/design/attach', { slug: DZ.slug, ...f })).path); } catch (e) { toast(e.message, true); }
  }
  const keep = $('#dz-input')?.value;
  renderPanel();
  if (keep && $('#dz-input')) $('#dz-input').value = keep;
}
async function runAgent({ text = '', comments = [], images = [], edits = [], tweaks = false, display }) {
  if (DZ.p.running) return toast('El agente ya está trabajando', true);
  try {
    await api('/api/design/run', { slug: DZ.slug, text, comments, images, edits, tweaks, display });
    DZ.pendingImages = []; DZ.pendingComments = []; DZ.live = [];
    if (DZ.panel !== 'chat') { DZ.panel = 'chat'; $$('.dz-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.panel === 'chat')); }
    await reloadProject(); renderPanel();
  } catch (e) { toast(e.message, true); }
}

function renderComments(box, focus) {
  const cs = DZ.p.comments.slice().reverse();
  const open = cs.filter((c) => c.status === 'open');
  box.innerHTML = `<div class="dz-plist">
    <div class="dz-phead"><span>${open.length ? `${open.length} sin enviar` : 'Sin comentarios pendientes'}</span>${open.length ? `<button class="btn sm primary" id="dz-send-comments">${svg('send')}Enviar al agente</button>` : ''}</div>
    <p class="hint">Pulsa <b>Comentar</b> (C) y haz clic en cualquier elemento del lienzo.</p>
    ${cs.map((c) => `<div class="dz-comment ${c.status} ${c.id === focus ? 'focus' : ''}" data-id="${c.id}">
      <div class="dz-chead"><b>${esc(c.label || c.selector)}</b><span class="tag">${{ open: 'Pendiente', sent: 'Enviado', resolved: 'Resuelto' }[c.status]}</span></div>
      <div>${esc(c.text)}</div>
      <div class="dz-cfoot"><span class="hint">${ago(c.at)}</span>${c.status !== 'resolved' ? `<button class="btn sm" data-ca="resolve">Resolver</button>` : ''}<button class="btn sm icon" data-ca="del" aria-label="Borrar">${svg('trash')}</button></div>
    </div>`).join('')}</div>`;
  $('#dz-send-comments')?.addEventListener('click', () => runAgent({ text: '', comments: open.map((c) => c.id), display: `${open.length} comentario${open.length > 1 ? 's' : ''} del lienzo` }));
  $$('#dz-panel [data-ca]').forEach((b) => (b.onclick = async () => {
    const id = b.closest('[data-id]').dataset.id;
    await api('/api/design/comment/set', b.dataset.ca === 'del' ? { slug: DZ.slug, id, delete: true } : { slug: DZ.slug, id, status: 'resolved' });
    await reloadProject(); renderPanel();
  }));
  box.querySelector('.focus')?.scrollIntoView({ block: 'center' });
}

let tweakSaveT;
function renderTweaks(box) {
  const defs = DZ.tweakDefs, vals = DZ.p.tweaks || {};
  if (!defs.length) {
    box.innerHTML = `<div class="dz-plist"><p class="sub">Este diseño todavía no expone ajustes.</p><button class="btn" id="dz-ask-tweaks">${svg('sliders')}Pedir al agente que añada ajustes</button></div>`;
    $('#dz-ask-tweaks').onclick = () => runAgent({ text: 'Añade el bloque design-tweaks (ver AGENTS.md) con las variables más útiles de este diseño: colores, tipografía, radios y espaciado.' });
    return;
  }
  const val = (d) => vals[d.var] ?? DZ.tweakDefaults[d.var] ?? d.value;
  const num = (v) => parseFloat(v);
  box.innerHTML = `<div class="dz-plist dz-tweaks">
    ${defs.map((d) => `<label class="dz-tweak" data-var="${esc(d.var)}"><span>${esc(d.label || d.var)}<em>${esc(String(val(d)))}</em></span>
      ${d.type === 'color' ? `<input type="color" value="${esc(String(val(d)).slice(0, 7))}">`
      : d.type === 'range' ? `<input type="range" min="${d.min ?? 0}" max="${d.max ?? 100}" step="${d.step ?? 1}" value="${num(val(d))}">`
      : d.type === 'select' ? `<select class="field sm">${(d.options || []).map((o) => `<option ${String(o) === String(val(d)) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : `<input class="field sm" value="${esc(val(d))}">`}</label>`).join('')}
    <div class="dz-tweak-foot"><button class="btn sm" id="dz-tw-reset">Restablecer</button><button class="btn sm primary" id="dz-tw-bake" title="El agente fija estos valores en el código">Hacerlos definitivos</button></div>
    <p class="hint">Los cambios se ven al momento y se guardan solos.</p></div>`;
  $$('.dz-tweak').forEach((l) => {
    const d = defs.find((x) => x.var === l.dataset.var), input = l.querySelector('input, select');
    input.oninput = () => {
      const v = d.type === 'range' ? `${input.value}${d.unit || ''}` : input.value;
      l.querySelector('em').textContent = v;
      frameMsg({ t: 'tweak', var: d.var, value: v });
      DZ.p.tweaks = { ...DZ.p.tweaks, [d.var]: v };
      clearTimeout(tweakSaveT);
      tweakSaveT = setTimeout(() => api('/api/design/update', { slug: DZ.slug, tweaks: DZ.p.tweaks }).catch((e) => toast(e.message, true)), 400);
    };
  });
  $('#dz-tw-reset').onclick = async () => { DZ.p.tweaks = {}; await api('/api/design/update', { slug: DZ.slug, tweaks: {} }); loadFrame(); };
  $('#dz-tw-bake').onclick = () => runAgent({ text: 'Aplica los ajustes actuales como valores por defecto del diseño.', tweaks: true, display: 'Hacer definitivos los ajustes' });
}

async function renderVersions(box) {
  box.innerHTML = '<div class="dz-plist"><p class="hint">Cargando…</p></div>';
  try { DZ.versions = (await api(`/api/design/versions?slug=${DZ.slug}`)).versions; } catch (e) { return toast(e.message, true); }
  box.innerHTML = `<div class="dz-plist">${DZ.versions.map((v, i) => `<div class="dz-version ${DZ.version?.sha === v.sha ? 'on' : ''}" data-sha="${v.sha}">
      <div><b>${esc(v.message)}</b><span class="hint">${ago(v.at)}${i === 0 ? ' · actual' : ''}</span></div>
      ${i === 0 ? '' : `<button class="btn sm" data-va="view">Ver</button><button class="btn sm" data-va="restore">Restaurar</button>`}</div>`).join('')}</div>`;
  $$('#dz-panel [data-va]').forEach((b) => (b.onclick = () => {
    const v = DZ.versions.find((x) => x.sha === b.closest('[data-sha]').dataset.sha);
    if (b.dataset.va === 'view') viewVersion(v); else restoreVersion(v);
  }));
}
function viewVersion(v) { DZ.version = v; setMode('view'); loadFrame(); if (DZ.panel === 'versions') renderPanel(); }
function restoreVersion(v) {
  modal(`<div class="mhead">${logo('design', 40)}<div><small>Versiones</small><h2>Restaurar versión</h2></div></div>
    <p class="sub" style="margin-top:14px">El diseño volverá a <b>${esc(v.message)}</b>. Se guarda como una versión nueva, así que no pierdes nada.</p>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="rv-ok">Restaurar</button></div>`);
  $('#rv-ok').onclick = async () => {
    try { await api('/api/design/restore', { slug: DZ.slug, sha: v.sha }); closeModal(); DZ.version = null; toast('Versión restaurada'); loadFrame(); renderPanel(); }
    catch (e) { toast(e.message, true); }
  };
}

// ---------------- Exportar y pasar a código ----------------
// Formatos 3D: los primeros salen de la escena con Three.js; FBX, BLEND, USD, Alembic y OBJ se convierten con Blender
const MODEL_FORMATS = [
  ['glb', 'GLB', 'Web, realidad aumentada en Android, motores de juego'], ['gltf', 'glTF', 'Web (JSON con texturas incluidas)'],
  ['fbx', 'FBX', 'Unity, Unreal, Maya, 3ds Max'], ['obj', 'OBJ + MTL (.zip)', 'Formato universal, con materiales y texturas'],
  ['blend', 'BLEND', 'Para seguir editándolo en Blender'], ['usdz', 'USDZ', 'Realidad aumentada en iPhone y iPad'],
  ['usd', 'USD', 'Omniverse, Houdini, Maya'], ['stl', 'STL', 'Impresión 3D'], ['ply', 'PLY', 'Impresión 3D y escaneado'], ['abc', 'Alembic', 'Animación y VFX'],
];
async function doExport(x) {
  const p = DZ.p;
  if (x === 'open') return window.open(p.base + 'index.html', '_blank');
  if (x === 'present') { const w = window.open(p.base + 'index.html', '_blank'); w?.addEventListener('load', () => w.document.documentElement.requestFullscreen?.().catch(() => {})); return; }
  if (x === 'folder') return api('/api/design/open-folder', { slug: DZ.slug });
  if (x === 'dup') { const r = await api('/api/design/duplicate', { slug: DZ.slug }); toast('Duplicado'); return openDesign(r.slug); }
  const [w, h] = DZ.frame === 'fit' ? [1440, 900] : FRAMES[DZ.frame];
  const video = x.startsWith('video-') ? x.slice(6) : null;
  const fmt3d = MODEL_FORMATS.find((f) => f[0] === x);
  toast(video ? 'Grabando el recorrido de demostración (tarda unos segundos)…' : fmt3d ? `Exportando el modelo a ${fmt3d[1]}…` : `Exportando ${x.toUpperCase()}…`);
  try {
    const r = await fetch(video ? `/api/design/video?${new URLSearchParams({ slug: DZ.slug, format: video, w, h, token: TOKEN })}` : `/api/design/export?${new URLSearchParams({ slug: DZ.slug, format: x, w, h, token: TOKEN })}`);
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
    const name = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '')?.[1] || `diseno.${x}`;
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast(`Descargado ${name}`);
  } catch (e) { toast(e.message, true); }
}

function handoff() {
  const p = DZ.p;
  modal(`<div class="mhead">${logo(p.agent, 44)}<div><small>Pasar a código</small><h2>${esc(p.name)}</h2></div></div>
    <p class="sub" style="margin-top:10px">Abre un agente en una terminal con el encargo de implementar este diseño de verdad (componentes, datos, lógica).</p>
    <div class="form">
      <label>Agente<select id="ho-agent" class="field">${agentOptions(p.agent)}</select></label>
      <label>Carpeta del proyecto de código<input id="ho-cwd" class="field mono" list="ho-dirs" value="${esc(tilde(p.dir))}"><datalist id="ho-dirs">${S.recentDirs.map((d) => `<option value="${esc(tilde(d))}">`).join('')}</datalist></label>
      <span class="hint">Déjala como está para convertirlo en una app en la misma carpeta, o elige tu repositorio para integrarlo ahí.</span>
      <label>Indicaciones <span class="hint">opcional</span><textarea id="ho-notes" class="field" rows="3" placeholder="Stack (React, Next, Vue…), qué conectar, qué no tocar…"></textarea></label>
    </div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="ho-ok">${svg('code')}Abrir agente</button></div>`);
  $('#ho-ok').onclick = async () => {
    try {
      const r = await api('/api/design/handoff', { slug: DZ.slug, agent: $('#ho-agent').value, cwd: $('#ho-cwd').value.trim(), notes: $('#ho-notes').value.trim() });
      closeModal(); activeId = r.session.id; show('terms'); syncTabs();
    } catch (e) { toast(e.message, true); }
  };
}

// ---------------- Eventos en vivo ----------------
let dzListT;
function onDesignEvent(m) {
  if (m.t === 'design-open') { toast('Un agente ha abierto un diseño'); return openDesign(m.slug); }
  if (m.slug !== DZ.slug) { clearTimeout(dzListT); dzListT = setTimeout(loadDesign, 400); return; }
  const ev = m.ev;
  if (ev.kind === 'text' || ev.kind === 'tool') {
    DZ.live.push(ev);
    const live = $('#dz-live');
    if (live) { live.insertAdjacentHTML('beforeend', liveLine(ev)); while (live.children.length > 30) live.firstChild.remove(); const l = $('#dz-msgs'); l.scrollTop = l.scrollHeight; }
  } else if (ev.kind === 'start') {
    reloadProject().then(() => DZ.panel === 'chat' && renderPanel());
  } else if (ev.kind === 'end') {
    reloadProject().then(() => { if (!DZ.version) loadFrame(); renderPanel(); });
    if (ev.status === 'error') toast('El agente terminó con un error', true);
  } else if (ev.kind === 'error') {
    toast(ev.text, true); reloadProject().then(() => renderPanel());
  } else if (ev.kind === 'meta' && !DZ.p?.running) {
    reloadProject().then(() => { sendPins(); if (DZ.panel === 'comments') renderPanel(); });
  }
}

loadDesign();
if (/^#design\/[a-z0-9-]+$/.test(location.hash)) openDesign(location.hash.split('/')[1]);
