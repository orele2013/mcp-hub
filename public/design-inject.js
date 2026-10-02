// MCP Hub → Diseño: se inyecta en el diseño. Dentro del lienzo comunica con la app (comentarios, edición de textos,
// ajustes, diapositivas); suelto (exportado o en capturas) solo hace de visor de diapositivas.
(() => {
  if (window.__dz) return;
  const embedded = window.parent !== window;
  const q = new URLSearchParams(location.search);
  const clean = q.has('clean');
  const post = (m) => { if (embedded) window.parent.postMessage({ dz: 1, ...m }, '*'); };
  const ACCENT = '#8B7CFF';
  let mode = 'view';

  // ---------- Selector estable y descripción de un elemento ----------
  function selector(el) {
    if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
      let p = el.tagName.toLowerCase();
      if (el.id) { parts.unshift(p + '#' + CSS.escape(el.id)); break; }
      const cls = [...el.classList].filter((c) => !c.startsWith('dz-')).slice(0, 2);
      if (cls.length) p += '.' + cls.map((c) => CSS.escape(c)).join('.');
      const sib = [...el.parentElement.children].filter((x) => x.tagName === el.tagName);
      if (sib.length > 1) p += `:nth-of-type(${sib.indexOf(el) + 1})`;
      parts.unshift(p);
      el = el.parentElement;
    }
    return parts.join(' > ') || 'body';
  }
  const NAMES = { button: 'botón', a: 'enlace', img: 'imagen', h1: 'título', h2: 'título', h3: 'subtítulo', p: 'párrafo', input: 'campo', nav: 'navegación',
    header: 'cabecera', footer: 'pie', section: 'sección', ul: 'lista', li: 'elemento de lista', form: 'formulario', table: 'tabla', svg: 'gráfico', div: 'bloque', span: 'texto' };
  function label(el) {
    const t = (el.innerText || el.getAttribute('alt') || el.getAttribute('aria-label') || el.value || '').trim().replace(/\s+/g, ' ');
    return `${NAMES[el.tagName.toLowerCase()] || el.tagName.toLowerCase()}${t ? ` “${t.slice(0, 40)}${t.length > 40 ? '…' : ''}”` : ''}`;
  }
  const snippet = (el) => el.outerHTML.replace(/\s+/g, ' ').slice(0, 800);

  // ---------- Capa de resaltado ----------
  let box;
  function ensureBox() {
    if (box) return box;
    box = document.createElement('div');
    box.className = 'dz-box';
    box.style.cssText = `position:fixed;pointer-events:none;z-index:2147483646;border:2px solid ${ACCENT};background:${ACCENT}22;border-radius:4px;transition:all .06s;display:none`;
    document.documentElement.appendChild(box);
    return box;
  }
  function highlight(el) {
    const b = ensureBox();
    if (!el) { b.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    Object.assign(b.style, { display: 'block', left: r.left - 2 + 'px', top: r.top - 2 + 'px', width: r.width + 4 + 'px', height: r.height + 4 + 'px' });
  }
  const pickable = (el) => el && el.nodeType === 1 && el !== document.body && el !== document.documentElement && !el.closest('.dz-ui');
  const isText = (el) => pickable(el) && el.innerText && el.innerText.trim() && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

  document.addEventListener('mousemove', (e) => {
    if (mode === 'comment') highlight(pickable(e.target) ? e.target : null);
    else if (mode === 'edit') highlight(isText(e.target) && !e.target.isContentEditable ? e.target : null);
  }, true);
  document.addEventListener('mouseleave', () => highlight(null));
  document.addEventListener('click', (e) => {
    if (mode === 'view') return;
    const el = e.target;
    if (mode === 'comment' && pickable(el)) {
      e.preventDefault(); e.stopPropagation();
      const r = el.getBoundingClientRect();
      post({ t: 'pick', selector: selector(el), html: snippet(el), label: label(el), rect: { x: r.left, y: r.top, w: r.width, h: r.height } });
    } else if (mode === 'edit' && isText(el)) {
      e.preventDefault(); e.stopPropagation();
      if (el.isContentEditable) return;
      const before = el.innerText;
      el.contentEditable = 'true'; el.classList.add('dz-editing');
      el.style.outline = `2px solid ${ACCENT}`; el.focus();
      highlight(null);
      el.addEventListener('blur', () => {
        el.contentEditable = 'false'; el.classList.remove('dz-editing'); el.style.outline = '';
        if (el.innerText !== before) post({ t: 'edit', selector: selector(el), before: before.trim(), after: el.innerText.trim(), label: label(el) });
      }, { once: true });
    }
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && document.activeElement?.classList.contains('dz-editing')) { e.preventDefault(); document.activeElement.blur(); }
    if (e.key === 'Escape') { if (document.activeElement?.classList.contains('dz-editing')) document.activeElement.blur(); post({ t: 'escape' }); }
  }, true);
  // En modo comentar/editar no se envían formularios
  document.addEventListener('submit', (e) => { if (mode !== 'view') e.preventDefault(); }, true);

  // ---------- Marcadores de comentarios ----------
  let pins = [];
  function drawPins() {
    document.querySelectorAll('.dz-pin').forEach((p) => p.remove());
    for (const p of pins) {
      let el; try { el = document.querySelector(p.selector); } catch {}
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const d = document.createElement('div');
      d.className = 'dz-pin dz-ui'; d.textContent = p.n; d.title = p.text || '';
      d.style.cssText = `position:absolute;z-index:2147483645;left:${r.right + scrollX - 12}px;top:${r.top + scrollY - 12}px;width:24px;height:24px;border-radius:12px 12px 12px 2px;`
        + `background:${p.open ? ACCENT : '#555'};color:#fff;font:600 12px/24px system-ui,sans-serif;text-align:center;box-shadow:0 2px 6px #0006;cursor:pointer`;
      d.onclick = (e) => { e.stopPropagation(); post({ t: 'pin', id: p.id }); };
      document.body.appendChild(d);
    }
  }
  addEventListener('resize', () => { drawPins(); fit(); });

  // ---------- Ajustes ----------
  function tweakDefs() {
    try { return JSON.parse(document.getElementById('design-tweaks')?.textContent || '[]'); } catch { return []; }
  }

  // ---------- Diapositivas ----------
  const slides = [...document.querySelectorAll('section.slide')];
  let cur = 0;
  const style = document.createElement('style');
  if (slides.length && q.has('print')) {
    style.textContent = '@page{size:1920px 1080px;margin:0}html,body{margin:0!important;padding:0!important;background:#fff}section.slide{break-after:page;page-break-after:always;margin:0!important}aside.notes{display:none!important}';
  } else if (slides.length) {
    style.textContent = 'html,body{margin:0!important;padding:0!important;height:100%;overflow:hidden!important;background:#0b0b0e}'
      + 'section.slide{position:absolute!important;left:0;top:0;margin:0!important;transform-origin:0 0}section.slide:not(.dz-on){display:none!important}aside.notes{display:none!important}'
      + '.dz-nav{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;background:#000a;color:#fff;font:13px system-ui;opacity:0;transition:opacity .2s;z-index:2147483647}'
      + 'body:hover .dz-nav{opacity:1}.dz-nav button{all:unset;cursor:pointer;padding:4px 10px;border-radius:8px}.dz-nav button:hover{background:#fff2}';
  }
  document.head.appendChild(style);
  function fit() {
    if (!slides.length || q.has('print')) return;
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    const el = slides[cur];
    el.style.transform = `translate(${(innerWidth - 1920 * s) / 2}px, ${(innerHeight - 1080 * s) / 2}px) scale(${s})`;
  }
  function go(n) {
    if (!slides.length) return;
    cur = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach((s, i) => s.classList.toggle('dz-on', i === cur));
    fit(); drawPins();
    if (nav) nav.querySelector('span').textContent = `${cur + 1} / ${slides.length}`;
    post({ t: 'slides', count: slides.length, current: cur + 1 });
  }
  let nav = null;
  if (slides.length && !q.has('print')) {
    if (!embedded && !clean) {
      nav = document.createElement('div');
      nav.className = 'dz-nav dz-ui';
      nav.innerHTML = '<button data-a="-1">‹</button><span></span><button data-a="1">›</button><button data-a="f">⛶</button>';
      nav.onclick = (e) => { const a = e.target.dataset.a; if (a === 'f') document.documentElement.requestFullscreen?.(); else if (a) go(cur + Number(a)); };
      document.body.appendChild(nav);
    }
    addEventListener('keydown', (e) => {
      if (document.activeElement?.isContentEditable) return;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(cur + 1); }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(cur - 1); }
      if (e.key === 'Home') go(0);
      if (e.key === 'End') go(slides.length - 1);
    });
    go((Number(q.get('slide')) || 1) - 1);
  }

  // ---------- Mensajes de la app ----------
  let scrollT;
  addEventListener('scroll', () => { clearTimeout(scrollT); scrollT = setTimeout(() => post({ t: 'scroll', y: Math.round(scrollY) }), 120); }, { passive: true });
  addEventListener('message', (e) => {
    if (e.source !== window.parent || !e.data?.dz) return;
    const m = e.data;
    if (m.t === 'mode') { mode = m.mode; highlight(null); document.documentElement.style.cursor = mode === 'comment' ? 'crosshair' : ''; }
    if (m.t === 'tweak') document.documentElement.style.setProperty(m.var, m.value);
    if (m.t === 'tweaks') for (const [k, v] of Object.entries(m.values || {})) document.documentElement.style.setProperty(k, v);
    if (m.t === 'tweaks-clear') for (const k of m.vars || []) document.documentElement.style.removeProperty(k);
    if (m.t === 'slide') go(m.n - 1);
    if (m.t === 'pins') { pins = m.items || []; drawPins(); }
    if (m.t === 'scrollTo') scrollTo(0, m.y || 0);
  });
  window.__dz = { go };
  const ready = () => post({ t: 'ready', title: document.title, tweaks: tweakDefs(), slides: slides.length, current: cur + 1,
    defaults: Object.fromEntries(tweakDefs().map((d) => [d.var, getComputedStyle(document.documentElement).getPropertyValue(d.var).trim() || d.value])) });
  if (document.readyState === 'complete') ready(); else addEventListener('load', ready);
  setInterval(drawPins, 1500);
})();
