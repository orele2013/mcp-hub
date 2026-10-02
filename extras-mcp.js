#!/usr/bin/env node
// Servidor MCP (stdio) "mcp-hub-extras": los agentes pueden consultar tu agenda (sin ver las URLs secretas del calendario),
// añadir tareas al tablero de MCP Hub, ver el mapa de módulos de un proyecto y el estado de los monitores.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const PORT = Number(process.env.MCP_HUB_PORT || 7777);
const TOKEN_FILE = path.join(os.homedir(), '.config', 'mcp-hub', 'agent-token');
let clientName = 'Agente';

async function hub(action, body = {}) {
  let token;
  try { token = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch { throw new Error('MCP Hub no está configurado (falta el token de agente).'); }
  let res;
  try {
    res = await fetch(`http://127.0.0.1:${PORT}/agent/extras/${action}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-agent-token': token }, body: JSON.stringify({ ...body, client: clientName }) });
  } catch { throw new Error('MCP Hub no está en marcha. Ábrelo con el comando `mcp-hub`.'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}
const NOCAL = 'El usuario no ha conectado ningún calendario en MCP Hub (Agentes → Integraciones → Calendario).';

const TOOLS = [
  { name: 'calendar_events', description: 'Eventos de la agenda del usuario desde hoy durante N días (por defecto 1: hoy).', inputSchema: { type: 'object', properties: { days: { type: 'number', description: 'Días a consultar, de 1 a 62' } } } },
  { name: 'calendar_free_slots', description: 'Huecos libres en la agenda del usuario (de 8 a 21 h) en los próximos N días, de al menos M minutos.', inputSchema: { type: 'object', properties: { days: { type: 'number' }, minutes: { type: 'number' } } } },
  { name: 'calendar_busy_now', description: 'Indica si el usuario está ocupado ahora mismo según su agenda (útil antes de molestarle con una pregunta).', inputSchema: { type: 'object', properties: {} } },
  { name: 'board_list', description: 'Tarjetas del tablero kanban de MCP Hub (Ideas, En curso, Revisar, Hecho).', inputSchema: { type: 'object', properties: {} } },
  { name: 'board_add', description: 'Añade una tarjeta a la columna Ideas del tablero de MCP Hub, para que el usuario la revise y la lance cuando quiera (no se ejecuta sola).',
    inputSchema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, cwd: { type: 'string', description: 'Carpeta del proyecto (por defecto, la tuya)' },
      agent: { type: 'string', enum: ['claude', 'codex', 'gemini', 'opencode', 'cursor'] }, isolation: { type: 'string', enum: ['none', 'worktree'] } }, required: ['title'] } },
  { name: 'project_map', description: 'Mapa de módulos de un proyecto: carpetas, archivos, líneas, dependencias internas entre módulos (según los imports reales) y paquetes externos más usados.',
    inputSchema: { type: 'object', properties: { cwd: { type: 'string', description: 'Carpeta del proyecto (por defecto, la tuya)' } } } },
  { name: 'monitors_status', description: 'Estado de los monitores de webs y APIs del usuario (funciona, caído, incidentes).', inputSchema: { type: 'object', properties: {} } },
];

const fmtEv = (e) => `- ${e.allDay ? `${e.startText.split(',')[0]} (todo el día)` : `${e.startText} → ${e.endText.split(', ').pop()}`}: ${e.title}${e.location ? ` · ${e.location}` : ''}${e.free ? ' (libre)' : ''}`;
async function callTool(name, a = {}) {
  if (name === 'calendar_events') { const r = await hub('calendar_events', { days: a.days }); if (!r.configured) return NOCAL; return r.events.length ? r.events.map(fmtEv).join('\n') : 'No hay eventos en ese periodo.'; }
  if (name === 'calendar_free_slots') { const r = await hub('calendar_free', { days: a.days, minutes: a.minutes }); if (!r.configured) return NOCAL; return r.slots.length ? r.slots.map((s) => `- ${s.start} → ${s.end.split(', ').pop()}`).join('\n') : 'No hay huecos libres de esa duración.'; }
  if (name === 'calendar_busy_now') { const r = await hub('calendar_now'); if (!r.configured) return NOCAL; return r.busy ? `Ocupado: ${r.event.title} (hasta ${r.event.endText})` : 'Libre ahora mismo.'; }
  if (name === 'board_list') { const r = await hub('board_list'); return r.cards.length ? r.cards.map((c) => `- [${c.column}] ${c.title} (${c.id}) · ${c.agent}${c.jobStatus ? ` · encargo ${c.jobStatus}` : ''}`).join('\n') : 'El tablero está vacío.'; }
  if (name === 'board_add') { const c = await hub('board_add', { ...a, cwd: a.cwd || process.cwd() }); return `Tarjeta "${c.title}" (${c.id}) añadida a Ideas. El usuario la lanzará cuando quiera moviéndola a "En curso".`; }
  if (name === 'project_map') {
    const m = await hub('project_map', { cwd: a.cwd || process.cwd() });
    return [`Proyecto ${m.root}${m.truncated ? ' (recortado a los primeros 4000 archivos)' : ''}`, '', 'Módulos:', ...m.modules.map((x) => `- ${x.module}: ${x.files} archivos, ${x.lines} líneas${x.description ? ` — ${x.description}` : ''}`),
      '', 'Dependencias entre módulos (origen → destino, nº de imports):', ...(m.dependencies.length ? m.dependencies.map((d) => `- ${d.from} → ${d.to} (${d.w})`) : ['(ninguna)']),
      '', 'Paquetes externos más usados:', m.external.map((e) => `${e.name} (${e.uses})`).join(', ') || '(ninguno)'].join('\n');
  }
  if (name === 'monitors_status') { const r = await hub('monitors_status'); return r.monitors.length ? r.monitors.map((m) => `- ${m.name} (${m.url}): ${m.state === 'up' ? 'funciona' : m.state === 'down' ? `CAÍDO desde ${new Date(m.incident?.since).toLocaleString('es-ES')} (${m.incident?.error})` : 'sin comprobar'}${m.last ? ` · última: ${m.last.ms} ms` : ''}`).join('\n') : 'No hay monitores configurados.'; }
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
      return send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'mcp-hub-extras', version: '1.0.0' },
        instructions: 'Herramientas de MCP Hub: agenda del usuario, tablero de tareas, mapa del proyecto y monitores.' } });
    }
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    if (method === 'tools/call') {
      try { return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: await callTool(params.name, params.arguments) }] } }); }
      catch (e) { return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: e.message }], isError: true } }); }
    }
    if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Método no soportado: ${method}` } });
  } catch (e) { send({ jsonrpc: '2.0', id, error: { code: -32603, message: e.message } }); }
});
