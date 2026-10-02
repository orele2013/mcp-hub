// Diseño: prototipos, presentaciones y diseños hechos por cualquier agente (Claude Code, Codex, OpenCode, Gemini, Cursor).
// Cada proyecto es una carpeta normal en ~/Designs/<slug> con git para las versiones; los datos de la app van en .design/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import JSZip from 'jszip';

export const ROOT = path.join(os.homedir(), 'Designs');
const TRASH = path.join(ROOT, '.papelera');
const CHROMIUM = ['/usr/bin/chromium', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));

export const TYPES = {
  blank: 'En blanco', prototype: 'Prototipo', mobile: 'App móvil', slides: 'Presentación', doc: 'Documento', wireframe: 'Wireframe',
  animation: 'Animación', mockups: 'Mockups de UI', resume: 'Currículum', model3d: 'Objeto 3D', research: 'Investigación', email: 'Email HTML',
  palette: 'Color + tipografía', system: 'Sistema de diseño',
};
const A4_TYPES = ['doc', 'resume', 'research'];
const ASSETS = path.join(path.dirname(new URL(import.meta.url).pathname), 'design-assets');
const SHOT_CMD = `node ${path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'bin', 'design-shot.mjs')}`;
// Formatos 3D: los de Three.js salen directamente de la escena; el resto se convierte con Blender a partir del GLB
export const FORMATS_3D = {
  glb: { label: 'GLB', mime: 'model/gltf-binary', via: 'three' },
  gltf: { label: 'glTF', mime: 'model/gltf+json', via: 'three' },
  stl: { label: 'STL', mime: 'model/stl', via: 'three' },
  ply: { label: 'PLY', mime: 'application/octet-stream', via: 'three' },
  usdz: { label: 'USDZ', mime: 'model/vnd.usdz+zip', via: 'three' },
  obj: { label: 'OBJ + MTL', mime: 'application/zip', via: 'blender' },
  fbx: { label: 'FBX', mime: 'application/octet-stream', via: 'blender' },
  blend: { label: 'BLEND', mime: 'application/x-blender', via: 'blender' },
  usd: { label: 'USD', mime: 'application/octet-stream', via: 'blender' },
  abc: { label: 'Alembic', mime: 'application/octet-stream', via: 'blender' },
};
const BLENDER = ['/usr/bin/blender', '/usr/local/bin/blender', '/opt/blender/blender', '/snap/bin/blender'].find((p) => fs.existsSync(p));
// Engancha Three.js para poder encontrar la escena (el renderer actualiza la escena en cada fotograma) en cualquier proyecto 3D (también en los que no usan stage.js)
const THREE_HOOK = `
;try{const __mcphubUMW=Object3D.prototype.updateMatrixWorld;Scene.prototype.updateMatrixWorld=function(f){const m=(globalThis.__mcphubScenes||(globalThis.__mcphubScenes=new Map()));m.set(this,(m.get(this)||0)+1);return __mcphubUMW.call(this,f);};}catch(e){}
`;
const AGENT_NAMES = { claude: 'Claude Code', codex: 'Codex', opencode: 'OpenCode', gemini: 'Gemini CLI', cursor: 'Cursor Agent' };

const git = (dir, args) => new Promise((resolve, reject) => execFile('git', args, { cwd: dir, maxBuffer: 64 * 1024 * 1024, encoding: 'buffer' },
  (e, out, err) => (e ? reject(new Error(String(err || e.message))) : resolve(out))));
const gitText = async (dir, args) => (await git(dir, args)).toString();
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(v, null, 2)); fs.renameSync(f + '.tmp', f); };
const slugify = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/^-+|-+$/g, '') || 'diseno';
const newId = () => crypto.randomBytes(4).toString('hex');

// ---------------- Instrucciones para el agente ----------------
function instructions(p) {
  const common = `# Proyecto de diseño: ${p.name}

Eres un diseñador de producto y desarrollador front-end de primer nivel trabajando en esta carpeta desde MCP Hub → Diseño.
El usuario ve el resultado en un lienzo en vivo y te habla en español.

## Reglas
- Trabaja SOLO dentro de esta carpeta. No arranques servidores ni abras navegadores: MCP Hub ya muestra \`index.html\`.
- El entregable es \`index.html\` (punto de entrada). Puedes crear más archivos (\`styles.css\`, \`app.js\`, otras páginas .html, \`assets/\`) y enlazarlos con rutas relativas.
- Se permiten Google Fonts y librerías desde CDN (cdn.jsdelivr.net, unpkg.com, cdnjs). Nada de pasos de compilación.
- Calidad de producto real: jerarquía visual clara, tipografía cuidada, espaciado consistente, buen contraste, estados hover/focus, responsive. Contenido realista (nada de "Lorem ipsum").
- Imágenes: usa las que te pasen en \`assets/\`, SVG propio, o fotos de https://images.unsplash.com con URLs reales que conozcas. No inventes rutas.
- No toques \`.design/\`, \`AGENTS.md\`, \`CLAUDE.md\` ni \`GEMINI.md\`.
- Al terminar responde con 1–3 frases en español: qué has hecho y qué podría mejorarse. Sin listas largas.

## Cómo trabajar (rápido y sin rodeos)
- Este archivo tiene TODO lo que necesitas. NO cargues ni sigas skills, guías o procesos externos (impeccable, frontend-design, etc.), no busques en otras carpetas y no crees archivos de proceso (PRODUCT.md, notas, planes). Diseña directamente.
- Primera versión: escribe los archivos de una vez, completos. Cambios posteriores: ediciones puntuales (apply_patch / Edit) sobre lo que haga falta; no reescribas el archivo entero ni lo vuelvas a leer completo para cambiar unas líneas.
- No ejecutes servidores, navegadores ni instalaciones (npm, pip…).
- Comprueba el resultado UNA vez al final viéndolo: ejecuta \`${SHOT_CMD}\` desde esta carpeta (guarda una captura en /tmp e imprime su ruta) y abre la imagen con tu herramienta para ver imágenes. Si algo se ve mal (vacío, cortado, roto, ilegible), corrígelo y vuelve a comprobar; si está bien, termina.

## Ajustes (panel "Ajustes" del usuario)
Expón entre 3 y 8 variables clave como propiedades CSS en \`:root\` (color principal, fondo, radio de bordes, tipografía, densidad…) úsalas de verdad en el CSS, y decláralas en \`index.html\` así:

\`\`\`html
<script type="application/json" id="design-tweaks">
[
  { "var": "--accent", "label": "Color principal", "type": "color", "value": "#6D5DFC" },
  { "var": "--radius", "label": "Redondeo", "type": "range", "min": 0, "max": 32, "step": 1, "unit": "px", "value": 12 },
  { "var": "--font", "label": "Tipografía", "type": "select", "options": ["'Inter', sans-serif", "'Fraunces', serif"], "value": "'Inter', sans-serif" }
]
</script>
\`\`\`
Tipos: \`color\`, \`range\` (con min/max/step/unit), \`select\` (options). Mantén esta lista al día si cambias el diseño.

## Mensajes del usuario
- \`[Comentario sobre <selector>]\` con un fragmento del HTML: cambia ESE elemento según el comentario.
- \`[Dibujo: ruta.png]\` o \`[Imagen: ruta]\`: abre y mira la imagen antes de empezar (es un boceto o una referencia).
- \`[Ajustes actuales]\`: valores que el usuario eligió en el panel; respétalos como nuevos valores por defecto.
`;
  const system = p.systemFiles ? `
## Sistema de diseño
Este proyecto usa el sistema de diseño "${p.systemName}". Lee \`DESIGN-SYSTEM.md\` antes de diseñar, enlaza \`tokens.css\` y usa sus variables, componentes y tono. No lo contradigas salvo que el usuario lo pida.
` : '';
  const code = p.codebase ? `
## Código de referencia
El usuario ha enlazado su código en \`${p.codebase}\`. Léelo antes de diseñar (estilos, componentes, textos, datos y rutas reales) y úsalo como base para que el diseño encaje con su producto. NO modifiques nada de esa carpeta.
` : '';
  const byType = {
    prototype: `
## Tipo: prototipo interactivo
Un prototipo navegable de alta fidelidad: varias pantallas o estados conectados (enlaces, pestañas, modales, formularios con validación) con JavaScript ligero (navegación por hash o estado). Todo clicable debe hacer algo razonable. Diseña para escritorio y que se adapte a móvil.`,
    slides: `
## Tipo: presentación
- Cada diapositiva es \`<section class="slide">\` de EXACTAMENTE 1920×1080 px (\`width:1920px;height:1080px;overflow:hidden;position:relative\`), una detrás de otra en el \`<body>\`.
- MCP Hub pone la navegación, el escalado y el modo pantalla completa: NO añadas controles ni JS de navegación.
- Tipografía grande (títulos 72–120 px, texto ≥ 32 px), una idea por diapositiva, gráficos en SVG/CSS, consistencia entre diapositivas.
- Notas del orador opcionales: \`<aside class="notes">…</aside>\` dentro de la diapositiva (no se muestran).`,
    doc: `
## Tipo: documento
Una página tipo one-pager / informe / documento imprimible, ancho de lectura cómodo, con buena maquetación para pantalla y \`@media print\` (A4).`,
    blank: `
## Tipo: libre
Haz lo que el usuario pida (página, componente, ilustración, email…).`,
    mobile: `
## Tipo: app móvil
Prototipo de app móvil navegable diseñado para 390×844 (iPhone). Pantallas completas con barra de estado simulada, navegación (tab bar / stack con botón atrás), gestos y transiciones suaves entre pantallas, estados vacíos y de carga. Respeta zonas seguras y tamaños táctiles (≥ 44 px). Puede haber varias pantallas conectadas por estado en JS.`,
    wireframe: `
## Tipo: wireframe
Wireframes de baja fidelidad: escala de grises, cajas y líneas, tipografía de sistema, marcadores de imagen (rectángulos con aspa), texto real pero breve. Muestra varias pantallas una al lado de otra sobre un lienzo claro, con títulos y anotaciones numeradas que explican decisiones de estructura y flujo (flechas entre pantallas si ayuda). Prioriza jerarquía y flujo, no estética.`,
    animation: `
## Tipo: animación
Una pieza animada (motion graphics) en un escenario de 1920×1080 escalado para encajar en la ventana, con fondo a sangre. Usa CSS/Web Animations o GSAP desde CDN. Debe reproducirse sola en bucle e incluir una barra discreta abajo con reproducir/pausa, reiniciar y una línea de tiempo que se pueda arrastrar. Cuida el ritmo (easing, solapes, pausas) y que cada fotograma se vea bien.`,
    mockups: `
## Tipo: mockups de UI
Mockups de alta fidelidad para explorar opciones: varias pantallas o variantes (A/B/C) colocadas en un lienzo amplio con fondo neutro, cada una con su título y una nota breve de qué la diferencia. Estáticas pero con detalle realista (datos, iconos, estados).`,
    resume: `
## Tipo: currículum
Un currículum en formato A4 (210×297 mm), una o dos páginas, maquetación profesional y legible, jerarquía clara (nombre, titular, contacto, experiencia, formación, habilidades, idiomas), con \`@page { size: A4; margin: 0 }\` y \`@media print\` cuidados. Si el usuario adjunta un CV o LinkedIn, usa sus datos reales; si no, pide o usa datos de ejemplo verosímiles.`,
    model3d: `
## Tipo: objeto 3D
Una escena 3D interactiva con Three.js (r170) donde el protagonista es el objeto. Calidad de foto de producto.

### Base ya hecha: \`stage.js\` (úsala, no la reescribas)
En esta carpeta tienes \`stage.js\`: render, luz de estudio, entorno de reflejos, sombra de contacto, controles con auto-giro, encuadre automático, tamaño de ventana y panel Ajustes. Tú SOLO modelas el objeto. Esqueleto de \`index.html\`:

\`\`\`html
<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>…</title>
<style>:root { --bg: #efe9e1; --accent: #c9a24a; } html,body{margin:0;height:100%;background:var(--bg)}</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script>
<script type="application/json" id="design-tweaks">[{"var":"--bg","label":"Fondo","type":"color","value":"#efe9e1"},{"var":"--accent","label":"Color del objeto","type":"color","value":"#c9a24a"}]</script>
</head><body>
<script type="module">
import * as THREE from 'three';
import { createStage, materials, lathe, extrude, roundedBox, labelTexture } from './stage.js';
const stage = createStage({ background: 'var(--bg)' });
const model = new THREE.Group();
// … piezas del objeto, añadidas a model …
stage.add(model);                       // lo apoya en el suelo, lo centra y encuadra
stage.onTweak(() => { /* p. ej. cuerpo.material.color = stage.color('--accent') */ });
</script></body></html>
\`\`\`
API: \`createStage({ background, autoRotate, view, shadow, exposure })\` → \`{ scene, camera, renderer, controls, root, add(obj), frame(), onFrame((dt, t) => …), onTweak(fn), color('--var'), setView('front'|'side'|'top') }\`.
Materiales: \`materials.plastic(color, rough)\`, \`matte\`, \`metal(color, rough)\`, \`gold()\`, \`chrome()\`, \`glass(tinte)\`, \`liquid(color)\`, \`lacquer(color)\`, \`fabric(color)\`, \`wood(color)\`, \`emissive(color)\`. Colores como '#hex' o 'var(--x)'.
Geometría: \`lathe([[radio, altura], …])\` (objetos de revolución), \`extrude([[x, y], …], fondo, bisel)\` (siluetas, logos), \`roundedBox(an, al, fo, radio)\` (cajas con cantos suaves), \`labelTexture({ text, sub, fg, bg, font })\` (etiquetas y marcas como textura).

### Cómo modelar bien
1. Piensa primero en piezas: descompón el objeto en 3–12 partes reales (cuerpo, tapa, cuello, asa, base, etiqueta…) y anota sus medidas en unidades coherentes (1 unidad ≈ 10 cm). Las proporciones correctas importan más que el detalle.
2. Elige la técnica por pieza:
   - Revolución (botellas, frascos, vasos, lámparas, jarrones, tapones, pomos): \`lathe\` con un perfil de 8–20 puntos, de abajo arriba, con un pequeño redondeo en los cantos.
   - Formas fabricadas (móviles, cajas, muebles, aparatos): \`roundedBox\` y grupos de piezas; nada de cubos con aristas vivas.
   - Siluetas planas con grosor (logos, llaves, piezas recortadas): \`extrude\`.
   - Estilo vóxel o Minecraft: muchos cubos con \`InstancedMesh\` (un solo material, colores por instancia) en una rejilla; no miles de mallas sueltas.
   - Orgánico (frutas, personajes): esferas y cápsulas deformadas, agrupadas; mantenlo estilizado antes que fallido.
3. Materiales: el realismo sale de rugosidad y metalicidad bien elegidas, no de colores. Cristal = \`materials.glass\` (lo que haya dentro, con un material opaco como \`liquid\`, ligeramente más pequeño que el cristal); metal pulido roughness 0.1–0.25; plástico 0.35–0.6. Texto y logos: \`labelTexture\` sobre un plano pegado a la superficie (o un \`lathe\` más fino para etiquetas curvas).
4. Si el usuario adjunta una foto, reproduce SU objeto: silueta, proporciones, colores y textos que se vean.
5. Interfaz mínima: el objeto llena la pantalla; como mucho el nombre y 1–3 controles (girar, variantes de color). No hagas una web alrededor salvo que lo pidan.
6. Expón en Ajustes el fondo y 1–3 colores o acabados del objeto.

### Comprobación obligatoria
Al terminar ejecuta \`${SHOT_CMD} --angles\` y mira las 4 imágenes (inicial, frente, lado, arriba). Comprueba: el objeto se ve entero y centrado, las proporciones son creíbles desde los tres lados, no hay piezas flotando ni atravesadas, los materiales se distinguen y no hay errores. Corrige lo que falle (máximo dos rondas).
Si \`stage.js\` no existe en la carpeta (proyecto antiguo), mantén la escena que haya y exponla con \`window.stage = { root: tuGrupo }\` para que se pueda exportar.`,
    research: `
## Tipo: investigación
Un informe de investigación o explicativo: investiga de verdad (busca y descarga fuentes con curl o tu herramienta web), contrasta datos y CITA las fuentes con enlaces. Maquetación editorial: resumen ejecutivo, secciones con titulares claros, cifras destacadas, gráficos en SVG/HTML con los datos encontrados, tablas comparativas y una lista de fuentes al final. Apto para leer en pantalla y para imprimir en A4.`,
    email: `
## Tipo: email HTML
Un email HTML compatible con los clientes de correo (Gmail, Outlook, Apple Mail): ancho 600 px, maquetado con tablas, estilos EN LÍNEA (además de un <style> mínimo para móvil), imágenes con ancho/alto y alt, botones "a prueba de balas", texto de previsualización oculto, sin JavaScript ni fuentes externas obligatorias (usa pilas de fuentes seguras). Centrado sobre un fondo gris claro.`,
    palette: `
## Tipo: color + tipografía
Una exploración de identidad: 3–4 propuestas de paleta (con nombre, hex, función de cada color y ratio de contraste WCAG de los pares texto/fondo) combinadas con parejas tipográficas de Google Fonts (titular + texto, con muestras de tamaños). Aplica cada combinación a una mini maqueta (tarjeta, botón, cabecera) para verla en uso. Expón en Ajustes las variables de la propuesta favorita.`,
    system: `
## Tipo: sistema de diseño
Tu trabajo es definir un sistema de diseño reutilizable. Entregables:
1. \`DESIGN.md\`: principios, tono de voz, paleta (con usos), tipografía (familias, escala), espaciado, radios, sombras, iconografía, componentes (botones, campos, tarjetas, navegación, tablas, alertas…) con reglas de uso y ejemplos de HTML. Debe bastar para que otro agente diseñe coherentemente sin ver nada más.
2. \`tokens.css\`: todas las variables CSS en \`:root\` (y modo oscuro si procede) + clases base de componentes.
3. \`index.html\`: página de muestra que enlaza \`tokens.css\` y enseña todo el sistema (paleta, tipografía, componentes y estados).`,
  };
  return common + system + code + (byType[p.type] || byType.blank) + '\n';
}

const PLACEHOLDER = (p) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${p.name.replace(/</g, '')}</title><style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#0d0e12;color:#8b909c;font:15px system-ui,sans-serif}
.b{display:flex;flex-direction:column;align-items:center;gap:14px}.s{width:34px;height:34px;border:3px solid #2a2d38;border-top-color:#8b7cff;border-radius:50%;animation:r 1s linear infinite}@keyframes r{to{transform:rotate(1turn)}}</style></head>
<body><div class="b"><div class="s"></div><div>El agente está diseñando…</div></div></body></html>
`;

// ---------------- Ejecución de agentes ----------------
function agentCommand(agent, { prompt, dir, model, sid, images, isNew, effort }) {
  const m = (flag) => (model ? [flag, model] : []);
  switch (agent) {
    case 'claude':
      return ['claude', ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions', ...m('--model'), ...(sid ? ['--resume', sid] : [])]];
    case 'codex': {
      // Los nombres de modelo de OpenAI van en minúsculas: «GPT-6-luna» da 404
      const cm = model ? ['-m', String(model).trim().toLowerCase()] : [];
      // Esfuerzo de razonamiento solo para Diseño (si no, el de ~/.codex/config.toml)
      const ef = effort ? ['-c', `model_reasoning_effort="${effort}"`] : [];
      const flags = ['--json', '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check', ...cm, ...ef, ...images.map((i) => `--image=${i}`)];
      return ['codex', sid ? ['exec', 'resume', ...flags, '--', sid, prompt] : ['exec', ...flags, '-C', dir, '--', prompt]];
    }
    case 'opencode':
      return ['opencode', ['run', '--format', 'json', ...m('-m'), ...(sid ? ['--session', sid] : []), ...images.flatMap((i) => ['-f', i]), '--', prompt],
        { OPENCODE_CONFIG_CONTENT: JSON.stringify({ permission: { edit: 'allow', bash: 'allow', webfetch: 'allow' } }) }];
    case 'gemini':
      return ['gemini', ['-p', prompt, '--yolo', '--skip-trust', '--output-format', 'stream-json', ...m('-m'), ...(sid && !isNew ? ['--resume', 'latest'] : ['--session-id', sid])]];
    case 'cursor':
      return ['cursor-agent', ['-p', prompt, '--force', '--trust', '--output-format', 'stream-json', ...m('--model'), ...(sid ? ['--resume', sid] : [])]];
  }
  throw new Error(`Agente desconocido: ${agent}`);
}

// Convierte una línea de salida JSON de cualquier agente en eventos comunes
function parseEvent(ev, acc) {
  const out = [];
  const sid = ev.session_id || ev.thread_id || ev.sessionID || ev.part?.sessionID;
  if (sid && typeof sid === 'string') acc.sid = sid;
  const tool = (name, detail) => out.push({ kind: 'tool', text: `${name}${detail ? ' ' + String(detail).replace(/\s+/g, ' ').slice(0, 160) : ''}` });
  const text = (t) => { if (t && String(t).trim()) { acc.texts.push(String(t).trim()); out.push({ kind: 'text', text: String(t).trim() }); } };
  // Claude Code / Cursor
  if (ev.type === 'assistant' && ev.message?.content) {
    for (const b of ev.message.content) {
      if (b.type === 'text') text(b.text);
      else if (b.type === 'tool_use') { const i = b.input || {}; tool(b.name, i.file_path || i.command || i.pattern || i.url || i.description); }
    }
  } else if (ev.type === 'tool_call' && ev.subtype === 'started') {
    const k = Object.keys(ev.tool_call || {})[0] || 'herramienta';
    const a = ev.tool_call?.[k]?.args || {};
    tool(k.replace(/ToolCall$/, ''), a.path || a.command || a.pattern);
  } else if (ev.type === 'result') {
    if (typeof ev.result === 'string') acc.result = ev.result;
    if (ev.is_error) acc.error = ev.result || ev.error || 'Error';
  // Codex
  } else if (ev.type === 'item.completed' && ev.item) {
    const it = ev.item;
    if (it.type === 'agent_message') text(it.text);
    else if (it.type === 'command_execution') tool('$', it.command?.replace(/^\/usr\/bin\/bash -lc /, ''));
    else if (it.type === 'file_change') tool('✎', (it.changes || []).map((c) => path.basename(c.path)).join(', '));
    else if (it.type === 'web_search') tool('🔎', it.query);
    else if (it.type === 'error') acc.error = it.message;
  } else if (ev.type === 'error' || ev.type === 'turn.failed') {
    acc.error = ev.message || ev.error?.message || 'Error';
  // Gemini
  } else if (ev.type === 'message' && ev.role === 'assistant') {
    acc.delta = (acc.delta || '') + (ev.content || '');
    if (!ev.delta) { text(acc.delta); acc.delta = ''; }
  } else if (ev.type === 'tool_use') {
    tool(ev.tool_name || ev.part?.tool || 'herramienta', ev.parameters?.file_path || ev.parameters?.command || ev.part?.state?.input?.filePath);
  // OpenCode
  } else if (ev.type === 'text' && ev.part?.text) {
    text(ev.part.text);
  }
  return out;
}

// ---------------- Gestor ----------------
export class Designer {
  // hooks: { env() -> env de los hijos, emit(msg), notify(text), installed(agent) -> bool }
  constructor(hooks) {
    this.hooks = hooks;
    this.runs = new Map();
    this.idleWaiters = new Map();
    this.browser = null; this.browserTimer = null;
    fs.mkdirSync(ROOT, { recursive: true });
  }
  dir(slug) {
    if (!/^[a-z0-9-]{1,48}$/.test(slug || '')) throw new Error('Proyecto no válido');
    const d = path.join(ROOT, slug);
    if (!fs.existsSync(path.join(d, '.design', 'project.json'))) throw new Error('No existe el proyecto');
    return d;
  }
  meta(slug) { return readJson(path.join(this.dir(slug), '.design', 'project.json'), null); }
  saveMeta(slug, m) { m.updated = Date.now(); writeJson(path.join(this.dir(slug), '.design', 'project.json'), m); this.hooks.emit({ t: 'design', slug, ev: { kind: 'meta' } }); }
  chat(slug) { return readJson(path.join(this.dir(slug), '.design', 'chat.json'), []); }
  saveChat(slug, c) { writeJson(path.join(this.dir(slug), '.design', 'chat.json'), c.slice(-400)); }

  list() {
    return fs.readdirSync(ROOT, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => { const m = readJson(path.join(ROOT, e.name, '.design', 'project.json'), null); return m && { ...m, slug: e.name, running: this.runs.has(e.name) }; })
      .filter(Boolean).sort((a, b) => b.updated - a.updated);
  }
  get(slug, { view = false } = {}) {
    const m = this.meta(slug);
    if (view) { m.viewed = Date.now(); writeJson(path.join(this.dir(slug), '.design', 'project.json'), m); }
    return { ...m, slug, running: this.runs.has(slug), chat: this.chat(slug), runLog: this.runs.get(slug)?.log || [] };
  }

  async create({ name, type, agent, model, system, prompt, source, codebase }) {
    if (!TYPES[type]) throw new Error('Tipo no válido');
    if (!AGENT_NAMES[agent]) throw new Error('Agente no válido');
    if (!this.hooks.installed(agent)) throw new Error(`${AGENT_NAMES[agent]} no está instalado`);
    name = String(name || '').trim() || 'Diseño sin título';
    let slug = slugify(name), n = 2;
    while (fs.existsSync(path.join(ROOT, slug))) slug = `${slugify(name).slice(0, 36)}-${n++}`;
    const d = path.join(ROOT, slug);
    fs.mkdirSync(path.join(d, '.design'), { recursive: true });
    fs.mkdirSync(path.join(d, 'assets'), { recursive: true });
    const cb = codebase ? path.resolve(String(codebase).replace(/^~(?=$|\/)/, os.homedir())) : null;
    if (cb && !fs.existsSync(cb)) throw new Error(`No existe la carpeta de código: ${codebase}`);
    const m = { name, type, agent, model: model || '', created: Date.now(), updated: Date.now(), viewed: Date.now(), sessions: {}, tweaks: {}, comments: [],
      source: source || null, codebase: cb, starred: false, template: false };
    if (system) {
      const sd = this.dir(system), sm = this.meta(system);
      if (sm.type !== 'system') throw new Error('Eso no es un sistema de diseño');
      for (const [from, to] of [['DESIGN.md', 'DESIGN-SYSTEM.md'], ['tokens.css', 'tokens.css']]) {
        if (fs.existsSync(path.join(sd, from))) fs.copyFileSync(path.join(sd, from), path.join(d, to));
      }
      Object.assign(m, { system, systemName: sm.name, systemFiles: true });
    }
    writeJson(path.join(d, '.design', 'project.json'), m);
    this.writeInstructions(d, m);
    fs.writeFileSync(path.join(d, 'index.html'), PLACEHOLDER(m));
    if (type === 'model3d') fs.copyFileSync(path.join(ASSETS, 'stage.js'), path.join(d, 'stage.js'));
    fs.writeFileSync(path.join(d, '.gitignore'), '.design/\n');
    await git(d, ['init', '-q']);
    await git(d, ['add', '-A']);
    await git(d, ['-c', 'user.name=MCP Hub', '-c', 'user.email=mcp-hub@localhost', 'commit', '-qm', 'Inicio']);
    let first = String(prompt || '').trim();
    if (type === 'system') first = this.systemPrompt(source, first);
    if (first) this.run(slug, { text: first, display: String(prompt || '').trim() || first }).catch(() => {});
    return { slug };
  }
  writeInstructions(d, m) {
    const txt = instructions(m);
    for (const f of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']) fs.writeFileSync(path.join(d, f), txt);
  }
  systemPrompt(source = {}, notes) {
    const parts = ['Crea el sistema de diseño de este proyecto siguiendo AGENTS.md (DESIGN.md, tokens.css e index.html de muestra).'];
    if (source.folder) parts.push(`Extráelo del código existente en ${source.folder}: estudia su CSS, componentes, configuración de Tailwind/tema, fuentes, colores y patrones de UI reales. Documenta lo que hay, no lo inventes.`);
    if (source.url) parts.push(`Extráelo de la web ${source.url}: descárgala (curl) y analiza su CSS, colores, tipografías y componentes.`);
    if (notes) parts.push(`Indicaciones del usuario: ${notes}`);
    return parts.join('\n\n');
  }

  update(slug, patch) {
    const m = this.meta(slug);
    for (const k of ['name', 'agent', 'model']) if (patch[k] !== undefined) m[k] = String(patch[k]).trim();
    for (const k of ['starred', 'template']) if (patch[k] !== undefined) m[k] = !!patch[k];
    if (patch.agent && !AGENT_NAMES[patch.agent]) throw new Error('Agente no válido');
    if (patch.effort !== undefined) { if (patch.effort && !['low', 'medium', 'high', 'xhigh'].includes(patch.effort)) throw new Error('Esfuerzo no válido'); m.effort = patch.effort || ''; }
    if (patch.tweaks) m.tweaks = Object.fromEntries(Object.entries(patch.tweaks).filter(([k]) => /^--[\w-]+$/.test(k)).map(([k, v]) => [k, String(v).slice(0, 200)]));
    if (patch.name) this.writeInstructions(this.dir(slug), m);
    this.saveMeta(slug, m);
    return this.get(slug);
  }
  remove(slug) {
    const d = this.dir(slug);
    if (this.runs.has(slug)) throw new Error('Espera a que termine el agente');
    fs.mkdirSync(TRASH, { recursive: true });
    fs.renameSync(d, path.join(TRASH, `${slug}-${Date.now()}`));
  }
  async duplicate(slug, { name, template = false } = {}) {
    const d = this.dir(slug), m = this.meta(slug);
    name = String(name || '').trim() || (template ? m.name : `${m.name} (copia)`);
    let s = slugify(name), n = 2;
    while (fs.existsSync(path.join(ROOT, s))) s = `${slugify(name).slice(0, 36)}-${n++}`;
    fs.cpSync(d, path.join(ROOT, s), { recursive: true });
    const nm = { ...m, name, created: Date.now(), updated: Date.now(), viewed: Date.now(), sessions: {}, template: !!template, starred: false, comments: [] };
    writeJson(path.join(ROOT, s, '.design', 'project.json'), nm);
    fs.rmSync(path.join(ROOT, s, '.design', 'chat.json'), { force: true });
    this.writeInstructions(path.join(ROOT, s), nm);
    return { slug: s };
  }

  // ---- Comentarios ----
  addComment(slug, c) {
    const m = this.meta(slug);
    const item = { id: newId(), selector: String(c.selector || '').slice(0, 400), html: String(c.html || '').slice(0, 800), label: String(c.label || '').slice(0, 80),
      text: String(c.text || '').trim().slice(0, 4000), at: Date.now(), status: 'open' };
    if (!item.text) throw new Error('El comentario está vacío');
    m.comments.push(item);
    this.saveMeta(slug, m);
    return item;
  }
  setComment(slug, id, patch) {
    const m = this.meta(slug);
    const c = m.comments.find((x) => x.id === id);
    if (!c) throw new Error('No existe el comentario');
    if (patch.delete) m.comments = m.comments.filter((x) => x.id !== id);
    else Object.assign(c, { status: patch.status ?? c.status, text: patch.text ?? c.text });
    this.saveMeta(slug, m);
  }

  // ---- Adjuntos ----
  attach(slug, { name, data, kind }) {
    const d = this.dir(slug);
    const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(data || ''));
    if (!m) throw new Error('Archivo no válido');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 20 * 1024 * 1024) throw new Error('Máximo 20 MB');
    const ext = ({ 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'application/pdf': '.pdf' })[m[1]]
      || path.extname(String(name || '')).slice(0, 8) || '.bin';
    const base = kind === 'sketch' ? `dibujo-${Date.now()}` : slugify(path.basename(String(name || 'imagen'), path.extname(String(name || '')))) || 'imagen';
    let rel = path.join('assets', base + ext), n = 2;
    while (fs.existsSync(path.join(d, rel))) rel = path.join('assets', `${base}-${n++}${ext}`);
    fs.writeFileSync(path.join(d, rel), buf);
    return { path: rel };
  }

  // ---- Edición directa de textos ----
  applyEdits(slug, edits) {
    const d = this.dir(slug);
    const pending = [];
    const files = fs.readdirSync(d).filter((f) => /\.(html?|js)$/.test(f));
    const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let applied = 0;
    for (const e of edits || []) {
      const before = String(e.before || '').trim(), after = String(e.after || '').trim();
      if (!before || before === after) continue;
      let done = false;
      for (const f of files) {
        const src = fs.readFileSync(path.join(d, f), 'utf8');
        for (const needle of [before, escHtml(before)]) {
          if (src.split(needle).length === 2) { fs.writeFileSync(path.join(d, f), src.replace(needle, f.endsWith('.js') ? after : escHtml(after))); done = true; break; }
        }
        if (done) break;
      }
      if (done) applied++; else pending.push(e);
    }
    return { applied, pending };
  }

  // ---- Turnos del agente ----
  async run(slug, { text, display, comments = [], images = [], tweaks = false, edits = [] }) {
    const d = this.dir(slug), m = this.meta(slug);
    if (this.runs.has(slug)) throw new Error('El agente ya está trabajando en este proyecto');
    if (!this.hooks.installed(m.agent)) throw new Error(`${AGENT_NAMES[m.agent]} no está instalado`);
    const chat = this.chat(slug);

    // Mensaje del usuario
    const parts = [String(text || '').trim()];
    const cs = m.comments.filter((c) => comments.includes(c.id));
    if (cs.length) parts.push('Comentarios sobre elementos del diseño:\n' + cs.map((c, i) => `${i + 1}. [Comentario sobre ${c.selector}]${c.html ? `\n   Fragmento: ${c.html.replace(/\s+/g, ' ').slice(0, 400)}` : ''}\n   → ${c.text}`).join('\n'));
    for (const e of edits) parts.push(`Cambia el texto "${e.before}" por "${e.after}" (en ${e.selector}).`);
    if (images.length) parts.push(images.map((i) => (/dibujo-/.test(i) ? `[Dibujo: ${i}] Boceto del usuario sobre una captura del diseño actual: míralo y aplícalo.` : `[Imagen: ${i}]`)).join('\n'));
    if (tweaks && Object.keys(m.tweaks || {}).length) parts.push(`[Ajustes actuales] ${Object.entries(m.tweaks).map(([k, v]) => `${k}: ${v}`).join('; ')}. Hazlos los valores por defecto en el CSS y en design-tweaks.`);
    let prompt = parts.filter(Boolean).join('\n\n');
    this.writeInstructions(d, m); // siempre con la guía al día (también en proyectos antiguos)
    if (!prompt) throw new Error('Escribe qué quieres');

    const sid = m.sessions[m.agent];
    const isNew = m.agent === 'gemini' && !sid;
    const useSid = m.agent === 'gemini' && !sid ? crypto.randomUUID() : sid;
    if (!sid && chat.length) {
      const hist = chat.slice(-8).map((c) => `${c.role === 'user' ? 'Usuario' : 'Agente'}: ${String(c.text || '').slice(0, 600)}`).join('\n');
      prompt = `(Continúas un proyecto empezado con otro agente. Conversación reciente:\n${hist}\n)\n\n${prompt}`;
    }
    prompt = `Sigue las instrucciones de AGENTS.md de esta carpeta.\n\n${prompt}`;

    const userMsg = { id: newId(), role: 'user', text: display || text || (cs.length ? `${cs.length} comentario${cs.length > 1 ? 's' : ''}` : ''), comments: cs.map((c) => ({ label: c.label, text: c.text })),
      images, at: Date.now() };
    const agentMsg = { id: newId(), role: 'agent', agent: m.agent, model: m.model, text: '', steps: [], at: Date.now(), status: 'running' };
    chat.push(userMsg, agentMsg);
    this.saveChat(slug, chat);
    for (const c of cs) c.status = 'sent';
    if (cs.length) this.saveMeta(slug, m);

    // Codex en Diseño: esfuerzo medio por defecto (medido: ~30 % más rápido que el máximo con calidad parecida); '' = el de config.toml
    const [bin, args, extraEnv] = agentCommand(m.agent, { prompt, dir: d, model: m.model, sid: useSid, images, isNew, effort: m.effort ?? 'medium' });
    const child = spawn(bin, args, { cwd: d, env: { ...this.hooks.env(), ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
    const run = { child, log: [], started: Date.now(), cancelled: false };
    this.runs.set(slug, run);
    const emit = (ev) => { run.log.push(ev); if (run.log.length > 400) run.log.shift(); this.hooks.emit({ t: 'design', slug, ev }); };
    emit({ kind: 'start', agent: m.agent });

    const acc = { texts: [], sid: null, result: null, error: null };
    let buf = '', plain = '', errText = '';
    child.stdout.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        let ev; try { ev = JSON.parse(line); } catch { if (line.trim()) plain += line + '\n'; continue; }
        for (const e of parseEvent(ev, acc)) { if (e.kind === 'tool') agentMsg.steps.push(e.text); emit(e); }
      }
    });
    child.stderr.on('data', (c) => { errText = (errText + c).slice(-8000); });

    const code = await new Promise((resolve) => { child.on('close', resolve); child.on('error', (e) => { errText += e.message; resolve(127); }); });
    this.runs.delete(slug);
    for (const w of this.idleWaiters.get(slug) || []) setTimeout(w, 50);
    this.idleWaiters.delete(slug);
    const clean = (t) => t.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').trim();
    const finalText = acc.result || acc.texts.at(-1) || clean(plain).slice(-3000);
    const failed = run.cancelled || code !== 0 || !!acc.error;

    // Si la sesión guardada ya no sirve, se olvida para que el siguiente turno empiece de cero con el historial
    if (failed && sid && !run.cancelled && /session|thread|conversation|not found|no such|resume/i.test(errText + (acc.error || ''))) delete m.sessions[m.agent];
    else if (acc.sid || useSid) m.sessions[m.agent] = acc.sid || useSid;

    let version = null;
    try {
      await git(d, ['add', '-A']);
      const changed = (await gitText(d, ['status', '--porcelain'])).trim();
      if (changed) {
        const n = Number((await gitText(d, ['rev-list', '--count', 'HEAD'])).trim());
        const label = String(display || text || (cs[0] ? `Comentario: ${cs[0].text}` : edits.length ? 'Cambios de texto' : 'Cambios')).replace(/\s+/g, ' ').slice(0, 70);
        await git(d, ['-c', 'user.name=MCP Hub', '-c', 'user.email=mcp-hub@localhost', 'commit', '-qm', `v${n}: ${label}`]);
        version = { n, sha: (await gitText(d, ['rev-parse', '--short', 'HEAD'])).trim() };
      }
    } catch {}

    const c2 = this.chat(slug);
    const msg = c2.find((x) => x.id === agentMsg.id);
    Object.assign(msg, { text: run.cancelled ? 'Cancelado.' : failed ? (acc.error || clean(errText).slice(-1500) || finalText || `El agente terminó con código ${code}`) : finalText || 'Hecho.',
      steps: agentMsg.steps.slice(-80), status: run.cancelled ? 'cancelled' : failed ? 'error' : 'done', version, ms: Date.now() - run.started });
    this.saveChat(slug, c2);
    this.saveMeta(slug, m);
    emit({ kind: 'end', status: msg.status });
    if (version) this.thumbnail(slug).catch(() => {});
    if (Date.now() - run.started > 120_000) this.hooks.notify?.('design', `🎨 ${m.name}: ${msg.status === 'done' ? 'listo' : 'el agente falló'}${version ? ` (v${version.n})` : ''}. ${String(msg.text).slice(0, 300)}`);
    return msg;
  }
  // Espera a que el agente termine el turno en curso (máx. `seconds`); devuelve true si está libre
  waitIdle(slug, seconds = 50) {
    if (!this.runs.has(slug)) return Promise.resolve(true);
    return new Promise((resolve) => {
      const done = () => { clearTimeout(t); resolve(true); };
      const t = setTimeout(() => { this.idleWaiters.set(slug, (this.idleWaiters.get(slug) || []).filter((x) => x !== done)); resolve(false); }, Math.min(Math.max(seconds, 1), 55) * 1000);
      this.idleWaiters.set(slug, [...(this.idleWaiters.get(slug) || []), done]);
    });
  }
  cancel(slug) {
    const r = this.runs.get(slug);
    if (!r) return;
    r.cancelled = true;
    r.child.kill('SIGTERM');
    setTimeout(() => { try { r.child.kill('SIGKILL'); } catch {} }, 3000);
  }

  // ---- Versiones ----
  async versions(slug) {
    const d = this.dir(slug);
    const out = await gitText(d, ['log', '--format=%h%x09%ct%x09%s', '-n', '200']);
    return out.trim().split('\n').filter(Boolean).map((l) => { const [sha, t, ...s] = l.split('\t'); return { sha, at: Number(t) * 1000, message: s.join('\t') }; });
  }
  async restore(slug, sha) {
    const d = this.dir(slug);
    if (!/^[0-9a-f]{4,40}$/.test(sha)) throw new Error('Versión no válida');
    if (this.runs.has(slug)) throw new Error('Espera a que termine el agente');
    await git(d, ['restore', '--source', sha, '--staged', '--worktree', '--', '.']);
    await git(d, ['add', '-A']);
    if ((await gitText(d, ['status', '--porcelain'])).trim()) {
      await git(d, ['-c', 'user.name=MCP Hub', '-c', 'user.email=mcp-hub@localhost', 'commit', '-qm', `Restaurada la versión ${sha}`]);
    }
    this.thumbnail(slug).catch(() => {});
    this.saveMeta(slug, this.meta(slug));
  }

  // ---- Archivos (para el lienzo) ----
  async file(slug, rel, sha) {
    const d = this.dir(slug);
    const clean = path.normalize(decodeURIComponent(rel || 'index.html')).replace(/^(\.\.(\/|$))+/, '');
    if (clean.startsWith('.git') || clean.startsWith('.design') || path.isAbsolute(clean)) throw new Error('No permitido');
    if (sha) {
      if (!/^[0-9a-f]{4,40}$/.test(sha)) throw new Error('Versión no válida');
      return git(d, ['show', `${sha}:${clean}`]);
    }
    const f = path.join(d, clean);
    if (!f.startsWith(d + path.sep)) throw new Error('No permitido');
    return fs.promises.readFile(f);
  }
  tweakStyle(slug) {
    const t = this.meta(slug).tweaks || {};
    const body = Object.entries(t).map(([k, v]) => `${k}:${String(v).replace(/[;{}<]/g, '')}`).join(';');
    return body ? `<style id="__dz-tweaks">html:root{${body}}</style>` : '';
  }

  // ---- Navegador sin cabeza: capturas, PDF, miniaturas ----
  async page(url, { width = 1440, height = 900, scale = 1 } = {}) {
    if (!CHROMIUM) throw new Error('No encuentro Chromium para hacer capturas');
    if (!this.browser) {
      const puppeteer = (await import('puppeteer-core')).default;
      this.browser = await puppeteer.launch({ executablePath: CHROMIUM, headless: true, args: ['--password-store=basic', '--hide-scrollbars', '--disable-gpu'] });
    }
    clearTimeout(this.browserTimer);
    this.browserTimer = setTimeout(() => { this.browser?.close().catch(() => {}); this.browser = null; }, 120_000);
    const p = await this.browser.newPage();
    await p.setViewport({ width, height, deviceScaleFactor: scale });
    // Three.js: se le añade un gancho para poder localizar la escena (capturas con vista fija y exportación 3D)
    await p.setRequestInterception(true);
    p.on('request', async (req) => {
      const u = req.url();
      if (!/\/build\/three\.module(\.min)?\.js(\?|$)/.test(u)) return req.continue().catch(() => {});
      try {
        const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
        const code = await r.text();
        await req.respond({ status: 200, contentType: 'text/javascript; charset=utf-8', headers: { 'access-control-allow-origin': '*' }, body: code + THREE_HOOK });
      } catch { req.continue().catch(() => {}); }
    });
    await p.goto(url, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await p.waitForNetworkIdle({ idleTime: 500, timeout: 6000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 400));
    return p;
  }
  async screenshot(url, { width, height, scroll = 0, full = false, scale = 1, jpeg = false, view = null }) {
    const p = await this.page(url, { width, height, scale });
    try {
      // Escenas 3D: espera al primer fotograma (y a que carguen modelos/texturas)
      const is3d = await p.evaluate(() => !!document.querySelector('canvas')).catch(() => false);
      if (is3d) {
        await p.waitForFunction(() => window.__stageReady || (globalThis.__mcphubScenes?.size), { timeout: 8000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 1200));
        if (view) { await p.evaluate((v) => { window.stage?.setView?.(v); }, view).catch(() => {}); await new Promise((r) => setTimeout(r, 400)); }
      }
      if (scroll) await p.evaluate((y) => window.scrollTo(0, y), scroll);
      return Buffer.from(await p.screenshot(jpeg ? { type: 'jpeg', quality: 80, fullPage: full } : { type: 'png', fullPage: full }));
    } finally { await p.close(); }
  }
  async slideCount(url) {
    const p = await this.page(url, { width: 1920, height: 1080 });
    try { return await p.evaluate(() => document.querySelectorAll('section.slide').length); } finally { await p.close(); }
  }
  async thumbnail(slug) {
    const m = this.meta(slug);
    const url = this.hooks.fileUrl(slug, 'index.html', { slide: m.type === 'slides' ? 1 : null, clean: true });
    const png = m.type === 'slides'
      ? await this.screenshot(url, { width: 1920, height: 1080, scale: 0.3 })
      : await this.screenshot(url, { width: 1440, height: 900, scale: 0.4 });
    fs.writeFileSync(path.join(this.dir(slug), '.design', 'thumb.png'), png);
    this.hooks.emit({ t: 'design', slug, ev: { kind: 'thumb' } });
  }

  // ---- Vídeo de demostración: graba un recorrido automático (diapositivas, o scroll + clics en la navegación) ----
  async video(slug, { format = 'mp4', width = 1280, height = 800 } = {}) {
    if (!['mp4', 'gif', 'webm'].includes(format)) throw new Error('Formato de vídeo no válido');
    const m = this.meta(slug);
    if (!m) throw new Error('No existe ese proyecto');
    const slides = m.type === 'slides';
    const mobile = m.type === 'mobile';
    const [w, h] = slides ? [1280, 720] : mobile ? [390, 844] : [Math.max(320, Math.min(Number(width) || 1280, 1920)), Math.max(320, Math.min(Number(height) || 800, 1200))];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcphub-video-'));
    const webm = path.join(tmp, 'demo.webm');
    const url = (extra = {}) => this.hooks.fileUrl(slug, 'index.html', { clean: true, ...extra });
    const p = await this.page(url(slides ? { slide: 1 } : {}), { width: w, height: h });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      const rec = await p.screencast({ path: webm });
      await wait(1200);
      if (slides) {
        const n = Math.min(await p.evaluate(() => document.querySelectorAll('section.slide').length) || 1, 30);
        for (let i = 2; i <= n; i++) { await p.goto(url({ slide: i }), { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}); await wait(2200); }
      } else {
        // Recorrido: bajar poco a poco, volver arriba y pulsar los enlaces internos y botones de navegación (sin salir del diseño)
        const scrollDown = async () => {
          const total = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
          for (let y = 0; y <= total && y < 12000; y += Math.max(120, Math.round(total / 40))) { await p.evaluate((yy) => scrollTo({ top: yy }), y); await wait(90); }
          await wait(500); await p.evaluate(() => scrollTo({ top: 0, behavior: 'smooth' })); await wait(800);
        };
        await scrollDown();
        const targets = await p.evaluate(() => {
          const els = [...document.querySelectorAll('nav a, nav button, [role=tab], a[href^="#"], [data-screen], [data-tab], .tab, .tabs button, .nav-item, .bottom-nav button, .tabbar button')]
            .filter((e) => { const r = e.getBoundingClientRect(); const href = e.getAttribute('href') || ''; return r.width > 4 && r.height > 4 && !/^(https?:|mailto:|tel:)/.test(href); });
          const seen = new Set(); const out = [];
          for (const e of els) { const k = (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 40); if (!k || seen.has(k)) continue; seen.add(k); e.setAttribute('data-mcphub-tour', String(out.length)); out.push(k); }
          return out.slice(0, 6);
        });
        for (let i = 0; i < targets.length; i++) {
          await p.evaluate((k) => { const e = document.querySelector(`[data-mcphub-tour="${k}"]`); e?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, i);
          await wait(500);
          await p.click(`[data-mcphub-tour="${i}"]`).catch(() => {});
          await wait(1400);
        }
        if (targets.length) await scrollDown();
      }
      await wait(600);
      await rec.stop();
    } finally { await p.close().catch(() => {}); }
    const base = slugify(m.name);
    if (format === 'webm') { const data = fs.readFileSync(webm); fs.rmSync(tmp, { recursive: true, force: true }); return { name: `${base}-demo.webm`, mime: 'video/webm', data }; }
    const out = path.join(tmp, `demo.${format}`);
    const args = format === 'gif'
      ? ['-y', '-i', webm, '-vf', `fps=8,scale=${Math.min(w, 720)}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, out]
      : ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', out];
    await new Promise((resolve, reject) => execFile('ffmpeg', args, { timeout: 180000 }, (e, _o, err) => (e ? reject(new Error(`ffmpeg falló: ${String(err).slice(-300)}`)) : resolve())));
    const data = fs.readFileSync(out);
    fs.rmSync(tmp, { recursive: true, force: true });
    return { name: `${base}-demo.${format}`, mime: format === 'gif' ? 'image/gif' : 'video/mp4', data };
  }

  // ---- Exportar ----
  // ---- Exportación 3D ----
  // Saca el objeto de la escena del diseño (sin suelo, sombra de contacto ni luces) en el formato pedido
  async sceneExport(slug, format) {
    const p = await this.page(this.hooks.fileUrl(slug, 'index.html', { clean: true }), { width: 1280, height: 800 });
    try {
      await p.waitForFunction(() => window.stage?.root || globalThis.__mcphubScenes?.size > 0, { timeout: 15000 })
        .catch(() => { throw new Error('No encuentro ninguna escena 3D en este diseño (¿usa Three.js?)'); });
      await new Promise((r) => setTimeout(r, 1500)); // modelos y texturas que cargan después
      const r = await p.evaluate(async (format) => {
        const threeUrl = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/build\/three\.module(\.min)?\.js/.test(n));
        const T = await import(threeUrl || 'three');
        const base = threeUrl ? threeUrl.replace(/build\/three\.module(\.min)?\.js.*$/, 'examples/jsm/exporters/') : null;
        const load = async (name) => { try { return await import(`three/addons/exporters/${name}.js`); } catch { return import(base + name + '.js'); } };
        const count = (o) => { let n = 0; o.traverse((x) => { if (x.isMesh) n++; }); return n; };
        let src = window.stage?.root;
        // Sin stage.js: la escena que se dibuja en cada fotograma (no la de entorno que se usa una vez para los reflejos)
        if (!src || !count(src)) src = [...(globalThis.__mcphubScenes || new Map())].filter(([sc]) => sc.constructor?.name !== 'RoomEnvironment' && count(sc))
          .sort((a, b) => b[1] - a[1])[0]?.[0];
        if (!src || !count(src)) throw new Error('La escena no tiene ninguna malla que exportar');
        src.updateMatrixWorld(true);
        const copy = src.clone(true);
        copy.updateMatrixWorld(true);
        const drop = new Set();
        const sizeOf = (o) => new T.Box3().setFromObject(o).getSize(new T.Vector3());
        const meshes = [];
        copy.traverse((o) => {
          const mats = [].concat(o.material || []);
          if (o === copy) return;
          if (String(o.name).startsWith('__') || o.isLight || o.isCamera || /Helper$/.test(o.type) || o.visible === false
            || mats.some((m) => m.isShadowMaterial || m.side === T.BackSide)) drop.add(o);
          else if (o.isMesh) meshes.push(o);
        });
        // Suelos y fondos: planos muy grandes comparados con el objeto
        const flat = (v) => Math.min(v.x, v.y, v.z) < Math.max(v.x, v.y, v.z) * 0.02;
        const core = new T.Box3();
        for (const o of meshes) if (!flat(sizeOf(o))) core.expandByObject(o);
        const coreDiag = core.isEmpty() ? Infinity : core.getSize(new T.Vector3()).length();
        for (const o of meshes) { const v = sizeOf(o); if (flat(v) && Math.max(v.x, v.y, v.z) > coreDiag * 1.5) drop.add(o); }
        drop.forEach((o) => o.removeFromParent());
        const root = new T.Group(); root.name = document.title || 'modelo';
        if (copy.isScene) { copy.updateMatrixWorld(true); [...copy.children].forEach((c) => root.add(c)); }
        else { copy.matrix.copy(src.matrixWorld); copy.matrix.decompose(copy.position, copy.quaternion, copy.scale); root.add(copy); }
        const b64 = (buf) => { const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf); let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); };
        if (format === 'glb' || format === 'gltf') {
          const { GLTFExporter } = await load('GLTFExporter');
          const out = await new GLTFExporter().parseAsync(root, { binary: format === 'glb', embedImages: true, onlyVisible: true });
          return format === 'glb' ? { b64: b64(out) } : { text: JSON.stringify(out) };
        }
        if (format === 'stl') { const { STLExporter } = await load('STLExporter'); return { b64: b64(new STLExporter().parse(root, { binary: true })) }; }
        if (format === 'ply') { const { PLYExporter } = await load('PLYExporter'); const out = await new Promise((res) => new PLYExporter().parse(root, res, { binary: true })); return { b64: b64(out) }; }
        if (format === 'usdz') { const { USDZExporter } = await load('USDZExporter'); const e = new USDZExporter(); return { b64: b64(await (e.parseAsync ? e.parseAsync(root) : e.parse(root))) }; }
        throw new Error('Formato no soportado');
      }, format);
      return r.text != null ? Buffer.from(r.text) : Buffer.from(r.b64, 'base64');
    } finally { await p.close(); }
  }
  async export3d(slug, format) {
    const f = FORMATS_3D[format];
    if (!f) throw new Error('Formato 3D no válido');
    const base = slugify(this.meta(slug).name);
    if (f.via === 'three') return { name: `${base}.${format}`, mime: f.mime, data: await this.sceneExport(slug, format) };
    if (!BLENDER) throw new Error(`Para exportar a ${f.label} hace falta Blender instalado`);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcphub-3d-'));
    try {
      const src = path.join(tmp, 'modelo.glb');
      fs.writeFileSync(src, await this.sceneExport(slug, 'glb'));
      const outDir = path.join(tmp, 'out'); fs.mkdirSync(outDir);
      const ext = { obj: 'obj', fbx: 'fbx', blend: 'blend', usd: 'usdc', abc: 'abc' }[format];
      const dst = path.join(outDir, `${base}.${ext}`);
      await new Promise((resolve, reject) => execFile(BLENDER, ['-b', '--factory-startup', '--python', path.join(ASSETS, 'convert3d.py'), '--', src, dst, format],
        { timeout: 180000, maxBuffer: 32 * 1024 * 1024 }, (e, out, err) => (e || !fs.existsSync(dst) ? reject(new Error(`Blender no pudo convertir el modelo: ${String(err || out || e?.message).trim().split('\n').slice(-3).join(' ')}`)) : resolve())));
      if (format === 'obj') {
        const zip = new JSZip();
        for (const fn of fs.readdirSync(outDir)) zip.file(fn, fs.readFileSync(path.join(outDir, fn)));
        return { name: `${base}-obj.zip`, mime: 'application/zip', data: await zip.generateAsync({ type: 'nodebuffer' }) };
      }
      return { name: path.basename(dst), mime: f.mime, data: fs.readFileSync(dst) };
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  formats3d() { return Object.entries(FORMATS_3D).map(([id, f]) => ({ id, label: f.label, available: f.via === 'three' || !!BLENDER })); }

  async export(slug, format, { width = 1440, height = 900 } = {}) {
    if (FORMATS_3D[format]) return this.export3d(slug, format);
    const d = this.dir(slug), m = this.meta(slug);
    const base = slugify(m.name);
    const url = (extra = {}) => this.hooks.fileUrl(slug, 'index.html', { clean: true, ...extra });
    const slides = m.type === 'slides';
    if (format === 'pdf') {
      const p = await this.page(url({ print: slides ? 1 : null }), { width: slides ? 1920 : width, height: slides ? 1080 : height });
      try {
        const opts = slides ? { width: '1920px', height: '1080px', printBackground: true, pageRanges: '' }
          : A4_TYPES.includes(m.type) ? { format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } }
          : { width: `${width}px`, height: `${await p.evaluate(() => document.documentElement.scrollHeight)}px`, printBackground: true };
        return { name: `${base}.pdf`, mime: 'application/pdf', data: Buffer.from(await p.pdf(opts)) };
      } finally { await p.close(); }
    }
    if (format === 'png') {
      if (!slides) return { name: `${base}.png`, mime: 'image/png', data: await this.screenshot(url(), { width, height, full: true }) };
      const n = await this.slideCount(url());
      const zip = new JSZip();
      for (let i = 1; i <= n; i++) zip.file(`${base}-${String(i).padStart(2, '0')}.png`, await this.screenshot(url({ slide: i }), { width: 1920, height: 1080 }));
      return { name: `${base}-diapositivas.zip`, mime: 'application/zip', data: await zip.generateAsync({ type: 'nodebuffer' }) };
    }
    if (format === 'pptx') {
      if (!slides) throw new Error('PPTX solo está disponible para presentaciones');
      const PptxGenJS = (await import('pptxgenjs')).default;
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9'; pptx.title = m.name;
      const n = await this.slideCount(url());
      const notes = await (async () => { const p = await this.page(url(), { width: 1920, height: 1080 }); try { return await p.evaluate(() => [...document.querySelectorAll('section.slide')].map((s) => s.querySelector('aside.notes')?.innerText || '')); } finally { await p.close(); } })();
      for (let i = 1; i <= n; i++) {
        const png = await this.screenshot(url({ slide: i }), { width: 1920, height: 1080 });
        const s = pptx.addSlide();
        s.addImage({ data: 'data:image/png;base64,' + png.toString('base64'), x: 0, y: 0, w: '100%', h: '100%' });
        if (notes[i - 1]) s.addNotes(notes[i - 1]);
      }
      return { name: `${base}.pptx`, mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', data: await pptx.write({ outputType: 'nodebuffer' }) };
    }
    if (format === 'zip' || format === 'html') {
      const files = [];
      const walk = (rel) => {
        for (const e of fs.readdirSync(path.join(d, rel), { withFileTypes: true })) {
          const r = path.join(rel, e.name);
          if (['.git', '.design', '.gitignore', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md'].includes(r)) continue;
          if (e.isDirectory()) walk(r); else files.push(r);
        }
      };
      walk('');
      const inject = this.hooks.injectScript();
      const bake = (html) => html.replace(/<\/head>/i, `${this.tweakStyle(slug)}</head>`).replace(/<\/body>(?![\s\S]*<\/body>)/i, `<script>${inject}</script></body>`);
      if (format === 'zip') {
        const zip = new JSZip();
        for (const f of files) {
          let data = fs.readFileSync(path.join(d, f));
          if (f.endsWith('.html')) data = bake(data.toString());
          zip.file(f, data);
        }
        return { name: `${base}.zip`, mime: 'application/zip', data: await zip.generateAsync({ type: 'nodebuffer' }) };
      }
      // Un solo archivo: CSS/JS locales en línea y recursos de assets/ como data URIs
      let html = fs.readFileSync(path.join(d, 'index.html'), 'utf8');
      const local = (u) => !/^(https?:|data:|\/\/|#|mailto:)/i.test(u) && fs.existsSync(path.join(d, u.split(/[?#]/)[0]));
      html = html.replace(/<link([^>]*?)href=["']([^"']+\.css)["']([^>]*)>/gi, (all, a, href) => (local(href) ? `<style>${fs.readFileSync(path.join(d, href.split(/[?#]/)[0]), 'utf8')}</style>` : all));
      html = html.replace(/<script([^>]*?)src=["']([^"']+\.m?js)["']([^>]*)><\/script>/gi, (all, a, src, b) => (local(src) ? `<script${a}${b}>${fs.readFileSync(path.join(d, src.split(/[?#]/)[0]), 'utf8')}</script>` : all));
      const MIMES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
      html = html.replace(/(["'(])((?:\.\/)?assets\/[^"')]+)(["')])/g, (all, q1, u, q2) => {
        const f = path.join(d, u.replace(/^\.\//, '').split(/[?#]/)[0]);
        if (!fs.existsSync(f)) return all;
        return `${q1}data:${MIMES[path.extname(f).toLowerCase()] || 'application/octet-stream'};base64,${fs.readFileSync(f).toString('base64')}${q2}`;
      });
      return { name: `${base}.html`, mime: 'text/html', data: Buffer.from(bake(html)) };
    }
    throw new Error('Formato no válido');
  }
}
