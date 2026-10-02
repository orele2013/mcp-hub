// Adaptadores: leen/escriben la configuración MCP nativa de cada agente.
// Formato interno de un servidor:
//   { transport: 'stdio', command, args: [], env: {} }
//   { transport: 'http' | 'sse', url, headers: {} }
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parse as parseToml } from 'smol-toml';

const run = promisify(execFile);
const HOME = os.homedir();

export function which(bin) {
  for (const dir of (process.env.PATH || '').split(':')) {
    const p = path.join(dir, bin);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch {}
  }
  return null;
}

function readJson(file, fallback = {}) {
  try {
    const txt = fs.readFileSync(file, 'utf8');
    try { return JSON.parse(txt); } catch { return JSON.parse(stripJsonc(txt)); }
  } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw new Error(`No se pudo leer ${file}: ${e.message}`);
  }
}

function stripJsonc(txt) {
  let out = '', inStr = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i], n = txt[i + 1];
    if (inStr) { out += c; if (c === '\\') out += txt[++i]; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '/' && n === '/') { while (i < txt.length && txt[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < txt.length && !(txt[i] === '*' && txt[i + 1] === '/')) i++; i++; continue; }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

const backedUp = new Set();
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!backedUp.has(file) && fs.existsSync(file)) {
    fs.copyFileSync(file, file + '.mcp-hub.bak');
    backedUp.add(file);
  }
  const tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null));

// ---------- Claude Code ----------
const claude = {
  id: 'claude', name: 'Claude Code', bin: 'claude',
  install: 'npm install -g @anthropic-ai/claude-code',
  login: ['claude', 'auth', 'login'], status: ['claude', 'auth', 'status'], plan: 'Claude Pro / Max',
  apiEnv: ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX'],
  file: path.join(HOME, '.claude.json'),
  read() {
    const d = readJson(this.file);
    const out = {};
    for (const [name, s] of Object.entries(d.mcpServers || {})) {
      if (s.url) out[name] = { transport: s.type === 'sse' ? 'sse' : 'http', url: s.url, headers: s.headers || {} };
      else out[name] = { transport: 'stdio', command: s.command, args: s.args || [], env: s.env || {} };
    }
    return out;
  },
  native(spec) {
    return spec.transport === 'stdio'
      ? { type: 'stdio', command: spec.command, args: spec.args || [], env: spec.env || {} }
      : { type: spec.transport, url: spec.url, headers: spec.headers || {} };
  },
  async add(name, spec) {
    await this.remove(name).catch(() => {});
    await run('claude', ['mcp', 'add-json', '-s', 'user', name, JSON.stringify(this.native(spec))]);
  },
  async remove(name) {
    await run('claude', ['mcp', 'remove', '-s', 'user', name]);
  },
  // Sesión con sólo los MCP elegidos
  strictLaunch(selected, runDir) {
    const file = path.join(runDir, `claude-${Date.now()}.json`);
    const mcpServers = Object.fromEntries(Object.entries(selected).map(([n, s]) => [n, this.native(s)]));
    fs.writeFileSync(file, JSON.stringify({ mcpServers }, null, 2), { mode: 0o600 });
    return { args: ['--mcp-config', file, '--strict-mcp-config'], env: {}, file };
  },
};

// ---------- Codex ----------
const tomlStr = (s) => JSON.stringify(String(s));
const tomlKey = (k) => (/^[A-Za-z0-9_-]+$/.test(k) ? k : tomlStr(k));
function tomlInline(v) {
  if (Array.isArray(v)) return '[' + v.map(tomlInline).join(', ') + ']';
  if (v && typeof v === 'object') return '{' + Object.entries(v).map(([k, x]) => `${tomlKey(k)} = ${tomlInline(x)}`).join(', ') + '}';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  return tomlStr(v);
}

const codex = {
  id: 'codex', name: 'Codex', bin: 'codex',
  install: 'npm install -g @openai/codex',
  login: ['codex', 'login'], status: ['codex', 'login', 'status'], plan: 'ChatGPT Plus / Pro',
  apiEnv: ['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'CODEX_API_KEY'],
  file: path.join(HOME, '.codex', 'config.toml'),
  read() {
    let d;
    try { d = parseToml(fs.readFileSync(this.file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return {}; throw e; }
    const out = {};
    for (const [name, s] of Object.entries(d.mcp_servers || {})) {
      if (s.url) out[name] = { transport: 'http', url: s.url, headers: s.http_headers || {} };
      else out[name] = { transport: 'stdio', command: s.command, args: s.args || [], env: s.env || {} };
      if (s.enabled === false) out[name].disabled = true;
    }
    return out;
  },
  native(spec) {
    return spec.transport === 'stdio'
      ? clean({ command: spec.command, args: spec.args || [], env: Object.keys(spec.env || {}).length ? spec.env : undefined })
      : clean({ url: spec.url, http_headers: Object.keys(spec.headers || {}).length ? spec.headers : undefined });
  },
  async add(name, spec) {
    await this.remove(name).catch(() => {});
    if (spec.transport === 'stdio') {
      const envArgs = Object.entries(spec.env || {}).flatMap(([k, v]) => ['--env', `${k}=${v}`]);
      await run('codex', ['mcp', 'add', name, ...envArgs, '--', spec.command, ...(spec.args || [])]);
    } else {
      await run('codex', ['mcp', 'add', name, '--url', spec.url]);
      const h = Object.entries(spec.headers || {});
      if (h.length) {
        // la CLI no acepta cabeceras: se añade la subtabla al final del TOML
        const block = `\n[mcp_servers.${tomlKey(name)}.http_headers]\n` + h.map(([k, v]) => `${tomlKey(k)} = ${tomlStr(v)}`).join('\n') + '\n';
        fs.appendFileSync(this.file, block);
      }
    }
  },
  async remove(name) {
    await run('codex', ['mcp', 'remove', name]);
  },
  strictLaunch(selected) {
    const args = [];
    for (const name of Object.keys(this.read())) {
      if (!selected[name]) args.push('-c', `mcp_servers.${name}.enabled=false`);
    }
    for (const [name, s] of Object.entries(selected)) {
      args.push('-c', `mcp_servers.${name}=${tomlInline({ ...this.native(s), enabled: true })}`);
    }
    return { args, env: {} };
  },
};

// ---------- OpenCode ----------
const opencodeFile = () => {
  const dir = path.join(HOME, '.config', 'opencode');
  for (const f of ['opencode.json', 'opencode.jsonc', 'config.json']) if (fs.existsSync(path.join(dir, f))) return path.join(dir, f);
  return path.join(dir, 'opencode.json');
};
const opencode = {
  id: 'opencode', name: 'OpenCode', bin: 'opencode',
  install: 'npm install -g opencode-ai',
  login: ['opencode', 'auth', 'login'], status: ['opencode', 'auth', 'list'], plan: 'ChatGPT, Copilot, OpenCode Zen…',
  apiEnv: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  get file() { return opencodeFile(); },
  read() {
    const out = {};
    for (const [name, s] of Object.entries(readJson(this.file).mcp || {})) {
      if (s.type === 'remote') out[name] = { transport: 'http', url: s.url, headers: s.headers || {} };
      else out[name] = { transport: 'stdio', command: (s.command || [])[0], args: (s.command || []).slice(1), env: s.environment || {} };
      if (s.enabled === false) out[name].disabled = true;
    }
    return out;
  },
  native(spec) {
    return spec.transport === 'stdio'
      ? clean({ type: 'local', enabled: true, command: [spec.command, ...(spec.args || [])], environment: Object.keys(spec.env || {}).length ? spec.env : undefined })
      : clean({ type: 'remote', enabled: true, url: spec.url, headers: Object.keys(spec.headers || {}).length ? spec.headers : undefined });
  },
  async add(name, spec) {
    const d = readJson(this.file, { $schema: 'https://opencode.ai/config.json' });
    d.mcp = { ...(d.mcp || {}), [name]: this.native(spec) };
    writeJson(this.file, d);
  },
  async remove(name) {
    const d = readJson(this.file);
    if (d.mcp && d.mcp[name]) { delete d.mcp[name]; writeJson(this.file, d); }
  },
  strictLaunch(selected, _runDir, ctx) {
    const mcp = {};
    for (const [name, s] of Object.entries(this.read())) mcp[name] = { ...this.native(s), enabled: false };
    for (const [name, s] of Object.entries(selected)) mcp[name] = this.native(s);
    ctx.ocConfig.mcp = mcp;
    return { args: [], env: {} };
  },
};

// ---------- Gemini CLI ----------
const gemini = {
  id: 'gemini', name: 'Gemini CLI', bin: 'gemini',
  install: 'npm install -g @google/gemini-cli',
  login: ['gemini'], status: null, plan: 'Cuenta de Google',
  apiEnv: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_USE_VERTEXAI'],
  file: path.join(HOME, '.gemini', 'settings.json'),
  read() {
    const out = {};
    for (const [name, s] of Object.entries(readJson(this.file).mcpServers || {})) {
      if (s.httpUrl) out[name] = { transport: 'http', url: s.httpUrl, headers: s.headers || {} };
      else if (s.url) out[name] = { transport: s.type === 'http' ? 'http' : 'sse', url: s.url, headers: s.headers || {} };
      else out[name] = { transport: 'stdio', command: s.command, args: s.args || [], env: s.env || {} };
    }
    return out;
  },
  native(spec) {
    if (spec.transport === 'stdio') return clean({ command: spec.command, args: spec.args || [], env: Object.keys(spec.env || {}).length ? spec.env : undefined });
    const h = Object.keys(spec.headers || {}).length ? spec.headers : undefined;
    return spec.transport === 'http' ? clean({ httpUrl: spec.url, headers: h }) : clean({ url: spec.url, headers: h });
  },
  async add(name, spec) {
    const d = readJson(this.file);
    d.mcpServers = { ...(d.mcpServers || {}), [name]: this.native(spec) };
    writeJson(this.file, d);
  },
  async remove(name) {
    const d = readJson(this.file);
    if (d.mcpServers && d.mcpServers[name]) { delete d.mcpServers[name]; writeJson(this.file, d); }
  },
  // Gemini sólo puede filtrar entre los que ya tiene configurados
  strictLaunch(selected) {
    const names = Object.keys(selected).filter((n) => this.read()[n]);
    return { args: ['--allowed-mcp-server-names', names.length ? names.join(',') : '__none__'], env: {} };
  },
};

// ---------- Cursor Agent ----------
const cursor = {
  id: 'cursor', name: 'Cursor Agent', bin: 'cursor-agent',
  install: 'curl https://cursor.com/install -fsS | bash',
  login: ['cursor-agent', 'login'], status: ['cursor-agent', 'status'], plan: 'Cursor Pro',
  apiEnv: ['CURSOR_API_KEY'],
  file: path.join(HOME, '.cursor', 'mcp.json'),
  read() {
    const out = {};
    for (const [name, s] of Object.entries(readJson(this.file).mcpServers || {})) {
      if (s.url) out[name] = { transport: 'http', url: s.url, headers: s.headers || {} };
      else out[name] = { transport: 'stdio', command: s.command, args: s.args || [], env: s.env || {} };
    }
    return out;
  },
  native(spec) {
    return spec.transport === 'stdio'
      ? clean({ command: spec.command, args: spec.args || [], env: Object.keys(spec.env || {}).length ? spec.env : undefined })
      : clean({ url: spec.url, headers: Object.keys(spec.headers || {}).length ? spec.headers : undefined });
  },
  async add(name, spec) {
    const d = readJson(this.file);
    d.mcpServers = { ...(d.mcpServers || {}), [name]: this.native(spec) };
    writeJson(this.file, d);
  },
  async remove(name) {
    const d = readJson(this.file);
    if (d.mcpServers && d.mcpServers[name]) { delete d.mcpServers[name]; writeJson(this.file, d); }
  },
  strictLaunch: null,
};

export const CLIENTS = { claude, codex, opencode, gemini, cursor };

const versionCache = {};
export async function clientInfo(c) {
  const binPath = which(c.bin);
  let version = null;
  if (binPath) {
    if (!(c.id in versionCache)) {
      versionCache[c.id] = await run(binPath, ['--version'], { timeout: 8000 })
        .then((r) => r.stdout.trim().split('\n')[0]).catch(() => '');
    }
    version = versionCache[c.id];
  }
  let servers = {}, error = null;
  try { servers = c.read(); } catch (e) { error = e.message; }
  return { id: c.id, name: c.name, bin: c.bin, installed: !!binPath, version, install: c.install,
    configFile: c.file, servers, error, strict: !!c.strictLaunch, plan: c.plan, canLogin: !!c.login };
}

export const sameSpec = (a, b) => {
  if (!a || !b || a.transport !== b.transport) return false;
  const norm = (s) => JSON.stringify(s.transport === 'stdio'
    ? [s.command, s.args || [], Object.entries(s.env || {}).sort()]
    : [s.url, Object.entries(s.headers || {}).sort()]);
  return norm(a) === norm(b);
};
