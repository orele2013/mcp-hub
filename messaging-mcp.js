#!/usr/bin/env node
// Servidor MCP (stdio) de Mensajería de MCP Hub.
// Deja a los agentes avisarte y preguntarte por Telegram, email, Discord o Slack, y leer lo que les escribas.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const PORT = Number(process.env.MCP_HUB_PORT || 7777);
const TOKEN_FILE = path.join(os.homedir(), '.config', 'mcp-hub', 'agent-token');
let clientName = 'Agente';
const label = () => `${clientName} · ${path.basename(process.cwd()) || '/'}`;

async function hub(pathname, body) {
  let token;
  try { token = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch { throw new Error('MCP Hub no está configurado (falta el token de agente).'); }
  let res;
  try {
    res = await fetch(`http://127.0.0.1:${PORT}${pathname}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-agent-token': token },
      body: JSON.stringify({ ...body, client: clientName, label: label(), session: process.env.MCP_HUB_SESSION || null }),
    });
  } catch { throw new Error('MCP Hub no está en marcha. Ábrelo con el comando `mcp-hub`.'); }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

const CHANNEL = { type: 'string', enum: ['telegram', 'email', 'discord', 'slack'], description: 'Canal (opcional; por defecto el principal del usuario)' };
const WAIT = { type: 'number', description: 'Segundos a esperar la respuesta (máx. 55, por defecto 50)' };
const TOOLS = [
  {
    name: 'send_message',
    description: 'Envía un mensaje al usuario por su canal de mensajería (Telegram, email, Discord o Slack). Úsalo para avisar de que terminaste una tarea larga, de un error que te bloquea o de algo importante cuando el usuario puede no estar delante. Sé breve.',
    inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'Mensaje' }, channel: CHANNEL }, required: ['text'] },
  },
  {
    name: 'ask_user',
    description: 'Hace una pregunta al usuario por su canal de mensajería y espera la respuesta. Úsalo cuando necesites una decisión suya y quizá no esté delante de la terminal. Si no contesta a tiempo devuelve el id de la pregunta; sigue esperando con wait_for_reply.',
    inputSchema: { type: 'object', properties: { question: { type: 'string', description: 'Pregunta clara y autocontenida (incluye las opciones si las hay)' }, channel: CHANNEL, wait_seconds: WAIT }, required: ['question'] },
  },
  {
    name: 'wait_for_reply',
    description: 'Sigue esperando la respuesta a una pregunta hecha con ask_user.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Id de la pregunta (6 caracteres)' }, wait_seconds: WAIT }, required: ['id'] },
  },
  {
    name: 'read_messages',
    description: 'Lee los mensajes nuevos que el usuario ha enviado a la bandeja de los agentes (los que no eran respuesta a una pregunta ni iban a una sesión concreta). Quedan marcados como leídos.',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function callTool(name, a = {}) {
  if (name === 'send_message') {
    const r = await hub('/agent/msg/send', { text: a.text, channel: a.channel });
    return `Enviado por ${r.channel}.`;
  }
  if (name === 'ask_user' || name === 'wait_for_reply') {
    const id = name === 'ask_user' ? (await hub('/agent/msg/ask', { question: a.question, channel: a.channel })).id : a.id;
    const r = await hub('/agent/msg/answer', { id, wait: a.wait_seconds ?? 50 });
    return r.answer != null ? `Respuesta del usuario: ${r.answer}` : `Pregunta #${id} enviada; el usuario aún no ha respondido. Llama a wait_for_reply con id "${id}" para seguir esperando, o continúa con otra cosa y vuelve a mirar más tarde.`;
  }
  if (name === 'read_messages') {
    const r = await hub('/agent/msg/inbox', {});
    if (!r.items.length) return 'No hay mensajes nuevos.';
    return r.items.map((m) => `[${new Date(m.at).toLocaleString('es-ES')} · ${m.channel}] ${m.text}`).join('\n');
  }
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
        serverInfo: { name: 'mcp-hub-messaging', version: '1.0.0' },
        instructions: 'Mensajería con el usuario (Telegram/email/Discord/Slack). Usa send_message para avisos importantes y ask_user cuando necesites una decisión suya y no esté delante. No abuses: nada de mensajes por cada paso.',
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
