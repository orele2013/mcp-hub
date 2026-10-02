#!/usr/bin/env node
// Servidor MCP (stdio) de aprobaciones para encargos con el perfil "Aprobar cada acción".
// Claude Code lo usa como --permission-prompt-tool: antes de cada acción que necesite permiso (comandos, ediciones
// fuera de lo permitido…) pregunta a MCP Hub, que lo muestra en la bandeja de aprobaciones (y avisa por Mensajería).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const PORT = Number(process.env.MCP_HUB_PORT || 7777);
const JOB = process.env.MCP_HUB_JOB || '';
const TOKEN_FILE = path.join(os.homedir(), '.config', 'mcp-hub', 'agent-token');

async function hub(pathname, body) {
  const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  const res = await fetch(`http://127.0.0.1:${PORT}${pathname}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-agent-token': token }, body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

async function approve(args) {
  const input = args.input || {};
  try {
    const { id } = await hub('/agent/approvals/request', { job: JOB, tool: args.tool_name || 'herramienta', input });
    for (;;) {
      const r = await hub('/agent/approvals/wait', { id, wait: 50 });
      if (r.status === 'allowed') return { behavior: 'allow', updatedInput: input };
      if (r.status === 'denied') return { behavior: 'deny', message: r.note ? `El usuario lo ha denegado: ${r.note}` : 'El usuario ha denegado esta acción. Busca otra forma o termina explicando qué necesitabas.' };
      if (r.status === 'expired') return { behavior: 'deny', message: 'Nadie respondió a tiempo a la solicitud de permiso.' };
    }
  } catch (e) {
    return { behavior: 'deny', message: `No se pudo pedir aprobación a MCP Hub (${e.message}).` };
  }
}

const TOOLS = [{
  name: 'approve',
  description: 'Pide al usuario, a través de MCP Hub, permiso para ejecutar una herramienta.',
  inputSchema: { type: 'object', properties: { tool_name: { type: 'string' }, input: { type: 'object' }, tool_use_id: { type: 'string' } }, required: ['tool_name', 'input'] },
}];

const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
readline.createInterface({ input: process.stdin }).on('line', async (line) => {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  if (id === undefined) return;
  if (method === 'initialize') return send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'mcp-hub-approvals', version: '1.0.0' } } });
  if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  if (method === 'tools/call') return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(await approve(params.arguments || {})) }] } });
  if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
  send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Método no soportado: ${method}` } });
});
