#!/usr/bin/env node
// Servidor MCP (stdio) de Encargos de MCP Hub: un agente puede encargar tareas a otro agente
// (Claude Code, Codex, OpenCode, Gemini CLI, Cursor) y recibir su respuesta. Cada encargo se ve en una pestaña de MCP Hub.
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
      body: JSON.stringify({ ...body, client: clientName, label: `${clientName} · ${path.basename(process.cwd()) || '/'}`,
        session: process.env.MCP_HUB_SESSION || null, depth: Number(process.env.MCP_HUB_DEPTH) || 0 }),
    });
  } catch { throw new Error('MCP Hub no está en marcha. Ábrelo con el comando `mcp-hub`.'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

const FLOW = {
  after: { type: 'array', items: { type: 'string' }, description: 'Ids de encargos que deben terminar antes de empezar este. Por defecto recibe sus respuestas al final de la tarea.' },
  on_dep_fail: { type: 'string', enum: ['skip', 'run', 'any'], description: 'Si falla alguna dependencia: skip (omitir, por defecto), run (lanzarlo igualmente), any (lanzarlo si al menos una terminó bien).' },
  use_results: { type: 'boolean', description: 'Añadir a la tarea las respuestas de las dependencias (por defecto true).' },
};
const WAIT = { type: 'number', description: 'Segundos a esperar el resultado en esta llamada (máx. 55, por defecto 50). Si no ha terminado, sigue con get_delegation.' };
const TOOLS = [
  {
    name: 'list_agents',
    description: 'Lista los agentes de IA instalados a los que puedes encargar tareas (Claude Code, Codex, OpenCode, Gemini CLI, Cursor) y los encargos recientes.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'delegate',
    description: 'Encarga una tarea a otro agente de IA y espera su respuesta. Útil para pedir una segunda opinión o revisión, repartir trabajo en paralelo o aprovechar las fortalezas de otro modelo. El agente delegado trabaja en la carpeta indicada con los permisos indicados (por defecto, los que configuró el usuario) y no ve tu conversación: escribe la tarea completa y autocontenida, con el contexto, los archivos relevantes y qué debe devolver. Tarda de segundos a muchos minutos; si no termina a tiempo devuelve el id para seguir con get_delegation.',
    inputSchema: { type: 'object', properties: {
      agent: { type: 'string', enum: ['claude', 'codex', 'opencode', 'gemini', 'cursor'], description: 'Agente al que se encarga' },
      task: { type: 'string', description: 'Tarea completa y autocontenida' },
      cwd: { type: 'string', description: 'Carpeta de trabajo (por defecto, la tuya)' },
      model: { type: 'string', description: 'Modelo concreto (opcional)' },
      role: { type: 'string', description: 'Rol del usuario a aplicar (id o nombre, ver list_agents): añade sus instrucciones y sus valores por defecto de agente, permisos, aislamiento y límites.' },
      permission: { type: 'string', enum: ['read', 'edit', 'ask', 'full'], description: 'Permisos del agente delegado: read (solo leer), edit (editar archivos, sin comandos), ask (pide al usuario aprobación para cada acción delicada), full (sin límites). Por defecto, el configurado por el usuario.' },
      isolation: { type: 'string', enum: ['none', 'worktree'], description: 'worktree = trabaja en una copia aislada del repositorio git y el usuario revisa y aplica los cambios después; none = directamente en la carpeta. Por defecto, el configurado por el usuario.' },
      timeout_minutes: { type: 'number', description: 'Límite de tiempo en minutos (opcional)' },
      max_turns: { type: 'number', description: 'Máximo de turnos del agente (solo Claude Code)' },
      budget_usd: { type: 'number', description: 'Gasto máximo en USD (solo Claude Code, según su propia estimación)' },
      priority: { type: 'number', description: 'Prioridad en la cola, de -10 a 10 (por defecto 0)' },
      ...FLOW,
      review_with: { type: 'string', description: 'Al terminar, otro agente revisa el resultado de forma independiente (solo lectura) y da un veredicto. Un id de agente o "auto" (elige uno distinto del autor).' },
      wait_seconds: WAIT,
    }, required: ['agent', 'task'] },
  },
  {
    name: 'delegate_parallel',
    description: 'Encarga la MISMA tarea a varios agentes a la vez (cada uno por separado) y, si quieres, que otro agente reúna y compare sus respuestas al final. Útil para comparar enfoques o modelos, o para contrastar una respuesta importante. Devuelve el id del grupo; sigue con get_group.',
    inputSchema: { type: 'object', properties: {
      agents: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 8, description: 'Agentes, por ejemplo ["claude", "codex", "gemini"]. Para fijar el modelo: "agente:modelo".' },
      task: { type: 'string', description: 'Tarea completa y autocontenida (la misma para todos)' },
      synthesize_with: { type: 'string', description: 'Agente que reúne y compara las respuestas al terminar (opcional)' },
      cwd: { type: 'string', description: 'Carpeta de trabajo (por defecto, la tuya)' },
      role: { type: 'string' },
      permission: { type: 'string', enum: ['read', 'edit', 'ask', 'full'] },
      isolation: { type: 'string', enum: ['none', 'worktree'], description: 'Si varios agentes van a editar la misma carpeta, usa worktree para que no se pisen.' },
      timeout_minutes: { type: 'number' },
      ...FLOW,
      wait_seconds: WAIT,
    }, required: ['agents', 'task'] },
  },
  {
    name: 'get_group',
    description: 'Consulta un grupo de encargos en paralelo (delegate_parallel) y espera a que terminen.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Id del grupo (empieza por g)' }, wait_seconds: WAIT }, required: ['id'] },
  },
  {
    name: 'request_review',
    description: 'Pide a otro agente una revisión independiente (solo lectura) del resultado de un encargo: busca fallos, cosas sin hacer y riesgos, y da un veredicto (aprobado, cambios necesarios o rechazado). Si el encargo trabajó aislado, el revisor ve su diff. Devuelve el id del encargo de revisión.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Encargo a revisar' }, agent: { type: 'string', description: 'Agente revisor, o "auto" (por defecto: uno distinto del autor)' }, wait_seconds: WAIT }, required: ['id'] },
  },
  {
    name: 'get_delegation',
    description: 'Consulta un encargo hecho con delegate y espera su resultado si sigue en marcha.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Id del encargo' }, wait_seconds: WAIT }, required: ['id'] },
  },
  {
    name: 'resume_delegation',
    description: 'Reanuda un encargo interrumpido, fallido o que agotó el tiempo (continúa la sesión del agente si es posible).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'cancel_delegation',
    description: 'Cancela un encargo en marcha.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
];

const VERDICT = { approved: 'APROBADO', changes: 'CAMBIOS NECESARIOS', rejected: 'RECHAZADO' };
const STATUS = { waiting: 'esperando a que terminen otros encargos', skipped: 'omitido (falló una dependencia)', queued: 'en cola', paused: 'en pausa', awaiting_approval: 'esperando la aprobación del usuario', starting: 'arrancando', running: 'en marcha',
  done: 'terminado', error: 'falló', cancelled: 'cancelado', timeout: 'agotó el límite de tiempo', interrupted: 'interrumpido', rejected: 'no aprobado por el usuario' };
function fmt(j) {
  const kind = j.kind === 'review' ? `Revisión ${j.id} (de ${j.reviewOf})` : j.kind === 'synthesis' ? `Síntesis ${j.id}` : `Encargo ${j.id}`;
  if (ACTIVE.includes(j.status)) {
    return `${kind} (${j.agentName}): ${STATUS[j.status]}${j.status === 'waiting' ? ` (${j.after.join(', ')})` : ''}${j.queuePos ? ` (posición ${j.queuePos} en la cola)` : ''}.${j.reviewJob ? ` Revisión independiente: ${j.reviewJob}.` : ''} Llama a get_delegation con id "${j.id}" para seguir esperando, o haz otra cosa mientras tanto.`;
  }
  const out = [`${kind} a ${j.agentName}: ${STATUS[j.status] || j.status}${j.status === 'error' && j.exitCode != null ? ` (código ${j.exitCode})` : ''}.`];
  if (j.kind === 'review') out.push(j.verdict ? `Veredicto: ${VERDICT[j.verdict]}.` : 'No dio un veredicto reconocible; lee la respuesta.');
  if (j.reviewJob) out.push(j.verdict ? `Revisión independiente (${j.reviewJob}): ${VERDICT[j.verdict]}.` : `Revisión independiente pedida: encargo ${j.reviewJob} (consúltalo con get_delegation).`);
  if (j.review?.status === 'pending') out.push(`Trabajó en un entorno aislado: ${j.review.files} archivo(s) cambiado(s) (+${j.review.added} −${j.review.removed}). Los cambios NO están aplicados en tu carpeta: el usuario los revisa y aplica desde MCP Hub → Agentes.`);
  if (j.review?.status === 'empty') out.push('Trabajó en un entorno aislado y no cambió ningún archivo.');
  if (['interrupted', 'timeout', 'error'].includes(j.status)) out.push(`Se puede reanudar con resume_delegation (id "${j.id}").`);
  if (j.usage) out.push(`Uso informado por el agente: ${[j.usage.turns != null && `${j.usage.turns} turnos`, j.usage.costUsd != null && `~${j.usage.costUsd.toFixed(3)} USD (estimación del agente)`].filter(Boolean).join(', ')}.`);
  out.push('', j.result || '');
  return out.join('\n');
}

const ACTIVE = ['waiting', 'queued', 'paused', 'awaiting_approval', 'starting', 'running'];
function fmtGroup(r) {
  const busy = r.jobs.filter((j) => ACTIVE.includes(j.status));
  const head = `Grupo ${r.group}: ${r.jobs.length - busy.length} de ${r.jobs.length} encargos terminados.${busy.length ? ` Sigue con get_group (id "${r.group}") para esperar al resto.` : ''}`;
  return [head, ...r.jobs.map((j) => `\n==== ${fmt(j)}`)].join('\n');
}

async function callTool(name, a = {}) {
  if (name === 'list_agents') {
    const r = await hub('/agent/agents/list', {});
    const agents = r.agents.map((x) => `- ${x.id}: ${x.name}${x.installed ? '' : ' (no instalado)'}${x.note ? ` — ${x.note}` : ''}`).join('\n');
    const roles = r.roles?.length ? '\n\nRoles disponibles (parámetro role de delegate):\n' + r.roles.map((x) => `- ${x.id}: ${x.name} — ${x.desc}`).join('\n') : '';
    const jobs = r.jobs.length ? '\n\nEncargos recientes:\n' + r.jobs.map((j) => `- ${j.id} · ${j.agentName} · ${j.status} · ${j.task.slice(0, 80)}`).join('\n') : '';
    return agents + roles + jobs;
  }
  if (name === 'delegate') {
    const { id } = await hub('/agent/agents/delegate', { role: a.role, agent: a.agent, task: a.task, cwd: a.cwd || process.cwd(), model: a.model, permission: a.permission,
      isolation: a.isolation, timeout_minutes: a.timeout_minutes, max_turns: a.max_turns, budget_usd: a.budget_usd, priority: a.priority,
      after: a.after, on_dep_fail: a.on_dep_fail, use_results: a.use_results, review_with: a.review_with });
    return fmt(await hub('/agent/agents/result', { id, wait: a.wait_seconds ?? 50 }));
  }
  if (name === 'delegate_parallel') {
    const { group } = await hub('/agent/agents/parallel', { agents: a.agents, task: a.task, synthesize_with: a.synthesize_with, cwd: a.cwd || process.cwd(), role: a.role,
      permission: a.permission, isolation: a.isolation, timeout_minutes: a.timeout_minutes, after: a.after, on_dep_fail: a.on_dep_fail, use_results: a.use_results });
    return fmtGroup(await hub('/agent/agents/group', { id: group, wait: a.wait_seconds ?? 50 }));
  }
  if (name === 'get_group') return fmtGroup(await hub('/agent/agents/group', { id: a.id, wait: a.wait_seconds ?? 50 }));
  if (name === 'request_review') {
    const r = await hub('/agent/agents/review', { id: a.id, agent: a.agent });
    return fmt(await hub('/agent/agents/result', { id: r.id, wait: a.wait_seconds ?? 50 }));
  }
  if (name === 'get_delegation') return fmt(await hub('/agent/agents/result', { id: a.id, wait: a.wait_seconds ?? 50 }));
  if (name === 'resume_delegation') return fmt(await hub('/agent/agents/resume', { id: a.id }));
  if (name === 'cancel_delegation') { await hub('/agent/agents/cancel', { id: a.id }); return `Encargo ${a.id} cancelado.`; }
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
        serverInfo: { name: 'mcp-hub-agents', version: '1.0.0' },
        instructions: 'Encarga tareas a otros agentes de IA del usuario con delegate. Escribe tareas autocontenidas: el otro agente no ve tu conversación.',
      } });
    }
    if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    if (method === 'tools/call') {
      try {
        const text = await callTool(params.name, params.arguments);
        return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } });
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
