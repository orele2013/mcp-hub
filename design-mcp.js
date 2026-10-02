#!/usr/bin/env node
// Servidor MCP (stdio) de Diseño de MCP Hub: cualquier agente puede crear y modificar diseños (prototipos, presentaciones,
// documentos, apps móviles, emails…), verlos como imagen, exportarlos y abrirlos en MCP Hub para el usuario.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const PORT = Number(process.env.MCP_HUB_PORT || 7777);
const TOKEN_FILE = path.join(os.homedir(), '.config', 'mcp-hub', 'agent-token');
let clientName = 'Agente';

async function hub(pathname, body) {
  let token;
  try { token = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch { throw new Error('MCP Hub no está configurado (falta el token de agente).'); }
  let res;
  try {
    res = await fetch(`http://127.0.0.1:${PORT}${pathname}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-agent-token': token },
      body: JSON.stringify({ ...body, client: clientName, cwd: process.cwd() }),
    });
  } catch { throw new Error('MCP Hub no está en marcha. Ábrelo con el comando `mcp-hub`.'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

const TYPES = ['blank', 'prototype', 'mobile', 'slides', 'doc', 'wireframe', 'animation', 'mockups', 'resume', 'model3d', 'research', 'email', 'palette', 'system'];
const AGENTS = ['claude', 'codex', 'opencode', 'gemini', 'cursor'];
const WAIT = { type: 'number', description: 'Segundos a esperar a que el diseñador termine en esta llamada (0–55, por defecto 50). Si no termina, usa design_wait.' };
const SLUG = { type: 'string', description: 'Id del diseño (slug), de design_list o design_create' };
const TOOLS = [
  {
    name: 'design_list',
    description: 'Lista los diseños de MCP Hub → Diseño (proyectos, sistemas de diseño y plantillas) con su tipo, agente diseñador y si está trabajando.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Filtrar por nombre (opcional)' } } },
  },
  {
    name: 'design_create',
    description: `Crea un diseño nuevo en MCP Hub → Diseño (como Claude Design) y pone a un agente diseñador a trabajar en él. Sirve para prototipos interactivos, apps móviles, presentaciones, documentos, wireframes, animaciones, mockups, currículums, objetos 3D, informes de investigación, emails HTML, exploraciones de color + tipografía o sistemas de diseño. El resultado es HTML/CSS/JS en ~/Designs/<slug>/ que el usuario ve y edita en un lienzo.
Tipos: ${TYPES.join(', ')}. Escribe un encargo claro y completo (público, contenido, estilo); el diseñador no ve tu conversación.`,
    inputSchema: { type: 'object', properties: {
      prompt: { type: 'string', description: 'Qué diseñar, con todo el contexto necesario' },
      type: { type: 'string', enum: TYPES, description: 'Tipo de diseño (por defecto prototype)' },
      name: { type: 'string', description: 'Nombre del proyecto (opcional)' },
      agent: { type: 'string', enum: AGENTS, description: 'Agente diseñador (por defecto, el mismo tipo de agente que llama, o Claude Code)' },
      model: { type: 'string', description: 'Modelo del diseñador (opcional)' },
      design_system: { type: 'string', description: 'Slug de un sistema de diseño existente para aplicarlo (opcional)' },
      codebase: { type: 'string', description: 'Carpeta de código a usar como referencia visual y de contenido, sin modificarla (opcional; p. ej. tu proyecto actual)' },
      images: { type: 'array', items: { type: 'string' }, description: 'Rutas absolutas de imágenes de referencia (capturas, bocetos, logos) (opcional)' },
      source_url: { type: 'string', description: 'Solo para type=system: web de la que extraer el sistema de diseño' },
      open: { type: 'boolean', description: 'Abrirlo en la ventana de MCP Hub para que el usuario lo vea (por defecto true)' },
      wait_seconds: WAIT,
    }, required: ['prompt'] },
  },
  {
    name: 'design_message',
    description: 'Pide un cambio o una iteración sobre un diseño existente (como escribir en su chat). El diseñador conserva el contexto de los turnos anteriores. Devuelve su respuesta cuando termina.',
    inputSchema: { type: 'object', properties: {
      slug: SLUG, text: { type: 'string', description: 'Qué cambiar o añadir' },
      images: { type: 'array', items: { type: 'string' }, description: 'Rutas absolutas de imágenes de referencia (opcional)' },
      agent: { type: 'string', enum: AGENTS, description: 'Cambiar de agente diseñador para este y los siguientes turnos (opcional)' },
      wait_seconds: WAIT,
    }, required: ['slug', 'text'] },
  },
  {
    name: 'design_wait',
    description: 'Espera a que el diseñador termine el turno en curso y devuelve su última respuesta.',
    inputSchema: { type: 'object', properties: { slug: SLUG, wait_seconds: WAIT }, required: ['slug'] },
  },
  {
    name: 'design_get',
    description: 'Detalles de un diseño: tipo, carpeta y archivos, agente, versiones, comentarios pendientes del usuario, ajustes y la conversación reciente.',
    inputSchema: { type: 'object', properties: { slug: SLUG }, required: ['slug'] },
  },
  {
    name: 'design_screenshot',
    description: 'Devuelve una captura (imagen) del diseño para que puedas verlo. En presentaciones, indica la diapositiva.',
    inputSchema: { type: 'object', properties: {
      slug: SLUG, width: { type: 'number', description: 'Ancho del viewport (por defecto 1440; 390 para móvil)' }, height: { type: 'number', description: 'Alto (por defecto 900)' },
      slide: { type: 'number', description: 'Número de diapositiva (presentaciones)' }, full_page: { type: 'boolean', description: 'Página completa en vez de solo el viewport' },
    }, required: ['slug'] },
  },
  {
    name: 'design_export',
    description: 'Exporta un diseño a un archivo: pdf, png, pptx (presentaciones), html (un solo archivo autocontenido) o zip (carpeta). Devuelve la ruta del archivo.',
    inputSchema: { type: 'object', properties: {
      slug: SLUG, format: { type: 'string', enum: ['pdf', 'png', 'pptx', 'html', 'zip'] },
      output: { type: 'string', description: 'Carpeta o ruta de destino (por defecto ~/Designs/_exportaciones/)' },
    }, required: ['slug', 'format'] },
  },
  {
    name: 'design_open',
    description: 'Abre un diseño en la ventana de MCP Hub para que el usuario lo vea y lo edite (comentarios, ajustes, dibujo, versiones).',
    inputSchema: { type: 'object', properties: { slug: SLUG }, required: ['slug'] },
  },
];

const fmtTurn = (r) => {
  if (r.running) return `El diseñador (${r.agentName}) sigue trabajando en "${r.name}" (${r.slug}). Llama a design_wait con slug "${r.slug}" para seguir esperando.`;
  const m = r.last;
  return [`Diseño "${r.name}" (${r.slug}) · ${r.typeName} · diseñador: ${r.agentName}`,
    m ? `Estado del último turno: ${m.status === 'done' ? 'terminado' : m.status === 'error' ? 'ERROR' : m.status}${m.version ? ` · versión v${m.version.n}` : ''}` : '',
    m?.text ? `Respuesta del diseñador: ${m.text}` : '',
    `Archivos: ${r.dir} (entrada: index.html)`, `Verlo: ${r.url}`,
    'Usa design_screenshot para ver el resultado, design_message para iterar o design_export para exportarlo.'].filter(Boolean).join('\n');
};

async function callTool(name, a = {}) {
  if (name === 'design_list') {
    const r = await hub('/agent/design/list', { query: a.query || '' });
    if (!r.items.length) return 'No hay diseños' + (a.query ? ` que coincidan con "${a.query}"` : '') + '.';
    return r.items.map((p) => `- ${p.slug} · "${p.name}" · ${p.typeName}${p.template ? ' (plantilla)' : ''} · ${p.agentName}${p.running ? ' · TRABAJANDO' : ''}`).join('\n');
  }
  if (name === 'design_create') return fmtTurn(await hub('/agent/design/create', a));
  if (name === 'design_message') return fmtTurn(await hub('/agent/design/message', a));
  if (name === 'design_wait') return fmtTurn(await hub('/agent/design/wait', a));
  if (name === 'design_get') return JSON.stringify(await hub('/agent/design/get', a), null, 2);
  if (name === 'design_screenshot') {
    const r = await hub('/agent/design/screenshot', a);
    return [{ type: 'image', data: r.png, mimeType: 'image/jpeg' }, { type: 'text', text: `Captura de "${r.name}" (${r.width}×${r.height}${r.slide ? `, diapositiva ${r.slide}/${r.slides}` : ''}).` }];
  }
  if (name === 'design_export') { const r = await hub('/agent/design/export', a); return `Exportado: ${r.path}`; }
  if (name === 'design_open') { const r = await hub('/agent/design/open', a); return `Abierto en MCP Hub: ${r.url}`; }
  throw new Error(`Herramienta desconocida: ${name}`);
}

const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  if (id === undefined) return;
  try {
    if (method === 'initialize') {
      clientName = params?.clientInfo?.name || clientName;
      return send({ jsonrpc: '2.0', id, result: {
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'mcp-hub-design', version: '1.0.0' },
        instructions: 'Diseño de MCP Hub (como Claude Design): crea prototipos, presentaciones, documentos y más con design_create, itera con design_message, míralos con design_screenshot y expórtalos con design_export.',
      } });
    }
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    if (method === 'tools/call') {
      try {
        const out = await callTool(params.name, params.arguments);
        return send({ jsonrpc: '2.0', id, result: { content: typeof out === 'string' ? [{ type: 'text', text: out }] : out } });
      } catch (e) {
        return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: e.message }], isError: true } });
      }
    }
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Método no soportado: ${method}` } });
  } catch (e) {
    send({ jsonrpc: '2.0', id, error: { code: -32603, message: e.message } });
  }
});
