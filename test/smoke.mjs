// Prueba de humo multiplataforma (Linux, macOS y Windows). La ejecuta GitHub Actions antes y después de empaquetar.
//   node test/smoke.mjs              → prueba el código fuente con el Node del sistema
//   node test/smoke.mjs --packaged   → prueba el servidor de la app ya empaquetada (dist/*-unpacked) con el Node de Electron
// Usa una carpeta personal temporal: no toca la configuración real.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGED = process.argv.includes('--packaged');
const PORT = 17000 + Math.floor(Math.random() * 900);
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mcphub-smoke-'));
const IS_WIN = process.platform === 'win32';
let failed = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FALLO'} ${name}${extra ? ` — ${extra}` : ''}`); if (!cond) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 1. Módulo de plataforma (solo con el código fuente) ----
if (!PACKAGED) {
  const P = await import('../lib/platform.js');
  ok('which encuentra node', !!P.which('node'), P.which('node'));
  ok('which encuentra npm', !!P.which('npm'), P.which('npm'));
  const run = (cmd, args) => new Promise((resolve) => P.execCommand(cmd, args, { timeout: 60000 }, (e, out, err) => resolve({ e, out: String(out), err: String(err) })));
  const npmV = await run('npm', ['--version']);
  ok('lanza npm (en Windows, un .cmd)', !npmV.e && /^\d+\.\d+/.test(npmV.out.trim()), npmV.e?.message || npmV.out.trim());
  // Un argumento difícil: comillas, apóstrofo, salto de línea y caracteres especiales de cmd.exe (como el prompt de un agente)
  const hard = `Línea 1 "con comillas" y l'apóstrofo\nLínea 2 & | < > ^ % ! $HOME`;
  const echo = await run('node', ['-e', 'process.stdout.write(JSON.stringify(process.argv[1]))', hard]);
  ok('argumento difícil llega intacto', echo.out === JSON.stringify(hard), echo.out.slice(0, 120) || echo.err.slice(0, 200));
  // Un CLI de npm instalado de verdad (en Windows es un shim .cmd que hay que resolver sin cmd.exe)
  const prefix = path.join(HOME, 'npm-global');
  await new Promise((r) => P.execCommand('npm', ['install', '-g', '--prefix', prefix, 'cowsay@1.6.0'], { timeout: 180000 }, r));
  const binDir = IS_WIN ? prefix : path.join(prefix, 'bin');
  process.env.PATH = binDir + path.delimiter + process.env.PATH;
  const cow = await run('cowsay', [hard]);
  ok('CLI de npm con argumento difícil', !cow.e && cow.out.includes("l'apóstrofo") && cow.out.includes('Línea 2 & | < > ^ % !'), cow.e?.message || cow.out.slice(0, 200));
  // La shell de las terminales ejecuta un comando escrito con commandLine (así se lanzan los agentes)
  const pty = (await import('node-pty')).default;
  P.ensurePtyHelper();
  const sh = P.terminalShell();
  const line = P.commandLine(['node', '-e', 'console.log("Q_" + (1 + 1) + " it\'s ok")']);
  const out = await new Promise((resolve) => {
    let buf = '';
    const p = pty.spawn(sh.file, sh.args(line), { name: 'xterm-256color', cols: 120, rows: 30, cwd: HOME, env: process.env, useConpty: true });
    p.onData((d) => { buf += d; });
    setTimeout(() => { try { p.kill(); } catch {} resolve(buf); }, 15000);
    const t = setInterval(() => { if (buf.includes("Q_2 it's ok")) { clearInterval(t); try { p.kill(); } catch {} resolve(buf); } }, 200);
  });
  ok(`terminal (${sh.name}) ejecuta un comando de agente`, out.includes("Q_2 it's ok"), out.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').slice(-200));
}
// ---- 2. Servidor completo ----
// Con --packaged se prueban todas las apps empaquetadas que haya (en macOS, la de Apple y la de Intel)
function serverCommands() {
  if (!PACKAGED) return [{ cmd: process.execPath, args: [path.join(ROOT, 'server.js')], env: {}, label: '' }];
  const dist = path.join(ROOT, 'dist');
  const cands = IS_WIN ? [path.join(dist, 'win-unpacked', 'MCP Hub.exe')]
    : process.platform === 'darwin' ? fs.readdirSync(dist).filter((d) => /^mac/.test(d)).map((d) => path.join(dist, d, 'MCP Hub.app', 'Contents', 'MacOS', 'MCP Hub'))
    : [path.join(dist, 'linux-unpacked', 'mcp-hub')];
  const exes = cands.filter((c) => fs.existsSync(c));
  if (!exes.length) throw new Error('No encuentro la app empaquetada en dist/');
  return exes.map((exe) => {
    const appDir = process.platform === 'darwin' ? path.join(exe, '..', '..', 'Resources', 'app') : path.join(path.dirname(exe), 'resources', 'app');
    return { cmd: exe, args: [path.join(appDir, 'server.js')], env: { ELECTRON_RUN_AS_NODE: '1' }, label: ` (app empaquetada: ${path.relative(dist, exe).split(path.sep)[0]})` };
  });
}

async function testServer(sc) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mcphub-smoke-'));
  const env = { ...process.env, ...sc.env, HOME: home, USERPROFILE: home, LOCALAPPDATA: path.join(home, 'AppData', 'Local'), MCP_HUB_PORT: String(PORT), MCP_HUB_LAN_PORT: String(PORT + 1), MCP_HUB_TS_PORT: String(PORT + 2) };
  delete env.XDG_DATA_HOME; delete env.XDG_CONFIG_HOME;
  const srv = spawn(sc.cmd, sc.args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  srv.stdout.on('data', (d) => { log += d; }); srv.stderr.on('data', (d) => { log += d; });
  let up = false, exit = null;
  srv.on('exit', (code, signal) => { exit = `terminó con código ${code}${signal ? ` (${signal})` : ''}`; });
  // Hasta 2 min: la versión Intel en un Mac con chip Apple pasa antes por Rosetta, que tarda la primera vez
  for (let i = 0; i < 400 && !up && !exit; i++) { await sleep(300); up = await fetch(`http://127.0.0.1:${PORT}/icon.svg`).then((r) => r.ok).catch(() => false); }
  ok(`servidor arranca${sc.label}`, up, up ? '' : `${exit || 'no responde'} · ${log.slice(-800)}`);
  if (up) {
    const T = fs.readFileSync(path.join(home, '.config', 'mcp-hub', 'ui-token'), 'utf8').trim();
    const api = (p, body) => fetch(`http://127.0.0.1:${PORT}${p}`, { method: body ? 'POST' : 'GET', headers: { 'x-token': T, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then((r) => r.json());
    const st = await api('/api/state');
    ok('API responde', !!st && !st.error, st?.error);
    const idx = await fetch(`http://127.0.0.1:${PORT}/`).then((r) => r.text());
    ok('interfaz se sirve', idx.includes('MCP Hub') && !idx.includes('__TOKEN__'));
    const r = await api('/api/sessions', { client: 'shell', cwd: home });
    ok('abre una terminal', !!r.session?.id, r.error);
    if (r.session?.id) {
      const { default: WebSocket } = await import('ws');
      const out = await new Promise((resolve) => {
        let buf = '';
        const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/term/${r.session.id}?token=${T}`);
        ws.on('message', (d) => { buf += d.toString(); if (/PTY_OK_42/.test(buf)) { ws.close(); resolve(buf); } });
        ws.on('open', () => setTimeout(() => ws.send(JSON.stringify({ t: 'i', d: (IS_WIN ? 'Write-Output ("PTY_OK_" + (40+2))' : 'echo PTY_OK_$((40+2))') + '\r' })), 2500));
        setTimeout(() => { ws.close(); resolve(buf); }, 20000);
      });
      ok('la terminal ejecuta comandos', /PTY_OK_42/.test(out), out.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').slice(-200));
    }
    const rt = path.join(IS_WIN ? path.join(home, 'AppData', 'Local') : process.platform === 'darwin' ? path.join(home, 'Library', 'Application Support') : path.join(home, '.local', 'share'), 'mcp-hub', 'runtime', 'agents-mcp.js');
    ok('scripts auxiliares instalados', fs.existsSync(rt), rt);
  }
  try { srv.kill(); } catch {}
  await new Promise((r) => { if (srv.exitCode !== null) r(); else { srv.once('exit', r); setTimeout(r, 5000); } });
  try { fs.rmSync(home, { recursive: true, force: true }); } catch {}
}

for (const sc of serverCommands()) await testServer(sc);
try { fs.rmSync(HOME, { recursive: true, force: true }); } catch {}
console.log(failed ? `\n${failed} prueba(s) fallida(s)` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
