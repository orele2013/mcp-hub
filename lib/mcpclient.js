// Cliente MCP genérico (stdio y HTTP "streamable") para explorar servidores: herramientas, recursos y prompts,
// llamar herramientas con argumentos y medir tiempos. Lo usan el Explorador, el panel de salud y las pruebas de compatibilidad.
import { spawn } from 'node:child_process';

const PROTOCOL = '2025-06-18';
const CLIENT = { name: 'mcp-hub', version: '1.1.0' };

export class McpSession {
  constructor(spec, { timeoutMs = 60000 } = {}) {
    this.spec = spec; this.timeoutMs = timeoutMs; this.nextId = 1; this.pending = new Map(); this.stderr = '';
  }
  async open() {
    const t0 = Date.now();
    if (this.spec.transport === 'stdio') this.openStdio();
    else if (this.spec.transport === 'sse') throw new Error('Los servidores SSE (legacy) no se pueden explorar desde aquí; usa el agente.');
    const init = await this.request('initialize', { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: CLIENT });
    this.notify('notifications/initialized');
    this.info = { serverInfo: init.serverInfo || null, protocolVersion: init.protocolVersion || null, capabilities: init.capabilities || {}, instructions: init.instructions || '' };
    this.info.connectMs = Date.now() - t0;
    return this.info;
  }
  openStdio() {
    const s = this.spec;
    this.child = spawn(s.command, s.args || [], { env: { ...process.env, ...(s.env || {}) }, stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '';
    this.child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let m; try { m = JSON.parse(line); } catch { continue; }
        this.dispatch(m);
      }
    });
    this.child.stderr.on('data', (d) => { this.stderr = (this.stderr + d).slice(-4000); });
    const fail = (msg) => { for (const p of this.pending.values()) p.reject(new Error(msg)); this.pending.clear(); this.closed = true; };
    this.child.on('error', (e) => fail(e.code === 'ENOENT' ? `Comando no encontrado: ${s.command}` : e.message));
    this.child.on('exit', (code) => fail(`El proceso del servidor terminó (código ${code})${this.stderr ? ': ' + this.stderr.trim().split('\n').slice(-3).join(' ') : ''}`));
  }
  dispatch(m) {
    if (m.id != null && this.pending.has(m.id) && (m.result !== undefined || m.error)) {
      const p = this.pending.get(m.id); this.pending.delete(m.id);
      if (m.error) p.reject(Object.assign(new Error(m.error.message || 'Error del servidor'), { code: m.error.code }));
      else p.resolve(m.result);
    } else if (m.id != null && m.method) {
      // Peticiones del servidor al cliente (sampling, roots…): no se soportan, se responde con error
      this.write({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'No soportado por MCP Hub' } });
    }
  }
  write(m) { if (this.child) this.child.stdin.write(JSON.stringify(m) + '\n'); }
  notify(method, params) {
    const m = { jsonrpc: '2.0', method, ...(params ? { params } : {}) };
    if (this.child) this.write(m); else this.http(m).catch(() => {});
  }
  request(method, params = {}) {
    const id = this.nextId++;
    const msg = { jsonrpc: '2.0', id, method, params };
    if (!this.child) return this.http(msg).then((r) => { if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code }); return r.result; });
    if (this.closed) return Promise.reject(new Error('El servidor está cerrado'));
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.pending.delete(id); reject(new Error(`Sin respuesta a ${method} tras ${this.timeoutMs / 1000}s`)); }, this.timeoutMs);
      this.pending.set(id, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
      this.write(msg);
    });
  }
  async http(body) {
    const res = await fetch(this.spec.url, {
      method: 'POST', signal: AbortSignal.timeout(this.timeoutMs),
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': PROTOCOL,
        ...(this.session ? { 'mcp-session-id': this.session } : {}), ...(this.spec.headers || {}) },
      body: JSON.stringify(body),
    });
    this.session = res.headers.get('mcp-session-id') || this.session;
    if (res.status === 401 || res.status === 403) throw Object.assign(new Error(`HTTP ${res.status}: el servidor pide autenticación (OAuth o token). Configúrala en las cabeceras o inicia sesión desde un agente.`), { auth: true });
    if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    if (body.id === undefined) return null;
    const txt = await res.text();
    if ((res.headers.get('content-type') || '').includes('text/event-stream')) {
      for (const chunk of txt.split(/\n\n/)) {
        const data = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
        if (!data) continue;
        try { const m = JSON.parse(data); if (m.id === body.id) return m; } catch {}
      }
      throw new Error('Respuesta SSE sin resultado');
    }
    return JSON.parse(txt);
  }
  async list(kind) {
    const methods = { tools: 'tools/list', resources: 'resources/list', templates: 'resources/templates/list', prompts: 'prompts/list' };
    const key = { tools: 'tools', resources: 'resources', templates: 'resourceTemplates', prompts: 'prompts' }[kind];
    const out = [];
    let cursor;
    for (let page = 0; page < 20; page++) {
      const r = await this.request(methods[kind], cursor ? { cursor } : {});
      out.push(...(r[key] || []));
      cursor = r.nextCursor; if (!cursor) break;
    }
    return out;
  }
  async timed(fn) { const t0 = Date.now(); const result = await fn(); return { result, ms: Date.now() - t0 }; }
  close() {
    if (this.child) { try { this.child.stdin.end(); this.child.kill('SIGTERM'); } catch {} setTimeout(() => { try { this.child.kill('SIGKILL'); } catch {} }, 2000); }
    else if (this.session) fetch(this.spec.url, { method: 'DELETE', headers: { 'mcp-session-id': this.session, ...(this.spec.headers || {}) } }).catch(() => {});
    this.closed = true;
  }
}

// Exploración completa: información, herramientas, recursos, prompts y comprobaciones de compatibilidad
export async function explore(spec) {
  const s = new McpSession(spec);
  const out = { ok: false };
  try {
    out.info = await s.open();
    const caps = out.info.capabilities || {};
    const safe = async (kind) => { try { return await s.list(kind); } catch (e) { return { error: e.message }; } };
    out.tools = caps.tools ? await safe('tools') : [];
    out.resources = caps.resources ? await safe('resources') : [];
    out.templates = caps.resources ? await safe('templates') : [];
    out.prompts = caps.prompts ? await safe('prompts') : [];
    out.checks = compatibility(out);
    out.ok = true;
  } catch (e) { out.error = e.message; out.auth = !!e.auth; out.stderr = s.stderr.slice(-1500); }
  finally { s.close(); }
  return out;
}

export async function callTool(spec, name, args) {
  const s = new McpSession(spec, { timeoutMs: 120000 });
  try {
    await s.open();
    const { result, ms } = await s.timed(() => s.request('tools/call', { name, arguments: args || {} }));
    return { ok: true, ms, result };
  } catch (e) { return { ok: false, error: e.message, stderr: s.stderr.slice(-1500) }; }
  finally { s.close(); }
}
export async function readResource(spec, uri) {
  const s = new McpSession(spec);
  try { await s.open(); const { result, ms } = await s.timed(() => s.request('resources/read', { uri })); return { ok: true, ms, result }; }
  catch (e) { return { ok: false, error: e.message }; } finally { s.close(); }
}
export async function getPrompt(spec, name, args) {
  const s = new McpSession(spec);
  try { await s.open(); const { result, ms } = await s.timed(() => s.request('prompts/get', { name, arguments: args || {} })); return { ok: true, ms, result }; }
  catch (e) { return { ok: false, error: e.message }; } finally { s.close(); }
}

// Comprobaciones de compatibilidad con los clientes (no garantizan que funcione: señalan problemas conocidos)
const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05'];
export function compatibility(x) {
  const c = [];
  const add = (level, text) => c.push({ level, text });
  const pv = x.info?.protocolVersion;
  if (!pv) add('warn', 'El servidor no indica la versión del protocolo.');
  else if (!SUPPORTED.includes(pv)) add('warn', `Versión de protocolo ${pv}: no es una de las conocidas (${SUPPORTED.join(', ')}).`);
  else add('ok', `Protocolo ${pv}.`);
  const caps = x.info?.capabilities || {};
  if (!caps.tools && !caps.resources && !caps.prompts) add('warn', 'No declara capacidades (tools, resources ni prompts).');
  if (Array.isArray(x.tools)) {
    const names = new Set();
    for (const t of x.tools) {
      if (names.has(t.name)) add('error', `Herramienta duplicada: ${t.name}.`);
      names.add(t.name);
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(t.name)) add('warn', `“${t.name}”: el nombre tiene caracteres o longitud que algunos clientes (Claude, OpenAI, Gemini) rechazan (permitido: letras, números, _ y -, hasta 64).`);
      if (!t.description) add('warn', `“${t.name}” no tiene descripción: los agentes no sabrán cuándo usarla.`);
      const sc = t.inputSchema;
      if (!sc || sc.type !== 'object') add('error', `“${t.name}”: inputSchema debe ser un objeto JSON Schema con "type": "object".`);
      else {
        const txt = JSON.stringify(sc);
        if (/"\$ref"|"\$defs"|"definitions"/.test(txt)) add('warn', `“${t.name}” usa $ref/$defs: algunos clientes (p. ej. Gemini) no los resuelven.`);
        if (/"(oneOf|anyOf|allOf)"/.test(txt)) add('info', `“${t.name}” usa oneOf/anyOf/allOf: el soporte varía entre clientes.`);
        if (txt.length > 20000) add('warn', `“${t.name}” tiene un esquema muy grande (${Math.round(txt.length / 1000)} KB): ocupa mucho contexto.`);
      }
    }
    if (x.tools.length > 60) add('warn', `${x.tools.length} herramientas: muchos clientes limitan o degradan con tantas (ocupan contexto).`);
    if (x.tools.length) add('ok', `${x.tools.length} herramienta(s) con esquemas válidos${c.some((k) => k.level === 'error') ? ' salvo los errores indicados' : ''}.`);
  } else if (x.tools?.error) add('error', `tools/list falló: ${x.tools.error}`);
  if (caps.tools && Array.isArray(x.tools) && !x.tools.length) add('info', 'Declara herramientas pero no lista ninguna.');
  return c;
}
