#!/usr/bin/env node
// MCP Hub: gestiona servidores MCP para todos tus agentes y los abre en terminales integradas.
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import selfsigned from 'selfsigned';
import pty from 'node-pty';
import { IS_WIN, ensurePtyHelper, commandLine, terminalShell, openExternalTerminal, openPath, nodeRuntime, expandHome as expandHomeP, dataDir, which as whichP } from './lib/platform.js';
ensurePtyHelper();
// Un error suelto (p. ej. un corte de red en un canal de mensajería) se registra, pero no cierra el servidor ni las terminales
process.on('uncaughtException', (e) => console.error('[error no capturado]', e));
process.on('unhandledRejection', (e) => console.error('[promesa rechazada]', e));

// Cuando se lanza desde el menú de apps el PATH es mínimo: usar el de la shell de login.
if (!IS_WIN) try {
  const shellPath = execFileSync(process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash'), ['-lc', 'printf %s "$PATH"'], { timeout: 5000 }).toString();
  if (shellPath) process.env.PATH = shellPath;
} catch {}

const { CLIENTS, clientInfo, sameSpec, which } = await import('./lib/clients.js');
const { CATALOG, fillSpec } = await import('./lib/catalog.js');
const { probe } = await import('./lib/probe.js');
const mcpc = await import('./lib/mcpclient.js');
const { reviewSpec } = await import('./lib/review.js');
const { PROVIDER_PRESETS, compatible, providerLaunch, listModels } = await import('./lib/providers.js');
const { Vault, connectionString } = await import('./lib/vault.js');
const skills = await import('./lib/skills.js');
const { ProjectProfiles } = await import('./lib/project-profiles.js');
const QRCode = (await import('qrcode')).default;
const { Messenger } = await import('./lib/messaging.js');
const { Designer } = await import('./lib/design.js');
const { Terminal: HeadlessTerminal } = (await import('@xterm/headless')).default;

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();
const PORT = Number(process.env.MCP_HUB_PORT || 7777);
const CONF_DIR = path.join(HOME, '.config', 'mcp-hub');
const STORE = path.join(CONF_DIR, 'servers.json');
const RUN_DIR = path.join(CONF_DIR, 'run');
fs.mkdirSync(RUN_DIR, { recursive: true, mode: 0o700 });
// Token de la interfaz: persistente para que las ventanas abiertas sigan funcionando tras reiniciar el servidor
const TOKEN_FILE = path.join(CONF_DIR, 'ui-token');
let TOKEN;
try { TOKEN = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch {}
if (!TOKEN) { TOKEN = crypto.randomBytes(24).toString('hex'); fs.writeFileSync(TOKEN_FILE, TOKEN, { mode: 0o600 }); }
for (const f of fs.readdirSync(RUN_DIR)) fs.rmSync(path.join(RUN_DIR, f), { force: true });
const vault = new Vault(CONF_DIR);
const projectProfiles = new ProjectProfiles(CONF_DIR);
// Token para el servidor MCP de la bóveda (persistente, solo legible por el usuario)
const AGENT_TOKEN_FILE = path.join(CONF_DIR, 'agent-token');
let AGENT_TOKEN;
try { AGENT_TOKEN = fs.readFileSync(AGENT_TOKEN_FILE, 'utf8').trim(); } catch {}
if (!AGENT_TOKEN) { AGENT_TOKEN = crypto.randomBytes(24).toString('hex'); fs.writeFileSync(AGENT_TOKEN_FILE, AGENT_TOKEN, { mode: 0o600 }); }
const vaultStatus = () => ({ exists: vault.exists(), unlocked: vault.unlocked, remembered: vault.remembered });
const VAULT_SERVER = 'mcp-hub-vault';
const MSG_SERVER = 'mcp-hub-messaging';
const AGENTS_SERVER = 'mcp-hub-agents';
const DESIGN_SERVER = 'mcp-hub-design';
const EXTRAS_SERVER = 'mcp-hub-extras';

// ---------------- Registro ----------------
function load() {
  try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); } catch { return { servers: {}, recentDirs: [] }; }
}
let db = load();
db.servers ||= {}; db.recentDirs ||= []; db.providers ||= {}; db.messaging ||= {}; db.remote ||= { lan: false, tailscale: false }; db.devices ||= {};
function save() {
  fs.writeFileSync(STORE + '.tmp', JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(STORE + '.tmp', STORE);
}
const specOf = (s) => (s.transport === 'stdio'
  ? { transport: 'stdio', command: s.command, args: s.args || [], env: s.env || {} }
  : { transport: s.transport, url: s.url, headers: s.headers || {} });

function validName(n) { return /^[A-Za-z0-9_.-]{1,64}$/.test(n); }

// Aplica el servidor `name` a un cliente según su "target"
async function applyTo(clientId, name, { remove = true } = {}) {
  const c = CLIENTS[clientId];
  const s = db.servers[name];
  const current = c.read()[name];
  if (s && s.targets?.[clientId]) {
    if (!sameSpec(current, specOf(s)) || current?.disabled) await c.add(name, specOf(s));
  } else if (current && remove) {
    await c.remove(name);
  }
}
async function applyAll(name, onlyClients, opts) {
  const errors = {};
  for (const id of onlyClients || Object.keys(CLIENTS)) {
    try { await applyTo(id, name, opts); } catch (e) { errors[id] = (e.stderr || e.message || String(e)).toString().trim().slice(0, 400); }
  }
  return errors;
}

async function state() {
  const clients = await Promise.all(Object.values(CLIENTS).map(clientInfo));
  const external = [];
  for (const c of clients) for (const n of Object.keys(c.servers)) if (!db.servers[n]) external.push({ client: c.id, name: n });
  const providers = Object.fromEntries(Object.entries(db.providers).map(([id, p]) => [id, { ...p, apiKey: p.apiKey ? '••••' + p.apiKey.slice(-4) : '',
    compatible: Object.keys(CLIENTS).filter((c) => compatible(c, p)) }]));
  return { servers: db.servers, clients, catalog: CATALOG, external, recentDirs: db.recentDirs, home: HOME,
    providers, presets: PROVIDER_PRESETS, vault: { ...vaultStatus(), env: vault.unlocked ? vault.list().filter((i) => i.envVar && i.hasSecret).map((i) => ({ id: i.id, name: i.name, envVar: i.envVar, service: i.service, type: i.type })) : [] },
    projectProfiles: projectProfiles.list(), projectProfilesError: projectProfiles.loadError || null,
    sessions: [...sessions.values()].map(sessionInfo) };
}

async function importFromClients() {
  let added = 0;
  for (const c of Object.values(CLIENTS)) {
    let servers; try { servers = c.read(); } catch { continue; }
    for (const [name, spec] of Object.entries(servers)) {
      const clean = specOf(spec);
      if (!db.servers[name]) {
        db.servers[name] = { ...clean, description: `Importado de ${c.name}`, targets: {} };
        added++;
      }
      if (sameSpec(specOf(db.servers[name]), clean) || !Object.values(db.servers[name].targets).some(Boolean)) {
        db.servers[name].targets[c.id] = true;
      }
    }
  }
  save();
  return added;
}

// ---------------- Terminales ----------------
const sessions = new Map();
const sessionInfo = (s) => ({ id: s.id, title: s.title, client: s.client, cwd: s.cwd, exited: s.exited, exitCode: s.exitCode, created: s.created,
  account: s.account, mcps: s.mcps, opts: s.opts, secrets: s.secrets, job: s.job });

function sessionMeta(opts) {
  const c = CLIENTS[opts.client];
  if (!c || opts.install || opts.login || opts.delegate) return { account: null, mcps: [] };
  const acc = opts.account || 'subscription';
  const account = acc === 'subscription' ? 'Suscripción' : acc === 'default' ? 'Configuración del agente'
    : `API · ${db.providers[acc.slice(9)]?.name || '?'}${opts.model ? ' · ' + opts.model : ''}`;
  let mcps = [];
  try { mcps = opts.mode === 'selected' && c.strictLaunch ? (opts.mcps || []) : Object.keys(c.read()); } catch {}
  return { account, mcps };
}
const shq = (a) => (/^[A-Za-z0-9_\/.,:=@%+-]+$/.test(a) ? a : `'${String(a).replace(/'/g, `'\\''`)}'`);
const expandHome = expandHomeP;

// Scripts auxiliares (MCPs propios, delegate-run…) en una carpeta fija: la app instalada puede moverse
// (la AppImage se monta en una ruta distinta cada vez), y los agentes guardan la ruta en su configuración.
const RUNTIME_DIR = path.join(dataDir(), 'runtime');
const RUNTIME_FILES = ['agents-mcp.js', 'approvals-mcp.js', 'design-mcp.js', 'extras-mcp.js', 'messaging-mcp.js', 'vault-mcp.js', 'delegate-run.js', 'bin/design-shot.mjs', 'lib/platform.js'];
function installRuntime() {
  for (const f of RUNTIME_FILES) {
    const dst = path.join(RUNTIME_DIR, f);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), dst);
  }
  fs.writeFileSync(path.join(RUNTIME_DIR, 'package.json'), '{"type":"module"}\n');
}
installRuntime();
const runtimeScript = (f) => path.join(RUNTIME_DIR, f);
// Spec de un MCP propio de MCP Hub: Node (del sistema o el de la app) + script en la carpeta fija
const hubScript = (f) => { const rt = nodeRuntime(); return { command: rt.command, args: [runtimeScript(f)], env: { ...rt.env } }; };

// Variables del entorno padre que no deben filtrarse a los agentes (p.ej. si MCP Hub se lanzó desde Claude Code)
const INHERITED_JUNK = /^(CLAUDECODE|CLAUDE_CODE_.*|CLAUDE_PID|CLAUDE_EFFORT|CODEX_SANDBOX.*|MCP_HUB_PROVIDER_KEY)$/;

// account: 'subscription' (login de la cuenta, sin API keys) | 'default' (tal cual) | 'provider:<id>'
function buildLaunch(opts) {
  const { client, mode, mcps, extraArgs, install, login, account = 'subscription', model, secrets } = opts;
  const env = {}, unset = [], files = [];
  const ctx = { ocConfig: {} };
  for (const id of secrets || []) {
    const it = vault.get(id);
    if (it.envVar && it.secret) { env[it.envVar] = it.secret; vault.record({ client: client === 'shell' ? 'Shell' : CLIENTS[client]?.name || client, item: it.name, action: `variable ${it.envVar}` }); }
  }
  if (client === 'shell') return { cmd: null, env, unset, title: 'Shell' };
  const c = CLIENTS[client];
  if (!c) throw new Error('Agente desconocido');
  if (opts.delegate) {
    const d = opts.delegate;
    const rt = nodeRuntime();
    return { cmd: commandLine([rt.command, runtimeScript('delegate-run.js'), d.file]),
      env: { MCP_HUB_DEPTH: String(d.depth), ...rt.env }, unset: [], files: [d.file], title: `↳ ${c.name}` };
  }
  if (install) return { cmd: c.install, env, unset, title: `Instalar ${c.name}` };
  if (login) {
    unset.push(...c.apiEnv);
    return { cmd: commandLine(c.login), env, unset, title: `Login ${c.name}` };
  }
  const args = [];
  if (account === 'subscription') {
    unset.push(...c.apiEnv);
    if (client === 'codex') args.push('-c', 'forced_login_method="chatgpt"');
  } else if (account.startsWith('provider:')) {
    const pid = account.slice(9), p = db.providers[pid];
    if (!p) throw new Error('Proveedor no encontrado');
    if (!compatible(client, p)) throw new Error(`${p.name} no es compatible con ${c.name}`);
    unset.push(...c.apiEnv);
    const r = providerLaunch(client, pid, p, model || p.defaultModel, ctx);
    args.push(...r.args); Object.assign(env, r.env); unset.push(...r.unset);
  }
  if (mode === 'selected' && c.strictLaunch) {
    const sel = Object.fromEntries((mcps || []).filter((n) => db.servers[n]).map((n) => [n, specOf(db.servers[n])]));
    const r = c.strictLaunch(sel, RUN_DIR, ctx);
    if (r.file) files.push(r.file);
    args.push(...r.args); Object.assign(env, r.env);
  }
  if (Object.keys(ctx.ocConfig).length) {
    const file = path.join(RUN_DIR, `opencode-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify({ $schema: 'https://opencode.ai/config.json', ...ctx.ocConfig }, null, 2), { mode: 0o600 });
    env.OPENCODE_CONFIG = file;
    files.push(file);
  }
  if (opts.continueLast) {
    // Retoma la conversación más reciente del agente en esa carpeta
    if (client === 'codex') args.unshift('resume', '--last');
    else args.push(...({ claude: ['--continue'], opencode: ['--continue'], gemini: ['--resume', 'latest'], cursor: ['--continue'] }[client] || []));
  }
  if (opts.initialPrompt) {
    const ip = String(opts.initialPrompt);
    args.push(...({ claude: [ip], codex: [ip], opencode: ['--prompt', ip], gemini: ['-i', ip], cursor: [ip] }[client] || []));
  }
  const extra = (extraArgs || '').match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  args.push(...extra.map((a) => a.replace(/^["'](.*)["']$/, '$1')));
  const label = account.startsWith('provider:') ? ` · ${db.providers[account.slice(9)].name}` : '';
  return { cmd: commandLine([c.bin, ...args]), env, unset, files, title: c.name + label };
}

function childEnv(env, unset) {
  const out = {};
  for (const [k, v] of Object.entries(process.env)) if (!INHERITED_JUNK.test(k) && !unset.includes(k)) out[k] = v;
  // `unset` también se aplica dentro de la shell de login, por si el .bashrc exporta las keys
  return { ...out, ...env, TERM: 'xterm-256color', COLORTERM: 'truecolor', MCP_HUB: '1' };
}

function createSession(opts) {
  const cwd = expandHome(opts.cwd);
  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error(`La carpeta no existe: ${cwd}`);
  const { cmd: rawCmd, env, unset, title, files = [] } = buildLaunch(opts);
  const sh = terminalShell();
  const id = crypto.randomUUID().slice(0, 8);
  const baseEnv = { ...childEnv(env, unset), MCP_HUB_SESSION: id };
  // En Linux/macOS también se quitan dentro de la shell de login, por si el .bashrc/.zshrc las exporta
  const cmd = rawCmd && unset.length && !IS_WIN ? `unset ${unset.join(' ')}; ${rawCmd}` : rawCmd;

  if (opts.external) {
    openExternalTerminal(cwd, cmd, baseEnv);
    rememberDir(cwd);
    return null;
  }

  const p = pty.spawn(sh.file, sh.args(cmd), { name: 'xterm-256color', cols: opts.cols || 120, rows: opts.rows || 32, cwd, env: baseEnv, useConpty: true });
  const { client, mode, mcps, extraArgs, account, model, secrets } = opts;
  const s = { id, title: `${title} · ${path.basename(cwd) || '/'}`, client: opts.client, cwd, pty: p, buf: '', sockets: new Set(),
    ...sessionMeta(opts), job: opts.delegate?.id || null, opts: opts.install || opts.login || opts.delegate ? null : { client, cwd, mode, mcps, extraArgs, account, model, secrets, profileId: opts.profileId || null },
    secrets: (secrets || []).map((id) => { try { const it = vault.get(id); return { name: it.name, envVar: it.envVar }; } catch { return null; } }).filter(Boolean),
    exited: false, exitCode: null, created: Date.now() };
  p.onData((d) => {
    s.buf += d;
    if (s.buf.length > 400_000) s.buf = s.buf.slice(-300_000);
    for (const ws of s.sockets) ws.send(d);
  });
  p.onExit(({ exitCode }) => {
    s.exited = true; s.exitCode = exitCode;
    for (const f of files) fs.rm(f, { force: true }, () => {});
    const msg = `\r\n\x1b[2m[proceso terminado · código ${exitCode}]\x1b[0m\r\n`;
    s.buf += msg;
    for (const ws of s.sockets) { ws.send(msg); ws.send(JSON.stringify({ t: 'exit', code: exitCode })); }
    broadcast();
    if (!s.job) messenger.sessionExited(sessionInfo(s));
    if (s.job) jobsMgr.finished(s.job, exitCode);
  });
  sessions.set(id, s);
  rememberDir(cwd);
  broadcast();
  return sessionInfo(s);
}
function rememberDir(d) {
  db.recentDirs = [d, ...db.recentDirs.filter((x) => x !== d)].slice(0, 12);
  save();
}

// ---------------- Encargos entre agentes ----------------
const { JobManager, PERMISSIONS, ISOLATION, STATUS_LABEL, ON_DEP_FAIL } = await import('./lib/jobs.js');
const jobsMgr = new JobManager(CONF_DIR, {
  runDir: RUN_DIR, port: PORT, approvalsScript: runtimeScript('approvals-mcp.js'),
  agentName: (id) => CLIENTS[id]?.name || id,
  installed: (id) => !!(CLIENTS[id] && which(CLIENTS[id].bin)),
  start: (j) => {
    const info = createSession({ client: j.agent, cwd: j.worktree?.runCwd || j.cwd, delegate: { id: j.id, file: j.file, depth: j.depth + 1 } });
    const s = sessions.get(info.id);
    const KIND_TITLE = { chat: '💬 chat', debate: '⚖ debate', shadow: '👀 sombra', board: 'tablero', replay: 'receta', map: 'mapa', monitor: 'monitor', issue: 'issue' };
    s.title = `↳ ${CLIENTS[j.agent].name} · ${KIND_TITLE[j.kind] || (j.from === 'Tú (MCP Hub)' ? 'encargo' : 'encargo de ' + String(j.from).split(' · ')[0])}`;
    broadcast();
    return info.id;
  },
  kill: (sessionId) => { const s = sessions.get(sessionId); if (s && !s.exited) s.pty.kill(); },
  emit: () => { try { const m = JSON.stringify({ t: 'delegations' }); for (const ws of listeners) ws.send(m); } catch {} },
  notify: (type, text) => { try { messenger.notify(type, text, { subject: 'Encargos', urgent: type === 'approvals' }); } catch {} },
});
const jobView = (j) => jobsMgr.view(j);
// Crea un encargo (o varios en paralelo si llegan varios agentes) y, si se pide, su revisión independiente
function createJobs(o) {
  const { reviewWith, reviewModel, ...rest } = library.applyRole(o);
  if (Array.isArray(rest.agents) && rest.agents.length) {
    const g = jobsMgr.createGroup(rest);
    const reviews = reviewWith ? g.jobs.map((j) => jobsMgr.requestReview(j.id, { agent: reviewWith, model: reviewModel, fromSession: rest.fromSession })) : [];
    return { group: g.group, jobs: g.jobs.map(jobView), synth: g.synth && jobView(g.synth), reviews: reviews.map(jobView) };
  }
  const j = jobsMgr.create(rest);
  const review = reviewWith ? jobsMgr.requestReview(j.id, { agent: reviewWith, model: reviewModel, fromSession: rest.fromSession }) : null;
  return { ...jobView(j), reviewJob: review?.id || null };
}
const { Library } = await import('./lib/library.js');
const library = new Library(CONF_DIR);
const { Scheduler } = await import('./lib/schedules.js');
const scheduler = new Scheduler(CONF_DIR, {
  create: (o) => jobsMgr.create(library.applyRole(o)),
  emit: () => { try { const m = JSON.stringify({ t: 'delegations' }); for (const ws of listeners) ws.send(m); } catch {} },
  notify: (type, text) => { try { messenger.notify(type, text, { subject: 'Tareas programadas' }); } catch {} },
});
const agentsList = () => Object.values(CLIENTS).map((c) => ({ id: c.id, name: c.name, installed: !!which(c.bin),
  note: { claude: 'muy bueno programando y razonando; usa tu suscripción', codex: 'modelos GPT de OpenAI; usa tu API key',
    opencode: 'multi-proveedor; necesita una cuenta configurada', gemini: 'Gemini de Google; contexto muy largo', cursor: 'Cursor Agent' }[c.id] }));

// ---------------- Salud de los servidores MCP ----------------
// Historial real de comprobaciones (pruebas, exploraciones y "Comprobar todos"); no hay sondeo automático en segundo plano.
const HEALTH_FILE = path.join(CONF_DIR, 'mcp-health.json');
let health = {};
try { health = JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf8')); } catch {}
function recordHealth(name, r) {
  (health[name] ||= []).push({ at: Date.now(), ok: !!r.ok, ms: r.ms, error: r.error ? String(r.error).slice(0, 300) : undefined, tools: r.tools ?? undefined });
  health[name] = health[name].slice(-50);
  try { fs.writeFileSync(HEALTH_FILE, JSON.stringify(health), { mode: 0o600 }); } catch {}
}
function serverSpec(b) {
  const s = b.server ? b.server : db.servers[b.name];
  if (!s) throw new Error('No existe ese servidor en MCP Hub');
  return specOf(s);
}

// ---------------- Sesiones recuperables ----------------
// Se guarda qué pestañas había abiertas (con sus opciones, nunca su contenido ni secretos) para poder restaurarlas
// tras reiniciar MCP Hub. Las de encargos no se guardan: los encargos tienen su propia reanudación.
const SESS_FILE = path.join(CONF_DIR, 'sessions.json'), PREV_FILE = path.join(CONF_DIR, 'previous-sessions.json');
let shuttingDown = false, persistT = null;
function persistSessions(now = false) {
  if (shuttingDown) return;
  const write = () => {
    const list = [...sessions.values()].filter((x) => x.opts && !x.job && !x.exited)
      .map((x) => ({ id: x.id, title: x.title, client: x.client, cwd: x.cwd, opts: x.opts, created: x.created }));
    try { fs.writeFileSync(SESS_FILE, JSON.stringify(list), { mode: 0o600 }); } catch {}
  };
  clearTimeout(persistT);
  if (now) write(); else persistT = setTimeout(write, 300);
}
let previousSessions = [];
try { previousSessions = JSON.parse(fs.readFileSync(PREV_FILE, 'utf8')); } catch {}
try {
  const last = JSON.parse(fs.readFileSync(SESS_FILE, 'utf8'));
  if (last.length) { previousSessions = last; fs.writeFileSync(PREV_FILE, JSON.stringify(last), { mode: 0o600 }); fs.writeFileSync(SESS_FILE, '[]'); }
} catch {}
function restoreSessions(ids, resume) {
  const out = [], errors = [];
  for (const p of previousSessions.filter((x) => !ids || ids.includes(x.id))) {
    try {
      const info = createSession({ ...p.opts, external: false, continueLast: resume && p.client !== 'shell' });
      const s = sessions.get(info.id); if (s && p.title) s.title = p.title;
      out.push(info.id);
    } catch (e) { errors.push(`${p.title}: ${e.message}`); }
  }
  previousSessions = previousSessions.filter((x) => ids && !ids.includes(x.id));
  fs.writeFileSync(PREV_FILE, JSON.stringify(previousSessions), { mode: 0o600 });
  broadcast();
  return { restored: out, errors };
}

function validateProjectProfileInput(b) {
  const input = b.profile && typeof b.profile === 'object' ? b.profile : b;
  const id = String(input.id || '').trim();
  if (id && !/^[a-f0-9]{16}$/.test(id)) throw new Error('Identificador de perfil no válido');
  if (id && !projectProfiles.get(id)) throw new Error('Ese perfil ya no existe; vuelve a cargar la lista');

  const name = String(input.name || '').trim().slice(0, 80);
  if (!name) throw new Error('Ponle un nombre al perfil');
  const cwdInput = String(input.cwd || '').trim();
  if (!cwdInput || cwdInput.length > 4096) throw new Error('Indica una carpeta de proyecto válida');
  const candidate = path.resolve(expandHome(cwdInput));
  let cwd;
  try {
    const st = fs.statSync(candidate);
    if (!st.isDirectory()) throw new Error('no es una carpeta');
    cwd = fs.realpathSync(candidate);
  } catch (e) { throw new Error(`No se puede usar la carpeta de proyecto: ${e.message}`); }

  const client = String(input.client || '');
  const c = CLIENTS[client];
  if (!c) throw new Error('Elige un agente disponible');
  let account = String(input.account || 'subscription');
  if (!['subscription', 'default'].includes(account)) {
    if (!account.startsWith('provider:')) throw new Error('Cuenta no válida');
    const provider = db.providers[account.slice(9)];
    if (!provider || !compatible(client, provider)) throw new Error('La cuenta elegida no es compatible con este agente');
  }
  const model = String(input.model || '').trim().slice(0, 160);
  const mode = input.mode === 'selected' ? 'selected' : 'all';
  if (mode === 'selected' && !c.strictLaunch) throw new Error(`${c.name} no permite limitar los MCPs por sesión`);
  const mcps = [...new Set((Array.isArray(input.mcps) ? input.mcps : []).map((n) => String(n).trim()).filter(Boolean))];
  if (mcps.length > 100) throw new Error('El perfil no puede incluir más de 100 MCPs');
  for (const n of mcps) if (!db.servers[n]) throw new Error(`No existe el servidor MCP "${n}" en MCP Hub`);

  const skillsList = [...new Set((Array.isArray(input.skills) ? input.skills : []).map((s) => String(s).trim()).filter(Boolean))];
  if (skillsList.length > 20 || skillsList.some((s) => !/^[\w .:-]{1,100}$/.test(s))) throw new Error('Revisa los nombres de las skills (máximo 20)');
  const instructions = String(input.instructions || '');
  if (instructions.length > 8000) throw new Error('Las instrucciones no pueden superar 8.000 caracteres');

  const secrets = [...new Set((Array.isArray(input.secrets) ? input.secrets : []).map((s) => String(s).trim()).filter(Boolean))];
  if (secrets.length > 50 || secrets.some((s) => !/^[a-f0-9]{8}$/.test(s))) throw new Error('Referencia de credencial no válida');
  if (vault.unlocked) for (const secretId of secrets) {
    const item = vault.get(secretId);
    if (!item.envVar || !item.secret) throw new Error(`"${item.name}" no tiene una variable de entorno y secreto para esta sesión`);
  }
  return { ...(id ? { id } : {}), name, cwd, client, account, model, mode, mcps, skills: skillsList, instructions, secrets };
}

function profilePrompt(profile, instructions = profile.instructions) {
  const skillHint = profile.skills?.length
    ? `Skills preferidas para este proyecto: ${profile.skills.join(', ')}. Úsalas cuando sean pertinentes y estén instaladas para este agente.` : '';
  return [skillHint, String(instructions || '').trim()].filter(Boolean).join('\n\n');
}

function createSessionFromRequest(b) {
  const opts = { ...b };
  if (b.profileId) {
    const profile = projectProfiles.get(String(b.profileId));
    if (!profile) throw new Error('El perfil de proyecto ya no existe; vuelve a cargarlo');
    if (b.client && b.client !== profile.client) throw new Error('El agente no coincide con el perfil seleccionado');
    try {
      const st = fs.statSync(profile.cwd);
      if (!st.isDirectory() || fs.realpathSync(profile.cwd) !== profile.cwd) throw new Error('la carpeta cambió');
    } catch (e) { throw new Error(`La carpeta del perfil ya no está disponible: ${e.message}`); }
    const c = CLIENTS[profile.client];
    const mode = b.mode === undefined ? profile.mode : b.mode;
    const mcps = mode === 'selected' ? (Array.isArray(b.mcps) ? b.mcps : profile.mcps) : [];
    if (mode === 'selected' && !c.strictLaunch) throw new Error(`${c.name} no permite limitar los MCPs por sesión`);
    for (const n of mcps) if (!db.servers[n]) throw new Error(`El MCP "${n}" del perfil ya no existe; edita el perfil`);
    const account = b.account === undefined ? profile.account : String(b.account);
    if (account.startsWith('provider:')) {
      const p = db.providers[account.slice(9)];
      if (!p || !compatible(profile.client, p)) throw new Error('La cuenta de API del perfil ya no está disponible o no es compatible');
    } else if (!['subscription', 'default'].includes(account)) throw new Error('Cuenta no válida');
    for (const secretId of profile.secrets || []) {
      const item = vault.get(secretId);
      if (!item.envVar || !item.secret) throw new Error(`La credencial "${item.name}" no está disponible para el perfil`);
    }
    Object.assign(opts, profile, b, {
      profileId: profile.id, client: profile.client, cwd: profile.cwd, mode, mcps,
      account, secrets: [...(profile.secrets || [])],
      initialPrompt: profilePrompt(profile, b.profileInstructions === undefined ? profile.instructions : b.profileInstructions),
    });
    delete opts.profileInstructions;
  }
  return createSession(opts);
}

// ---------------- Mensajería ----------------
// Lo que se ve ahora mismo en la pantalla de una sesión (como texto plano)
function screenText(id, maxLines = 40) {
  const s = sessions.get(id);
  if (!s) return Promise.resolve('');
  const t = new HeadlessTerminal({ cols: s.pty.cols || 120, rows: s.pty.rows || 32, allowProposedApi: true });
  return new Promise((resolve) => t.write(s.buf, () => {
    const b = t.buffer.active, lines = [];
    for (let i = 0; i < b.length; i++) lines.push(b.getLine(i)?.translateToString(true) ?? '');
    t.dispose();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    resolve(lines.slice(-maxLines).join('\n').replace(/\n{3,}/g, '\n\n'));
  }));
}
function typeInto(id, text) {
  const s = sessions.get(id);
  if (!s || s.exited) throw new Error('La sesión ya no está abierta');
  s.pty.write(text);
  setTimeout(() => { if (!s.exited) s.pty.write('\r'); }, 150);
}
const messenger = new Messenger(CONF_DIR, () => db.messaging, save, {
  sessions: () => [...sessions.values()].map(sessionInfo),
  write: typeInto,
  jobs: {
    pending: () => jobsMgr.pendingApprovals(),
    decide: (id, allow, note) => jobsMgr.decide(id, allow, note),
    list: () => jobsMgr.jobs.filter((j) => ['waiting', 'queued', 'paused', 'awaiting_approval', 'running', 'starting'].includes(j.status)).map((j) => ({ ...jobView(j), statusLabel: STATUS_LABEL[j.status] })),
  },
  screen: screenText,
  changed: () => { const m = JSON.stringify({ t: 'messaging' }); for (const ws of listeners) ws.send(m); },
});
const messagingState = () => ({ ...messenger.publicConfig(), log: messenger.log.slice(-80).reverse(), pending: messenger.pending(),
  inbox: messenger.inbox.filter((m) => !m.read), registered: !!db.servers[MSG_SERVER] });

// ---------------- Diseño ----------------
const designKey = (slug) => crypto.createHmac('sha256', TOKEN).update('design:' + slug).digest('hex').slice(0, 20);
const designPath = (slug, sha) => `/dz/${designKey(slug)}/${slug}${sha ? '@' + sha : ''}/`;
const designBase = (slug, sha) => `http://127.0.0.1:${PORT}${designPath(slug, sha)}`;
const designer = new Designer({
  env: () => childEnv({}, []),
  emit: (m) => { const s = JSON.stringify(m); for (const ws of listeners) ws.send(s); },
  notify: (type, text) => { try { messenger.notify(type, text, { subject: 'Diseño' }); } catch {} },
  installed: (a) => !!(CLIENTS[a] && which(CLIENTS[a].bin)),
  fileUrl: (slug, rel, o = {}) => designBase(slug) + rel + '?' + new URLSearchParams(Object.entries({ clean: o.clean ? 1 : null, slide: o.slide, print: o.print })
    .filter(([, v]) => v != null)).toString(),
  injectScript: () => fs.readFileSync(path.join(ROOT, 'public', 'design-inject.js'), 'utf8'),
});
async function serveDesign(req, res, url) {
  const m = /^\/dz\/([0-9a-f]{20})\/([a-z0-9-]{1,48})(?:@([0-9a-f]{4,40}))?\/(.*)$/.exec(url.pathname);
  if (!m || m[1] !== designKey(m[2])) { res.writeHead(404); return res.end('404'); }
  const [, , slug, sha, rel] = m;
  try {
    let data = await designer.file(slug, rel || 'index.html', sha);
    const ext = path.extname(rel || 'index.html').toLowerCase();
    if (ext === '.html' || ext === '.htm' || !rel) {
      const inject = `${sha ? '' : designer.tweakStyle(slug)}<script src="${req.remoteOrigin || `http://127.0.0.1:${PORT}`}/design-inject.js"></script>`;
      let html = data.toString();
      html = /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, inject + '</body>') : html + inject;
      data = Buffer.from(html);
    }
    // El lienzo es un iframe aislado (origen «null»): los módulos JS (p. ej. ./stage.js) se piden en modo CORS
    res.writeHead(200, { 'content-type': MIME[ext || '.html'] || 'application/octet-stream', 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
    res.end(data);
  } catch { res.writeHead(404); res.end('404'); }
}
// Respuestas binarias de Diseño (imágenes y exportaciones): el token puede ir en la URL porque las pide un <img> o una descarga
async function serveDesignBinary(req, res, url) {
  const q = url.searchParams, slug = q.get('slug');
  try {
    if (url.pathname === '/api/design/thumb') {
      const f = path.join(designer.dir(slug), '.design', 'thumb.png');
      if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      return res.end(fs.readFileSync(f));
    }
    if (url.pathname === '/api/design/shot') {
      const png = await designer.screenshot(designBase(slug, q.get('sha')) + 'index.html?clean=1' + (q.get('slide') ? `&slide=${Number(q.get('slide'))}` : ''),
        { width: Math.min(Number(q.get('w')) || 1440, 4000), height: Math.min(Number(q.get('h')) || 900, 4000), scroll: Number(q.get('scroll')) || 0 });
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      return res.end(png);
    }
    if (url.pathname === '/api/design/export') {
      const r = await designer.export(slug, q.get('format'), { width: Number(q.get('w')) || 1440, height: Number(q.get('h')) || 900 });
      res.writeHead(200, { 'content-type': r.mime, 'content-disposition': `attachment; filename="${r.name}"`, 'cache-control': 'no-store' });
      return res.end(r.data);
    }
    send(res, 404, { error: 'No encontrado' });
  } catch (e) { send(res, 400, { error: e.message }); }
}
async function commitDesign(slug, msg) {
  const d = designer.dir(slug);
  const run = (args) => new Promise((ok, ko) => execFile('git', args, { cwd: d }, (e, out) => (e ? ko(e) : ok(String(out)))));
  await run(['add', '-A']);
  if (!(await run(['status', '--porcelain'])).trim()) return null;
  await run(['-c', 'user.name=MCP Hub', '-c', 'user.email=mcp-hub@localhost', 'commit', '-qm', msg]);
  designer.thumbnail(slug).catch(() => {});
  return true;
}

// API de Diseño para agentes (design-mcp.js)
const DESIGN_TYPE_NAMES = { blank: 'En blanco', prototype: 'Prototipo', mobile: 'App móvil', slides: 'Presentación', doc: 'Documento', wireframe: 'Wireframe',
  animation: 'Animación', mockups: 'Mockups de UI', resume: 'Currículum', model3d: 'Objeto 3D', research: 'Investigación', email: 'Email HTML',
  palette: 'Color + tipografía', system: 'Sistema de diseño' };
const callerAgent = (client) => {
  const id = [['claude', /claude/i], ['codex', /codex/i], ['opencode', /opencode/i], ['gemini', /gemini/i], ['cursor', /cursor/i]].find(([, re]) => re.test(client || ''))?.[0];
  return id && which(CLIENTS[id].bin) ? id : 'claude';
};
const designLink = (slug) => `http://127.0.0.1:${PORT}/#design/${slug}`;
function designTurn(slug) {
  const p = designer.get(slug);
  return { slug, name: p.name, typeName: DESIGN_TYPE_NAMES[p.type] || p.type, agentName: CLIENTS[p.agent]?.name || p.agent, running: p.running,
    last: p.chat.filter((m) => m.role === 'agent').at(-1) || null, dir: designer.dir(slug), url: designLink(slug) };
}
const expandPath = (f) => path.resolve(String(f).replace(/^~(?=$|\/)/, HOME));
function attachPaths(slug, files = []) {
  return files.map((f) => {
    const abs = expandPath(f);
    if (!fs.existsSync(abs)) throw new Error(`No existe la imagen ${f}`);
    const mime = MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream';
    return designer.attach(slug, { name: path.basename(abs), data: `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}` }).path;
  });
}
const openInHub = (slug) => { const m = JSON.stringify({ t: 'design-open', slug }); for (const ws of listeners) ws.send(m); };
async function designAgentApi(action, b) {
  const wait = b.wait_seconds ?? 50;
  if (action === 'list') {
    const q = String(b.query || '').toLowerCase();
    return { items: designer.list().filter((p) => !q || p.name.toLowerCase().includes(q))
      .map((p) => ({ slug: p.slug, name: p.name, typeName: DESIGN_TYPE_NAMES[p.type] || p.type, template: !!p.template, agentName: CLIENTS[p.agent]?.name || p.agent, running: p.running })) };
  }
  if (action === 'create') {
    const type = b.type || 'prototype';
    if (!DESIGN_TYPE_NAMES[type]) throw new Error(`Tipo no válido. Usa: ${Object.keys(DESIGN_TYPE_NAMES).join(', ')}`);
    const prompt = String(b.prompt || '').trim();
    if (!prompt) throw new Error('Falta el encargo (prompt)');
    const agent = b.agent || callerAgent(b.client);
    const codebase = b.codebase ? expandPath(b.codebase) : null;
    const name = String(b.name || '').trim() || prompt.replace(/\s+/g, ' ').split(/[.\n:;]/)[0].slice(0, 48);
    const isSystem = type === 'system';
    const { slug } = await designer.create({ name, type, agent, model: b.model || '', system: b.design_system || null, codebase: isSystem ? null : codebase,
      source: isSystem ? (b.source_url ? { url: b.source_url } : codebase ? { folder: codebase } : {}) : null, prompt: isSystem ? prompt : '' });
    if (!isSystem) designer.run(slug, { text: prompt, images: attachPaths(slug, b.images), display: `${prompt}\n\n— encargado por ${b.client || 'un agente'}` }).catch(() => {});
    if (b.open !== false) openInHub(slug);
    if (wait > 0) await designer.waitIdle(slug, wait);
    return designTurn(slug);
  }
  if (action === 'message') {
    const slug = b.slug; designer.dir(slug);
    if (designer.runs.has(slug)) throw new Error('El diseñador ya está trabajando en este diseño; usa design_wait.');
    if (b.agent) designer.update(slug, { agent: b.agent });
    designer.run(slug, { text: String(b.text || ''), images: attachPaths(slug, b.images), display: `${b.text}\n\n— pedido por ${b.client || 'un agente'}` }).catch(() => {});
    if (wait > 0) await designer.waitIdle(slug, wait);
    return designTurn(slug);
  }
  if (action === 'wait') { designer.dir(b.slug); await designer.waitIdle(b.slug, wait || 50); return designTurn(b.slug); }
  if (action === 'get') {
    const p = designer.get(b.slug), d = designer.dir(b.slug);
    const files = [];
    const walk = (rel) => { for (const e of fs.readdirSync(path.join(d, rel), { withFileTypes: true })) { const r = path.join(rel, e.name); if (/^(\.git|\.design)$/.test(r)) continue; if (e.isDirectory()) walk(r); else files.push(r); } };
    walk('');
    return { slug: b.slug, name: p.name, type: p.type, typeName: DESIGN_TYPE_NAMES[p.type], designer: CLIENTS[p.agent]?.name || p.agent, model: p.model || null,
      dir: d, files, url: designLink(b.slug), running: p.running, designSystem: p.systemName || null, codebase: p.codebase || null, tweaks: p.tweaks,
      openComments: p.comments.filter((c) => c.status === 'open').map((c) => ({ element: c.label || c.selector, selector: c.selector, text: c.text })),
      versions: (await designer.versions(b.slug)).slice(0, 10).map((v) => `${v.sha} ${v.message}`),
      recentChat: p.chat.slice(-6).map((m) => ({ role: m.role === 'user' ? 'usuario' : 'diseñador', text: String(m.text || '').slice(0, 800) })) };
  }
  if (action === 'screenshot') {
    const m = designer.meta(b.slug);
    const slides = m.type === 'slides';
    const width = Math.min(Number(b.width) || (slides ? 1920 : m.type === 'mobile' ? 390 : 1440), 3000);
    const height = Math.min(Number(b.height) || (slides ? 1080 : m.type === 'mobile' ? 844 : 900), 3000);
    const slide = slides ? Number(b.slide) || 1 : null;
    const view = ['front', 'side', 'top', 'back', 'three-quarter'].includes(b.view) ? b.view : null;
    const png = await designer.screenshot(designer.hooks.fileUrl(b.slug, 'index.html', { clean: true, slide }), { width, height, full: !!b.full_page && !slides, jpeg: true, view });
    return { png: png.toString('base64'), name: m.name, width, height, slide, slides: slides ? await designer.slideCount(designer.hooks.fileUrl(b.slug, 'index.html', { clean: true })) : null };
  }
  if (action === 'export') {
    const r = await designer.export(b.slug, b.format);
    let dest = b.output ? expandPath(b.output) : path.join(HOME, 'Designs', '_exportaciones');
    if (!path.extname(dest) || (fs.existsSync(dest) && fs.statSync(dest).isDirectory())) dest = path.join(dest, r.name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, r.data);
    return { path: dest };
  }
  if (action === 'open') { designer.dir(b.slug); openInHub(b.slug); return { url: designLink(b.slug) }; }
  throw new Error('Acción desconocida');
}

// ---------------- Funciones ampliadas (features.js) ----------------
const { setupFeatures } = await import('./features.js');
const broadcastEvent = (m) => { try { const d = JSON.stringify(m); for (const ws of listeners) ws.send(d); } catch {} };
const features = setupFeatures({
  CONF_DIR, jobsMgr, createJobs, library, scheduler, messenger, designer, sessions, sessionInfo, screenText, broadcastEvent,
  agentName: (id) => CLIENTS[id]?.name || id, installed: (id) => !!(CLIENTS[id] && which(CLIENTS[id].bin)),
  removeSession: (id) => { const s = sessions.get(id); if (s?.exited) { sessions.delete(id); broadcast(); } },
});

// ---------------- HTTP ----------------
const MIME = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };
const STATIC = {
  '/vendor/xterm.js': 'node_modules/@xterm/xterm/lib/xterm.js',
  '/vendor/xterm.css': 'node_modules/@xterm/xterm/css/xterm.css',
  '/vendor/addon-fit.js': 'node_modules/@xterm/addon-fit/lib/addon-fit.js',
  '/vendor/addon-web-links.js': 'node_modules/@xterm/addon-web-links/lib/addon-web-links.js',
};
const hostOk = (h) => /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(h || '');

function send(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
async function body(req) {
  let d = ''; for await (const c of req) d += c;
  return d ? JSON.parse(d) : {};
}

const routes = {
  'GET /api/state': async () => state(),
  'GET /api/project-profiles': async () => ({ profiles: projectProfiles.list(), error: projectProfiles.loadError || null }),
  'POST /api/project-profiles/save': async (b) => ({ profile: projectProfiles.save(validateProjectProfileInput(b)) }),
  'POST /api/project-profiles/delete': async (b) => {
    const id = String(b.id || '');
    if (!/^[a-f0-9]{16}$/.test(id)) throw new Error('Identificador de perfil no válido');
    projectProfiles.remove(id);
    return {};
  },
  'POST /api/servers': async (b) => {
    const { name, oldName, server } = b;
    if (!validName(name)) throw new Error('Nombre no válido (letras, números, . _ -)');
    if (oldName && oldName !== name) {
      if (db.servers[name]) throw new Error('Ya existe un servidor con ese nombre');
      const old = db.servers[oldName]; delete db.servers[oldName]; save();
      if (old) await applyAll(oldName);
    }
    const s = { ...specOf(server), description: server.description || '', targets: server.targets || {}, catalogId: server.catalogId };
    if (s.transport === 'stdio' && !s.command) throw new Error('Falta el comando');
    if (s.transport !== 'stdio' && !/^https?:\/\//.test(s.url || '')) throw new Error('URL no válida');
    db.servers[name] = s; save();
    return { errors: await applyAll(name) };
  },
  'POST /api/install': async (b) => {
    const item = CATALOG.find((c) => c.id === b.catalogId);
    if (!item) throw new Error('No está en el catálogo');
    const values = Object.fromEntries(Object.entries(b.values || {}).map(([k, v]) => {
      const f = (item.fields || []).find((x) => x.key === k);
      return [k, f?.type === 'path' ? String(v).split(',').map((x) => expandHome(x.trim())).join(',') : v];
    }));
    for (const f of item.fields || []) if (!values[f.key]) throw new Error(`Falta: ${f.label}`);
    const name = b.name || item.id;
    if (!validName(name)) throw new Error('Nombre no válido');
    db.servers[name] = { ...specOf(fillSpec(item.spec, values, item.fields)), description: item.desc, targets: b.targets || {}, catalogId: item.id };
    save();
    return { name, errors: await applyAll(name) };
  },
  'POST /api/delete': async (b) => {
    if (!db.servers[b.name]) throw new Error('No existe');
    delete db.servers[b.name]; save();
    return { errors: await applyAll(b.name) };
  },
  'POST /api/target': async (b) => {
    const s = db.servers[b.name]; if (!s) throw new Error('No existe');
    s.targets = { ...s.targets, [b.client]: !!b.on }; save();
    return { errors: await applyAll(b.name, [b.client]) };
  },
  'POST /api/sync': async () => {
    const errors = {};
    for (const name of Object.keys(db.servers)) {
      const e = await applyAll(name, null, { remove: false });
      if (Object.keys(e).length) errors[name] = e;
    }
    return { errors };
  },
  'POST /api/import': async () => ({ added: await importFromClients() }),
  'POST /api/import-json': async (b) => {
    // Acepta {"mcpServers": {...}}, {"mcp": {...}} o {"nombre": {...}}
    let obj = typeof b.json === 'string' ? JSON.parse(b.json) : b.json;
    obj = obj.mcpServers || obj.servers || obj.mcp || obj;
    const names = [];
    for (const [name, s] of Object.entries(obj)) {
      if (!validName(name) || typeof s !== 'object') continue;
      let spec;
      if (s.url || s.httpUrl || s.serverUrl) spec = { transport: s.type === 'sse' ? 'sse' : 'http', url: s.url || s.httpUrl || s.serverUrl, headers: s.headers || {} };
      else if (Array.isArray(s.command)) spec = { transport: 'stdio', command: s.command[0], args: s.command.slice(1), env: s.environment || s.env || {} };
      else if (s.command) spec = { transport: 'stdio', command: s.command, args: s.args || [], env: s.env || {} };
      else continue;
      db.servers[name] = { ...spec, description: s.description || 'Añadido desde JSON', targets: b.targets || {} };
      names.push(name);
    }
    if (!names.length) throw new Error('No se encontró ningún servidor MCP en el JSON');
    save();
    const errors = {};
    for (const n of names) { const e = await applyAll(n); if (Object.keys(e).length) errors[n] = e; }
    return { names, errors };
  },
  'POST /api/test': async (b) => {
    const s = b.server ? b.server : db.servers[b.name];
    if (!s) throw new Error('No existe');
    const t0 = Date.now();
    const r = await probe(specOf(s));
    if (b.name) recordHealth(b.name, { ok: r.ok, ms: Date.now() - t0, error: r.error, tools: r.tools?.length });
    return r;
  },
  // ---- Explorador MCP, probador de herramientas, salud y revisión de seguridad ----
  'POST /api/mcp/explore': async (b) => {
    const s = serverSpec(b);
    const t0 = Date.now();
    const r = await mcpc.explore(s);
    if (b.name) recordHealth(b.name, { ok: r.ok, ms: Date.now() - t0, error: r.error, tools: Array.isArray(r.tools) ? r.tools.length : null });
    return { ...r, review: reviewSpec(s), health: b.name ? health[b.name] || [] : [] };
  },
  'POST /api/mcp/call': async (b) => mcpc.callTool(serverSpec(b), String(b.tool || ''), b.args && typeof b.args === 'object' ? b.args : {}),
  'POST /api/mcp/resource': async (b) => mcpc.readResource(serverSpec(b), String(b.uri || '')),
  'POST /api/mcp/prompt': async (b) => mcpc.getPrompt(serverSpec(b), String(b.prompt || ''), b.args || {}),
  'POST /api/mcp/review': async (b) => ({ findings: reviewSpec(specOf(b.server || {})) }),
  'GET /api/mcp/health': async () => ({ health }),
  'POST /api/mcp/health/check': async (b) => {
    const names = (Array.isArray(b.names) ? b.names : Object.keys(db.servers)).filter((n) => db.servers[n]);
    const queue = [...names];
    const worker = async () => { for (let n; (n = queue.shift());) { const t0 = Date.now(); const r = await probe(specOf(db.servers[n]), 45000); recordHealth(n, { ok: r.ok, ms: Date.now() - t0, error: r.error, tools: r.tools?.length }); } };
    await Promise.all([worker(), worker(), worker()]);
    return { health };
  },
  'POST /api/sessions': async (b) => {
    const s = createSessionFromRequest(b);
    return { session: s };
  },
  'GET /api/sessions/previous': async () => ({ sessions: previousSessions }),
  'POST /api/sessions/restore': async (b) => restoreSessions(Array.isArray(b.ids) ? b.ids : null, b.resume !== false),
  'POST /api/sessions/previous/dismiss': async () => { previousSessions = []; fs.writeFileSync(PREV_FILE, '[]'); return {}; },
  'POST /api/sessions/kill': async (b) => {
    const s = sessions.get(b.id);
    if (s) { if (!s.exited) s.pty.kill(); sessions.delete(b.id); broadcast(); }
    return {};
  },
  'POST /api/sessions/rename': async (b) => {
    const s = sessions.get(b.id); if (s) { s.title = String(b.title).slice(0, 80); broadcast(); }
    return {};
  },
  'POST /api/auth-status': async (b) => {
    const c = CLIENTS[b.client];
    if (!c?.status) return { text: 'Estado no disponible para este agente' };
    const env = childEnv({}, c.apiEnv);
    const r = await new Promise((resolve) => execFile(c.status[0], c.status.slice(1), { env, timeout: 15000 },
      (err, stdout, stderr) => resolve(((stdout || '') + (stderr || '')).replace(/\x1b\[[0-9;]*m/g, '').trim() || err?.message || '')));
    let kind = 'unknown';
    if (/claude\.ai|chatgpt|logged in using chatgpt|oauth/i.test(r)) kind = 'subscription';
    else if (/api key|apiKey|sk-/i.test(r)) kind = 'apikey';
    if (/not logged|no credentials|0 credentials|"loggedIn": false/i.test(r)) kind = 'none';
    const envKeys = c.apiEnv.filter((k) => process.env[k]);
    return { text: r.slice(0, 1500), kind, envKeys };
  },
  'POST /api/providers': async (b) => {
    const { id, provider: p } = b;
    if (!/^[a-z0-9-]{1,40}$/.test(id || '')) throw new Error('Identificador no válido (minúsculas, números, -)');
    if (!p.name) throw new Error('Falta el nombre');
    if (!p.openaiUrl && !p.anthropicUrl) throw new Error('Indica al menos una URL (OpenAI o Anthropic)');
    const prev = db.providers[id] || {};
    db.providers[id] = { name: p.name, openaiUrl: p.openaiUrl || '', anthropicUrl: p.anthropicUrl || '',
      apiKey: p.apiKey === undefined || String(p.apiKey).startsWith('••••') ? prev.apiKey || '' : p.apiKey,
      models: (p.models || []).filter(Boolean), defaultModel: p.defaultModel || '', wireApi: p.wireApi || 'chat' };
    save();
    return {};
  },
  'POST /api/providers/delete': async (b) => { delete db.providers[b.id]; save(); return {}; },
  'POST /api/providers/models': async (b) => {
    const p = db.providers[b.id]; if (!p) throw new Error('No existe');
    const models = await listModels(p);
    return { models };
  },
  'GET /api/vault': async () => ({ status: vaultStatus(), items: vault.unlocked ? vault.list() : [], log: vault.unlocked ? vault.log.slice(-40).reverse() : [],
    registered: !!db.servers[VAULT_SERVER] }),
  'POST /api/vault/setup': async (b) => { vault.setup(b.password, !!b.remember); return vaultStatus(); },
  'POST /api/vault/unlock': async (b) => { vault.unlock(b.password, !!b.remember); return vaultStatus(); },
  'POST /api/vault/lock': async () => { vault.lock(); return vaultStatus(); },
  'POST /api/vault/save': async (b) => ({ id: vault.save(b.id, b.item) }),
  'POST /api/vault/delete': async (b) => { vault.remove(b.id); return {}; },
  'POST /api/vault/reveal': async (b) => { const it = vault.get(b.id); return { secret: it.secret, connection: connectionString(it) }; },
  'POST /api/vault/password': async (b) => { vault.changePassword(b.old, b.new); return {}; },
  'POST /api/vault/register': async (b) => {
    db.servers[VAULT_SERVER] = { transport: 'stdio', ...hubScript('vault-mcp.js'),
      description: 'Bóveda de MCP Hub: credenciales para los agentes', targets: b.targets || {}, catalogId: 'vault' };
    save();
    return { errors: await applyAll(VAULT_SERVER) };
  },
  'GET /api/delegations': async () => ({ jobs: jobsMgr.jobs.slice().reverse().map(jobView), registered: !!db.servers[AGENTS_SERVER],
    running: jobsMgr.running().length, settings: jobsMgr.settings, approvals: jobsMgr.approvals.slice().reverse(), permissions: PERMISSIONS, isolation: ISOLATION, status: STATUS_LABEL,
    agents: agentsList(), recentDirs: db.recentDirs, onDepFail: ON_DEP_FAIL, held: jobsMgr.held || null }),
  'POST /api/delegations/create': async (b) => createJobs({ ...b, from: 'Tú (MCP Hub)', fromSession: undefined, depth: 0 }),
  'POST /api/delegations/request-review': async (b) => jobView(jobsMgr.requestReview(String(b.id || ''), { agent: b.agent || 'auto', model: b.model || null, from: 'Tú (MCP Hub)' })),
  'GET /api/schedules': async () => ({ schedules: scheduler.view() }),
  'POST /api/schedules/save': async (b) => scheduler.save1(b),
  'POST /api/schedules/delete': async (b) => { scheduler.remove(b.id); return {}; },
  'POST /api/schedules/toggle': async (b) => scheduler.toggle(b.id, b.enabled),
  'POST /api/schedules/run': async (b) => jobView(scheduler.runNow(b.id)),
  'GET /api/library': async () => ({ roles: library.roles, templates: library.templates }),
  'POST /api/library/role': async (b) => library.saveRole(b),
  'POST /api/library/role/delete': async (b) => { library.deleteRole(b.id); return {}; },
  'POST /api/library/template': async (b) => library.saveTemplate(b),
  'POST /api/library/template/delete': async (b) => { library.deleteTemplate(b.id); return {}; },
  'POST /api/delegations/cancel': async (b) => jobView(jobsMgr.cancel(b.id)),
  'POST /api/delegations/pause': async (b) => jobView(jobsMgr.pause(b.id)),
  'POST /api/delegations/unpause': async (b) => jobView(jobsMgr.unpause(b.id)),
  'POST /api/delegations/priority': async (b) => jobView(jobsMgr.setPriority(b.id, b.priority)),
  'POST /api/delegations/resume': async (b) => jobView(jobsMgr.resume(b.id, { fresh: !!b.fresh })),
  'POST /api/delegations/review': async (b) => jobView(await jobsMgr.review(b.id, b.action)),
  'GET /api/delegations/diff': async (_b, url) => jobsMgr.diff(url.searchParams.get('id')),
  'POST /api/delegations/settings': async (b) => jobsMgr.saveSettings(b),
  'POST /api/approvals/decide': async (b) => jobsMgr.decide(b.id, !!b.allow, b.note),
  'POST /api/delegations/register': async (b) => {
    db.servers[AGENTS_SERVER] = { transport: 'stdio', ...hubScript('agents-mcp.js'),
      description: 'Encargos de MCP Hub: los agentes pueden encargar tareas a otros agentes', targets: b.targets || {}, catalogId: 'agents' };
    save();
    return { errors: await applyAll(AGENTS_SERVER) };
  },
  'GET /api/design': async () => ({ projects: designer.list(), root: path.join(HOME, 'Designs'), registered: db.servers[DESIGN_SERVER]?.targets || null,
    agents: Object.values(CLIENTS).map((c) => ({ id: c.id, name: c.name, installed: !!which(c.bin) })) }),
  'GET /api/design/project': async (_b, url) => { const slug = url.searchParams.get('slug'); return { ...designer.get(slug, { view: url.searchParams.get('view') === '1' }), base: designPath(slug), dir: designer.dir(slug) }; },
  'POST /api/design/create': async (b) => designer.create(b),
  'POST /api/design/update': async (b) => designer.update(b.slug, b),
  'POST /api/design/delete': async (b) => { designer.remove(b.slug); return {}; },
  'POST /api/design/duplicate': async (b) => designer.duplicate(b.slug, b),
  'POST /api/design/run': async (b) => { designer.dir(b.slug); if (designer.runs.has(b.slug)) throw new Error('El agente ya está trabajando en este proyecto'); designer.run(b.slug, b).catch((e) => designer.hooks.emit({ t: 'design', slug: b.slug, ev: { kind: 'error', text: e.message } })); return {}; },
  'POST /api/design/cancel': async (b) => { designer.cancel(b.slug); return {}; },
  'POST /api/design/comment': async (b) => designer.addComment(b.slug, b),
  'POST /api/design/comment/set': async (b) => { designer.setComment(b.slug, b.id, b); return {}; },
  'POST /api/design/attach': async (b) => designer.attach(b.slug, b),
  'POST /api/design/edits': async (b) => {
    const r = designer.applyEdits(b.slug, b.edits);
    if (r.applied) await commitDesign(b.slug, `Edición de ${r.applied} texto${r.applied > 1 ? 's' : ''}`);
    return r;
  },
  'GET /api/design/formats3d': async () => ({ formats: designer.formats3d() }),
  'GET /api/design/versions': async (_b, url) => ({ versions: await designer.versions(url.searchParams.get('slug')) }),
  'POST /api/design/restore': async (b) => { await designer.restore(b.slug, b.sha); return {}; },
  'POST /api/design/open-folder': async (b) => { openPath(designer.dir(b.slug)); return {}; },
  'POST /api/design/handoff': async (b) => {
    const d = designer.dir(b.slug), m = designer.meta(b.slug);
    const cwd = expandHome(b.cwd || d);
    const prompt = [`Implementa el diseño "${m.name}" que está en ${d} (empieza por index.html; es la referencia visual y de interacción).`,
      cwd === d ? 'Conviértelo en una aplicación real en esta carpeta.' : 'Intégralo en este proyecto respetando su stack, componentes y convenciones.',
      fs.existsSync(path.join(d, 'DESIGN-SYSTEM.md')) ? `Sigue el sistema de diseño de ${path.join(d, 'DESIGN-SYSTEM.md')}.` : '',
      b.notes ? `Indicaciones: ${b.notes}` : ''].filter(Boolean).join(' ');
    return { session: createSession({ client: b.agent, cwd, mode: 'all', account: 'default', initialPrompt: prompt }) };
  },
  'POST /api/design/register': async (b) => {
    db.servers[DESIGN_SERVER] = { transport: 'stdio', ...hubScript('design-mcp.js'),
      description: 'Diseño de MCP Hub: los agentes crean, iteran, capturan y exportan diseños', targets: b.targets || {}, catalogId: 'design' };
    save();
    return { errors: await applyAll(DESIGN_SERVER) };
  },
  'GET /api/messaging': async () => messagingState(),
  'POST /api/messaging/channel': async (b) => { messenger.setChannel(b.id, b.config); return messagingState(); },
  'POST /api/messaging/settings': async (b) => { messenger.setSettings(b); return messagingState(); },
  'POST /api/messaging/rules': async (b) => { messenger.setRules(b); return messagingState(); },
  'POST /api/messaging/test': async (b) => { await messenger.test(b.id); return {}; },
  'POST /api/messaging/detect-telegram': async (b) => messenger.detectTelegram(b.token),
  'POST /api/messaging/send': async (b) => messenger.send(String(b.text || ''), { channel: b.channel, from: 'Tú (MCP Hub)' }),
  'POST /api/messaging/target': async (b) => { db.messaging.target = b.id || null; save(); return messagingState(); },
  'POST /api/messaging/register': async (b) => {
    db.servers[MSG_SERVER] = { transport: 'stdio', ...hubScript('messaging-mcp.js'),
      description: 'Mensajería de MCP Hub: avisos y preguntas por Telegram, email, Discord o Slack', targets: b.targets || {}, catalogId: 'messaging' };
    save();
    return { errors: await applyAll(MSG_SERVER) };
  },
  'GET /api/skills/search': async (_b, url) => {
    const q = (url.searchParams.get('q') || '').trim();
    return { items: q.length >= 2 ? await skills.searchSkills(q) : await skills.popularSkills() };
  },
  'GET /api/skills/detail': async (_b, url) => skills.skillDetail(url.searchParams.get('source'), url.searchParams.get('slug')),
  'GET /api/skills/installed': async () => ({ items: await skills.installedSkills() }),
  'POST /api/skills/install': async (b) => ({ output: await skills.installSkill(b.source, b.slug, b.clients || []) }),
  'POST /api/skills/remove': async (b) => ({ output: await skills.removeSkill(b.name) }),
  'GET /api/dirs': async (_b, url) => {
    const dir = expandHome(url.searchParams.get('path') || HOME);
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && (url.searchParams.get('hidden') || !e.name.startsWith('.')))
      .map((e) => e.name).sort((a, b) => a.localeCompare(b));
    return { path: dir, parent: path.dirname(dir), entries };
  },
  'GET /api/extras': async () => ({ registered: db.servers[EXTRAS_SERVER]?.targets || null }),
  'POST /api/extras/register': async (b) => {
    db.servers[EXTRAS_SERVER] = { transport: 'stdio', ...hubScript('extras-mcp.js'),
      description: 'MCP Hub para agentes: calendario, tablero, mapa del proyecto y monitores', targets: b.targets || {}, catalogId: 'extras' };
    save();
    return { errors: await applyAll(EXTRAS_SERVER) };
  },
};
Object.assign(routes, features.routes);

async function handle(req, res) {
  if (!req.remote && !hostOk(req.headers.host)) { res.writeHead(403); return res.end('Host no permitido'); }
  const url = new URL(req.url, 'http://localhost');
  const key = `${req.method} ${url.pathname}`;
  if (url.pathname.startsWith('/agent/') && req.method === 'POST') {
    const tok = String(req.headers['x-agent-token'] || '');
    if (tok.length !== AGENT_TOKEN.length || !crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(AGENT_TOKEN))) return send(res, 401, { error: 'Token de agente no válido' });
  }
  if (url.pathname.startsWith('/agent/design/') && req.method === 'POST') {
    try { return send(res, 200, await designAgentApi(url.pathname.slice('/agent/design/'.length), await body(req))); }
    catch (e) { return send(res, 400, { error: e.message }); }
  }
  if (url.pathname.startsWith('/agent/approvals/') && req.method === 'POST') {
    try {
      const b = await body(req);
      if (url.pathname === '/agent/approvals/request') {
        const j = jobsMgr.get(String(b.job || ''));
        if (j.status !== 'running') throw new Error('El encargo no está en marcha');
        return send(res, 200, { id: jobsMgr.requestApproval({ job: j.id, tool: b.tool, input: b.input }).id });
      }
      if (url.pathname === '/agent/approvals/wait') { const a = await jobsMgr.waitApproval(String(b.id || ''), Number(b.wait) || 50); return send(res, 200, { status: a.status, note: a.note }); }
      return send(res, 404, { error: 'No encontrado' });
    } catch (e) { return send(res, 400, { error: e.message }); }
  }
  if (url.pathname.startsWith('/agent/agents/') && req.method === 'POST') {
    try {
      const b = await body(req);
      const s = b.session && sessions.get(b.session);
      if (url.pathname === '/agent/agents/list') return send(res, 200, { agents: agentsList(), jobs: jobsMgr.jobs.slice(-10).reverse().map(jobView), settings: jobsMgr.settings, roles: library.roles.map(({ id, name, desc, permission, isolation }) => ({ id, name, desc, permission, isolation })) });
      const from = s ? s.title : String(b.label || b.client || 'Un agente').slice(0, 80);
      const common = { task: b.task, cwd: b.cwd, from, fromSession: s?.id, depth: b.depth, permission: b.permission, isolation: b.isolation, timeoutMin: b.timeout_minutes,
        maxTurns: b.max_turns, budgetUsd: b.budget_usd, priority: b.priority, role: b.role, after: b.after, onDepFail: b.on_dep_fail, useResults: b.use_results, reviewWith: b.review_with };
      if (url.pathname === '/agent/agents/delegate') {
        const r = createJobs({ ...common, agent: b.agent, model: b.model });
        return send(res, 200, { id: r.id, reviewJob: r.reviewJob });
      }
      if (url.pathname === '/agent/agents/parallel') {
        const r = createJobs({ ...common, agents: b.agents, synthesize: b.synthesize_with || null });
        return send(res, 200, { group: r.group });
      }
      if (url.pathname === '/agent/agents/group') {
        const g = String(b.id || '');
        const ids = jobsMgr.groupJobs(g).map((j) => j.id);
        if (!ids.length) throw new Error(`No existe el grupo ${g}`);
        return send(res, 200, { group: g, jobs: (await jobsMgr.waitAll(ids, Number(b.wait) || 50)).map(jobView) });
      }
      if (url.pathname === '/agent/agents/review') return send(res, 200, jobView(jobsMgr.requestReview(String(b.id || ''), { agent: b.agent || 'auto', model: b.model, from, fromSession: s?.id, depth: b.depth })));
      if (url.pathname === '/agent/agents/result') return send(res, 200, jobView(await jobsMgr.wait(String(b.id || ''), Number(b.wait) || 50)));
      if (url.pathname === '/agent/agents/cancel') return send(res, 200, jobView(jobsMgr.cancel(String(b.id || ''))));
      if (url.pathname === '/agent/agents/resume') return send(res, 200, jobView(jobsMgr.resume(String(b.id || ''))));
      return send(res, 404, { error: 'No encontrado' });
    } catch (e) { return send(res, 400, { error: e.message }); }
  }
  if (url.pathname.startsWith('/agent/msg/') && req.method === 'POST') {
    try {
      const b = await body(req);
      const s = b.session && sessions.get(b.session);
      const label = s ? s.title : String(b.label || b.client || 'Un agente').slice(0, 80);
      if (url.pathname === '/agent/msg/send') {
        if (!String(b.text || '').trim()) throw new Error('El mensaje está vacío');
        const r = await messenger.send(`💬 ${label}:\n${b.text}`, { channel: b.channel, from: label, subject: label });
        return send(res, 200, { channel: r.channel });
      }
      if (url.pathname === '/agent/msg/ask') {
        if (!String(b.question || '').trim()) throw new Error('La pregunta está vacía');
        return send(res, 200, { id: await messenger.ask(String(b.question), { label, channel: b.channel, session: s?.id }) });
      }
      if (url.pathname === '/agent/msg/answer') return send(res, 200, { answer: await messenger.waitAnswer(String(b.id || ''), Number(b.wait) || 50) });
      if (url.pathname === '/agent/msg/inbox') return send(res, 200, { items: messenger.readInbox() });
      return send(res, 404, { error: 'No encontrado' });
    } catch (e) { return send(res, 400, { error: e.message }); }
  }
  if (url.pathname.startsWith('/agent/extras/') && req.method === 'POST') {
    try { return send(res, 200, await features.agentApi(url.pathname.slice('/agent/extras/'.length), await body(req))); }
    catch (e) { return send(res, 400, { error: e.message }); }
  }
  if (url.pathname === '/api/design/video' && req.method === 'GET') {
    if (req.headers['x-token'] !== TOKEN && url.searchParams.get('token') !== TOKEN) return send(res, 401, { error: 'token' });
    try { return await features.binary(url, res); } catch (e) { return send(res, 400, { error: e.message }); }
  }
  if (url.pathname.startsWith('/agent/vault/') && req.method === 'POST') {
    try {
      const b = await body(req);
      if (!vault.exists()) throw new Error('El usuario aún no ha creado la Bóveda en MCP Hub.');
      const allowed = vault.list().filter((i) => i.agentAccess);
      if (url.pathname === '/agent/vault/list') {
        const q = String(b.query || '').toLowerCase();
        const items = allowed.filter((i) => !q || `${i.name} ${i.service} ${i.notes} ${i.url} ${i.type}`.toLowerCase().includes(q))
          .map(({ id, name, type, service, url: u, username, envVar, notes }) => ({ id, name, type, service, url: u, username, envVar, notes }));
        vault.record({ client: b.client, item: q ? `búsqueda "${q}"` : 'lista', action: 'listar' });
        return send(res, 200, { items });
      }
      if (url.pathname === '/agent/vault/get') {
        const n = String(b.name || '').toLowerCase();
        const meta = allowed.find((i) => i.id === b.name || i.name.toLowerCase() === n) || allowed.find((i) => i.name.toLowerCase().includes(n));
        if (!meta) throw new Error(`No hay ninguna credencial accesible llamada "${b.name}". Usa vault_list.`);
        const it = vault.get(meta.id);
        vault.record({ client: b.client, item: it.name, action: 'leer secreto' });
        const out = { name: it.name, type: it.type, service: it.service || undefined, url: it.url || undefined, username: it.username || undefined,
          secret: it.secret || undefined, envVar: it.envVar || undefined, host: it.host || undefined, port: it.port || undefined,
          database: it.database || undefined, connectionString: connectionString(it), notes: it.notes || undefined };
        return send(res, 200, { item: out });
      }
      return send(res, 404, { error: 'No encontrado' });
    } catch (e) { return send(res, 400, { error: e.message }); }
  }
  if (url.pathname.startsWith('/dz/') && req.method === 'GET') return serveDesign(req, res, url);
  if (/^\/api\/design\/(thumb|shot|export)$/.test(url.pathname) && req.method === 'GET') {
    if (req.headers['x-token'] !== TOKEN && url.searchParams.get('token') !== TOKEN) return send(res, 401, { error: 'token' });
    return serveDesignBinary(req, res, url);
  }
  if (url.pathname.startsWith('/api/')) {
    if (req.headers['x-token'] !== TOKEN) return send(res, 401, { error: 'token' });
    const fn = routes[key];
    if (!fn) return send(res, 404, { error: 'No encontrado' });
    try { send(res, 200, await fn(req.method === 'POST' ? await body(req) : {}, url, req)); }
    catch (e) { send(res, 400, { error: e.message }); }
    return;
  }
  const fontDir = /^\/vendor\/(geist|geist-mono)\/(.+)$/.exec(url.pathname);
  let file = fontDir ? path.join(ROOT, 'node_modules/@fontsource-variable', fontDir[1], path.normalize(fontDir[2]))
    : STATIC[url.pathname] ? path.join(ROOT, STATIC[url.pathname])
    : path.join(ROOT, 'public', url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    if (file.endsWith('index.html')) data = Buffer.from(data.toString().replace('__TOKEN__', req.remote ? 'remote' : TOKEN)
      .replace('<meta name="google"', `<meta name="remote" content="${req.remote ? 1 : 0}">\n  <meta name="google"`));
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
}
const server = http.createServer(handle);

// ---------------- WebSocket ----------------
const wss = new WebSocketServer({ noServer: true });
const listeners = new Set();
function broadcast() {
  const msg = JSON.stringify({ t: 'sessions', sessions: [...sessions.values()].map(sessionInfo) });
  for (const ws of listeners) ws.send(msg);
  persistSessions();
}
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  const origin = req.headers.origin || '';
  if (!hostOk(req.headers.host) || url.searchParams.get('token') !== TOKEN || (origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))) {
    socket.destroy(); return;
  }
  upgradeWs(req, socket, head, url);
});
function upgradeWs(req, socket, head, url) {
  wss.handleUpgrade(req, socket, head, (ws) => {
    if (url.pathname === '/ws/events') {
      listeners.add(ws); ws.on('close', () => listeners.delete(ws));
      return;
    }
    const s = sessions.get(url.pathname.replace('/ws/term/', ''));
    if (!s) return ws.close();
    ws.send(s.buf);
    s.sockets.add(ws);
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (s.exited) return;
      if (m.t === 'i') s.pty.write(m.d);
      else if (m.t === 'r' && m.cols > 0 && m.rows > 0) s.pty.resize(m.cols, m.rows);
    });
    ws.on('close', () => s.sockets.delete(ws));
  });
}

// ---------------- Acceso remoto (móvil y tablet) ----------------
// El móvil usa la misma interfaz servida por HTTPS (Wi-Fi) o por Tailscale. Cada dispositivo se vincula una vez con un QR
// y recibe una cookie propia; el token interno de la interfaz nunca sale del ordenador.
const LAN_PORT = Number(process.env.MCP_HUB_LAN_PORT || 7778), TS_PORT = Number(process.env.MCP_HUB_TS_PORT || 7779);
// Puerto HTTPS en Tailscale: no el 443, que suele estar ocupado por otros servicios (p. ej. contenedores Docker)
const TS_HTTPS_PORT = Number(process.env.MCP_HUB_TS_HTTPS_PORT || 8443);
const TLS_DIR = path.join(CONF_DIR, 'tls');
const pairCodes = new Map();
const usedPairCodes = new Map(); // código → { ip, at } de los recién usados
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
const lanIps = () => Object.entries(os.networkInterfaces())
  .filter(([n]) => !/^(lo|docker|br-|veth|virbr|tailscale|tun|wg)/.test(n))
  .flatMap(([, a]) => a || []).filter((i) => i.family === 'IPv4' && !i.internal).map((i) => i.address);
function ensureCert() {
  fs.mkdirSync(TLS_DIR, { recursive: true, mode: 0o700 });
  const keyF = path.join(TLS_DIR, 'key.pem'), certF = path.join(TLS_DIR, 'cert.pem'), metaF = path.join(TLS_DIR, 'names.json');
  const names = [...lanIps(), '127.0.0.1'].sort();
  let ok = false;
  try { ok = JSON.stringify(JSON.parse(fs.readFileSync(metaF, 'utf8'))) === JSON.stringify(names) && fs.existsSync(keyF) && fs.existsSync(certF); } catch {}
  if (!ok) {
    const host = os.hostname();
    const san = [...names.map((i) => `IP:${i}`), `DNS:${host}`, `DNS:${host}.local`, 'DNS:localhost'].join(',');
    try {
      execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '3650', '-keyout', keyF, '-out', certF,
        '-subj', '/CN=MCP Hub', '-addext', `subjectAltName=${san}`], { stdio: 'ignore' });
    } catch {
      // Sin openssl (Windows, algunos Mac): certificado propio generado en JavaScript
      const pems = selfsigned.generate([{ name: 'commonName', value: 'MCP Hub' }], { keySize: 2048, days: 3650, algorithm: 'sha256',
        extensions: [{ name: 'subjectAltName', altNames: [...names.map((ip) => ({ type: 7, ip })), { type: 2, value: host }, { type: 2, value: `${host}.local` }, { type: 2, value: 'localhost' }] }] });
      fs.writeFileSync(keyF, pems.private); fs.writeFileSync(certF, pems.cert);
    }
    fs.chmodSync(keyF, 0o600);
    fs.writeFileSync(metaF, JSON.stringify(names));
  }
  const cert = fs.readFileSync(certF);
  return { key: fs.readFileSync(keyF), cert, fingerprint: new crypto.X509Certificate(cert).fingerprint256 };
}
const deviceName = (ua = '') => {
  const os_ = /iPad/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android' : 'Tablet Android') : /Mac OS/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Dispositivo';
  const br = /EdgA?\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Navegador';
  return `${os_} · ${br}`;
};
function deviceFrom(req) {
  const m = /(?:^|;\s*)mcphub_dev=([0-9a-f]{12})\.([0-9a-f]{48})/.exec(req.headers.cookie || '');
  const d = m && db.devices[m[1]];
  if (!d || d.hash.length !== 64 || !crypto.timingSafeEqual(Buffer.from(d.hash), Buffer.from(sha(m[2])))) return null;
  if (Date.now() - (d.lastSeen || 0) > 60_000) { d.lastSeen = Date.now(); d.via = req.via; save(); }
  return { id: m[1], ...d };
}
const PAGE = (title, body) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0A0A0A;color:#F5F5F4;font:16px/1.5 system-ui,sans-serif;padding:24px;box-sizing:border-box}
.b{max-width:420px;text-align:center}img{width:64px;height:64px}h1{font-size:22px;margin:16px 0 8px}p{color:#A3A3A1}b{color:#FFA261}</style></head><body><div class="b"><img src="/icon.svg" alt="">${body}</div></body></html>`;
// Contraseña para entrar por Tailscale (se pide la primera vez en cada dispositivo)
const hashPass = (pw, salt) => crypto.scryptSync(String(pw), Buffer.from(salt, 'hex'), 32).toString('hex');
const checkPass = (pw) => { const p = db.remote.pass; if (!p) return false; const h = hashPass(pw, p.salt); return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(p.hash)); };
const loginFails = new Map();
// Límite global (además del de cada IP): con Funnel la dirección es pública y podrían probar desde muchas IPs
const globalFails = { n: 0, since: Date.now(), until: 0 };
const LOGIN_PAGE = (msg = '') => PAGE('Entrar en MCP Hub', `<h1>MCP Hub</h1><p>Escribe la contraseña de acceso para vincular este dispositivo. Solo se pide la primera vez.</p>
<form id="f" style="display:flex;flex-direction:column;gap:12px;margin-top:18px">
<input id="p" type="password" autocomplete="current-password" placeholder="Contraseña" required style="height:48px;border-radius:12px;border:1px solid #333333;background:#131313;color:#F5F5F4;padding:0 14px;font-size:16px">
<button style="height:48px;border:0;border-radius:12px;background:#FF7A1A;color:#0A0A0A;font-size:16px;font-weight:600">Entrar</button>
<p id="e" style="color:#FF9A9A;min-height:20px;margin:0">${msg}</p></form>
<script>document.getElementById('f').onsubmit=async(ev)=>{ev.preventDefault();const r=await fetch('/login',{method:'POST',headers:{'content-type':'application/json','x-login':'1'},body:JSON.stringify({password:document.getElementById('p').value})});
if(r.ok)location.replace('/');else{const j=await r.json().catch(()=>({}));document.getElementById('e').textContent=j.error||'No se pudo entrar';}};document.getElementById('p').focus();</script>`);
function newDevice(req, res, via) {
  const id = crypto.randomBytes(6).toString('hex'), secret = crypto.randomBytes(24).toString('hex');
  db.devices[id] = { name: deviceName(req.headers['user-agent']), hash: sha(secret), created: Date.now(), lastSeen: Date.now(), via };
  save(); broadcastRemote();
  return `mcphub_dev=${id}.${secret}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`;
}
const PUBLIC = /^\/(manifest\.webmanifest|sw\.js|icon[\w-]*\.(svg|png)|design-inject\.js|style\.css|logos\/[\w.-]+|vendor\/geist(-mono)?\/.+)$/;
// Registro de accesos remotos (útil para diagnosticar y para ver quién entra desde internet). Sin parámetros: no guarda códigos.
const REMOTE_LOG = path.join(HOME, '.local', 'state', 'mcp-hub-remote.log');
function logRemote(req, via, res) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const t0 = Date.now();
  res.on('finish', () => {
    const line = `${new Date().toISOString()} ${via} ${ip} ${req.method} ${req.url.split('?')[0].slice(0, 120)} ${res.statusCode} ${Date.now() - t0}ms ${deviceFrom(req) ? 'dispositivo' : 'anónimo'} "${String(req.headers['user-agent'] || '').slice(0, 80)}"\n`;
    fs.appendFile(REMOTE_LOG, line, () => {});
  });
}
function remoteHandler(via) {
  return async (req, res) => {
    logRemote(req, via, res);
    req.remote = true; req.via = via;
    req.remoteOrigin = `https://${req.headers.host}`;
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/agent/')) { res.writeHead(403); return res.end(); }
    if (via === 'tailscale' && url.pathname === '/login' && req.method === 'POST') {
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
      const f = loginFails.get(ip) || { n: 0, until: 0 };
      const reply = (code, body, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(body)); };
      if (req.headers['x-login'] !== '1') return reply(403, { error: 'No permitido' });
      if (f.until > Date.now()) return reply(429, { error: `Demasiados intentos. Espera ${Math.ceil((f.until - Date.now()) / 1000)} s.` });
      if (Date.now() - globalFails.since > 3600_000) Object.assign(globalFails, { n: 0, since: Date.now() });
      if (globalFails.until > Date.now()) return reply(429, { error: 'Acceso bloqueado temporalmente por demasiados intentos fallidos. Prueba más tarde.' });
      if (!db.remote.pass) return reply(403, { error: 'Todavía no hay contraseña. Configúrala en el ordenador: MCP Hub → Móvil.' });
      let b = {}; try { b = await body(req); } catch {}
      if (!checkPass(b.password || '')) {
        f.n++; if (f.n >= 5) { f.until = Date.now() + Math.min(60_000 * 2 ** (f.n - 5), 3600_000); }
        loginFails.set(ip, f);
        if (++globalFails.n >= 30) {
          globalFails.until = Date.now() + 30 * 60_000;
          messenger.notify('security', `⚠️ MCP Hub: ${globalFails.n} intentos fallidos de contraseña en la última hora. El acceso remoto con contraseña queda bloqueado 30 minutos.`, { subject: 'Intentos de acceso', urgent: true });
        }
        return reply(401, { error: 'Contraseña incorrecta' });
      }
      loginFails.delete(ip);
      const cookie = newDevice(req, res, via);
      messenger.notify('security', `🔐 MCP Hub: se ha vinculado un dispositivo nuevo con la contraseña (${deviceName(req.headers['user-agent'])}, IP ${ip}). Si no has sido tú, quítalo en Móvil → Dispositivos y cambia la contraseña.`, { subject: 'Dispositivo nuevo', urgent: true });
      return reply(200, { ok: true }, { 'set-cookie': cookie });
    }
    if (url.pathname === '/pair' && via === 'tailscale') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(LOGIN_PAGE());
    }
    if (url.pathname === '/pair') {
      const code = url.searchParams.get('c') || '', p = pairCodes.get(code);
      pairCodes.delete(code);
      // El mismo código otra vez desde la misma IP al momento (doble toque en «Conectar»): ya está vinculado, solo entra
      const ip = req.socket.remoteAddress, used = usedPairCodes.get(code);
      if (!p && used && used.ip === ip && Date.now() - used.at < 30000) { res.writeHead(302, { location: '/' }); return res.end(); }
      if (p) { usedPairCodes.set(code, { ip, at: Date.now() }); for (const [c, u] of usedPairCodes) if (Date.now() - u.at > 30000) usedPairCodes.delete(c); }
      if (!p || p.expires < Date.now()) {
        res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(PAGE('Código caducado', '<h1>Este código ya no vale</h1><p>Genera uno nuevo en el ordenador: MCP Hub → <b>Móvil</b> → Vincular dispositivo.</p>'));
      }
      res.writeHead(302, { location: '/', 'set-cookie': newDevice(req, res, via) });
      return res.end();
    }
    const dev = deviceFrom(req);
    if (!dev) {
      if (PUBLIC.test(url.pathname) || url.pathname.startsWith('/dz/')) return handle(req, res);
      if ((url.pathname === '/' || url.pathname === '/index.html') && via === 'tailscale') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(LOGIN_PAGE(db.remote.pass ? '' : 'Primero configura una contraseña en el ordenador: MCP Hub → Móvil.'));
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        res.writeHead(401, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(PAGE('Vincular dispositivo', '<h1>Vincula este dispositivo</h1><p>En el ordenador abre MCP Hub → <b>Móvil</b> → <b>Vincular dispositivo</b> y escanea el código QR con este móvil o tablet.</p>'));
      }
      res.writeHead(401); return res.end();
    }
    req.device = dev;
    if (url.pathname.startsWith('/api/')) {
      // El encabezado propio obliga a los navegadores a hacer preflight: otra web no puede usar la cookie para llamar a la API
      if (req.headers['x-token'] === 'remote') req.headers['x-token'] = TOKEN;
      else if (req.method === 'GET' && url.searchParams.get('token') === 'remote') { url.searchParams.set('token', TOKEN); req.url = url.pathname + url.search; }
      else { res.writeHead(403); return res.end(); }
    }
    return handle(req, res);
  };
}
function remoteUpgrade(via) {
  return (req, socket, head) => {
    req.via = via;
    const url = new URL(req.url, 'http://x');
    if (!deviceFrom(req) || url.searchParams.get('token') !== 'remote' || (req.headers.origin && req.headers.origin !== `https://${req.headers.host}`)) { socket.destroy(); return; }
    upgradeWs(req, socket, head, url);
  };
}
const remote = { lan: null, ts: null, lanError: null, tsError: null, fingerprint: null };
function startRemote() {
  if (db.remote.lan && !remote.lan) {
    try {
      const t = ensureCert(); remote.fingerprint = t.fingerprint;
      remote.lan = https.createServer({ key: t.key, cert: t.cert }, remoteHandler('wifi'));
      remote.lan.on('upgrade', remoteUpgrade('wifi'));
      remote.lan.on('error', (e) => { remote.lanError = e.message; remote.lan = null; broadcastRemote(); });
      remote.lan.listen(LAN_PORT, '0.0.0.0', () => { remote.lanError = null; broadcastRemote(); });
    } catch (e) { remote.lanError = e.message; remote.lan = null; }
  } else if (!db.remote.lan && remote.lan) { remote.lan.close(); remote.lan.closeAllConnections?.(); remote.lan = null; }
  if (db.remote.tailscale && !remote.ts) {
    remote.ts = http.createServer(remoteHandler('tailscale'));
    remote.ts.on('upgrade', remoteUpgrade('tailscale'));
    remote.ts.on('error', (e) => { remote.tsError = e.message; remote.ts = null; broadcastRemote(); });
    remote.ts.listen(TS_PORT, '127.0.0.1', () => { remote.tsError = null; broadcastRemote(); });
  } else if (!db.remote.tailscale && remote.ts) { remote.ts.close(); remote.ts.closeAllConnections?.(); remote.ts = null; }
}
const broadcastRemote = () => { const m = JSON.stringify({ t: 'remote' }); for (const ws of listeners) ws.send(m); };
const runQuiet = (cmd, args) => new Promise((resolve) => execFile(cmd, args, { timeout: 20000 }, (e, out, err) => resolve({ ok: !e, out: String(out || ''), err: String(err || e?.message || '') })));
async function tailscaleInfo() {
  if (!which('tailscale')) return { installed: false };
  const st = await runQuiet('tailscale', ['status', '--json']);
  let j = {}; try { j = JSON.parse(st.out); } catch {}
  const dns = (j.Self?.DNSName || '').replace(/\.$/, '');
  const serve = await runQuiet('tailscale', ['serve', 'status', '--json']);
  let sj = {}; try { sj = JSON.parse(serve.out || '{}'); } catch {}
  const serving = JSON.stringify(sj).includes(`:${TS_HTTPS_PORT}`) && JSON.stringify(sj).includes(`127.0.0.1:${TS_PORT}`);
  const funnel = Object.entries(sj.AllowFunnel || {}).some(([k, v]) => v && k.endsWith(`:${TS_HTTPS_PORT}`));
  return { installed: true, state: j.BackendState || (st.ok ? 'Unknown' : 'Stopped'), dns, url: dns ? `https://${dns}:${TS_HTTPS_PORT}` : null, serving, funnel, error: st.ok ? null : st.err.trim().slice(0, 300) };
}
async function remoteState(req) {
  const ts = await tailscaleInfo();
  return {
    lan: { enabled: !!db.remote.lan, running: !!remote.lan?.listening, error: remote.lanError, port: LAN_PORT, fingerprint: remote.fingerprint,
      urls: lanIps().map((ip) => `https://${ip}:${LAN_PORT}`), firewall: which('ufw') ? `sudo ufw allow from ${(lanIps()[0] || '192.168.1.0').replace(/\.\d+$/, '.0')}/24 to any port ${LAN_PORT} proto tcp` : null },
    tailscale: { ...ts, passwordSet: !!db.remote.pass, enabled: !!db.remote.tailscale, running: !!remote.ts?.listening, error: remote.tsError || ts.error, port: TS_PORT, user: os.userInfo().username },
    devices: Object.entries(db.devices).map(([id, d]) => ({ id, name: d.name, created: d.created, lastSeen: d.lastSeen, via: d.via })).sort((a, b) => b.lastSeen - a.lastSeen),
    current: req?.device?.id || null,
  };
}
async function pairLinks() {
  const code = crypto.randomBytes(9).toString('base64url');
  const expires = Date.now() + 10 * 60_000;
  pairCodes.set(code, { expires });
  for (const [c, p] of pairCodes) if (p.expires < Date.now()) pairCodes.delete(c);
  const links = [];
  const ts = db.remote.tailscale ? await tailscaleInfo() : null;
  if (ts?.url && ts.serving) links.push({ label: 'Desde cualquier sitio (Tailscale)', url: `${ts.url}/`, password: true });
  if (db.remote.lan) for (const u of lanIps().map((ip) => `https://${ip}:${LAN_PORT}`)) links.push({ label: 'En casa (Wi‑Fi)', url: `${u}/pair?c=${code}` });
  for (const l of links) l.qr = await QRCode.toString(l.url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0A0B0E', light: '#FFFFFF' } });
  return { code, expires, links };
}
Object.assign(routes, {
  'GET /api/remote': async (_b, _u, req) => remoteState(req),
  'POST /api/remote/settings': async (b, _u, req) => {
    if (b.lan !== undefined) db.remote.lan = !!b.lan;
    if (b.tailscale !== undefined) db.remote.tailscale = !!b.tailscale;
    save(); startRemote();
    await new Promise((r) => setTimeout(r, 300));
    return remoteState(req);
  },
  'POST /api/remote/pair': async () => pairLinks(),
  'POST /api/remote/funnel': async (b, _u, req) => {
    if (!which('tailscale')) throw new Error('Tailscale no está instalado');
    if (b.on && !db.remote.pass) throw new Error('Configura antes una contraseña: con Funnel la dirección es pública en internet');
    const r = await runQuiet('tailscale', b.on ? ['funnel', '--bg', `--https=${TS_HTTPS_PORT}`, `http://127.0.0.1:${TS_PORT}`] : ['funnel', `--https=${TS_HTTPS_PORT}`, 'off']);
    if (!r.ok) {
      const msg = (r.err + r.out).trim();
      const link = /https:\/\/login\.tailscale\.com\/\S+/.exec(msg)?.[0];
      if (link) throw new Error(`Activa Funnel en tu red de Tailscale (un clic) y vuelve a intentarlo: ${link}`);
      throw new Error(msg.slice(0, 400) || 'No se pudo cambiar Funnel');
    }
    if (!b.on) await runQuiet('tailscale', ['serve', '--bg', `--https=${TS_HTTPS_PORT}`, `http://127.0.0.1:${TS_PORT}`]);
    return remoteState(req);
  },
  'POST /api/remote/password': async (b, _u, req) => {
    const pw = String(b.password || '');
    if (pw.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
    if (db.remote.pass && req?.remote && !checkPass(b.current || '')) throw new Error('La contraseña actual no es correcta');
    const salt = crypto.randomBytes(16).toString('hex');
    db.remote.pass = { salt, hash: hashPass(pw, salt), at: Date.now() };
    save();
    return remoteState(req);
  },
  'POST /api/remote/devices/delete': async (b, _u, req) => { delete db.devices[b.id]; save(); return remoteState(req); },
  'POST /api/remote/devices/rename': async (b, _u, req) => { if (db.devices[b.id]) { db.devices[b.id].name = String(b.name || '').slice(0, 60); save(); } return remoteState(req); },
  'POST /api/remote/tailscale-serve': async (_b, _u, req) => {
    if (!which('tailscale')) throw new Error('Tailscale no está instalado');
    const r = await runQuiet('tailscale', ['serve', '--bg', `--https=${TS_HTTPS_PORT}`, `http://127.0.0.1:${TS_PORT}`]);
    if (!r.ok) {
      const msg = (r.err + r.out).trim();
      if (/access denied|permission|operator/i.test(msg)) throw new Error(`Falta permiso. Ejecuta una vez en una terminal: sudo tailscale set --operator=${os.userInfo().username}`);
      const link = /https:\/\/login\.tailscale\.com\/\S+/.exec(msg)?.[0];
      if (link) throw new Error(`Activa HTTPS en tu red de Tailscale y vuelve a intentarlo: ${link}`);
      throw new Error(msg.slice(0, 400) || 'No se pudo activar tailscale serve');
    }
    return remoteState(req);
  },
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') { console.error(`El puerto ${PORT} ya está en uso (¿MCP Hub ya está abierto?)`); process.exit(3); }
  throw e;
});
// Los MCP propios ya registrados se actualizan a la carpeta fija y al Node actual (p. ej. tras instalar la app o moverla)
function refreshHubServers() {
  const files = { [VAULT_SERVER]: 'vault-mcp.js', [AGENTS_SERVER]: 'agents-mcp.js', [DESIGN_SERVER]: 'design-mcp.js', [MSG_SERVER]: 'messaging-mcp.js', [EXTRAS_SERVER]: 'extras-mcp.js' };
  for (const [name, f] of Object.entries(files)) {
    const cur = db.servers[name];
    if (!cur) continue;
    const want = hubScript(f);
    if (cur.command === want.command && JSON.stringify(cur.args) === JSON.stringify(want.args) && JSON.stringify(cur.env || {}) === JSON.stringify(want.env)) continue;
    Object.assign(cur, want);
    save();
    applyAll(name).catch((e) => console.error('No se pudo actualizar', name, e.message));
  }
}
server.listen(PORT, '127.0.0.1', () => { console.log(`MCP Hub en http://127.0.0.1:${PORT}`); messenger.start(); startRemote(); refreshHubServers(); });

const shutdown = () => { persistSessions(true); shuttingDown = true; for (const s of sessions.values()) try { s.pty.kill(); } catch {} process.exit(0); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
