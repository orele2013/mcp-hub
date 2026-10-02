#!/usr/bin/env node
// Servidor MCP (stdio) de la Bóveda de MCP Hub.
// Da a los agentes acceso a las credenciales marcadas como "accesible para agentes".
// Habla con MCP Hub por HTTP local; si la bóveda está bloqueada, lo dice.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const PORT = Number(process.env.MCP_HUB_PORT || 7777);
const TOKEN_FILE = path.join(os.homedir(), '.config', 'mcp-hub', 'agent-token');
let clientName = 'agente';

async function hub(pathname, body) {
  let token;
  try { token = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch { throw new Error('MCP Hub no está configurado (falta el token de agente).'); }
  let res;
  try {
    res = await fetch(`http://127.0.0.1:${PORT}${pathname}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-agent-token': token },
      body: JSON.stringify({ ...body, client: clientName }),
    });
  } catch { throw new Error('MCP Hub no está en marcha. Ábrelo con el comando `mcp-hub`.'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

const TOOLS = [
  {
    name: 'vault_list',
    description: 'Lista las credenciales guardadas en la Bóveda de MCP Hub a las que tienes acceso (API keys, contraseñas, cuentas, bases de datos). No devuelve los secretos. Usa `query` para filtrar por nombre, servicio o nota.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Texto para filtrar (opcional)' } } },
  },
  {
    name: 'vault_get',
    description: 'Devuelve una credencial completa de la Bóveda, incluido el secreto (contraseña o API key) y, para bases de datos, la cadena de conexión. Úsala solo cuando la necesites para la tarea actual y no muestres el secreto al usuario salvo que lo pida.',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Nombre o id de la credencial (de vault_list)' } }, required: ['name'] },
  },
];

async function callTool(name, args = {}) {
  if (name === 'vault_list') {
    const r = await hub('/agent/vault/list', { query: args.query || '' });
    if (!r.items.length) return 'No hay credenciales accesibles para agentes' + (args.query ? ` que coincidan con "${args.query}"` : '') + '.';
    return r.items.map((it) => `- ${it.name} [${it.type}]${it.service ? ` · ${it.service}` : ''}${it.username ? ` · usuario: ${it.username}` : ''}${it.url ? ` · ${it.url}` : ''}${it.envVar ? ` · variable: ${it.envVar}` : ''}${it.notes ? `\n  nota: ${it.notes}` : ''}`).join('\n');
  }
  if (name === 'vault_get') {
    const r = await hub('/agent/vault/get', { name: args.name });
    return JSON.stringify(r.item, null, 2);
  }
  throw new Error(`Herramienta desconocida: ${name}`);
}

const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  if (id === undefined) return; // notificaciones
  try {
    if (method === 'initialize') {
      clientName = params?.clientInfo?.name || clientName;
      return send({ jsonrpc: '2.0', id, result: {
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'mcp-hub-vault', version: '1.0.0' },
        instructions: 'Bóveda de credenciales del usuario. Consulta vault_list para ver qué hay y vault_get solo para la credencial que necesites.',
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
