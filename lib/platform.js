// Diferencias entre Linux, macOS y Windows en un solo sitio: buscar programas, lanzarlos, abrir carpetas,
// la shell de las terminales y cómo se escriben los comandos para ella.
// No importa nada del proyecto: lo usan también los scripts que se copian a la carpeta de ejecución (delegate-run.js…).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const IS_WIN = process.platform === 'win32';
export const IS_MAC = process.platform === 'darwin';
const HOME = os.homedir();

// Extensiones ejecutables en Windows (PATHEXT), de más a menos preferida
const WIN_EXTS = ['.exe', '.cmd', '.bat', '.com', '.ps1'];

/** Ruta completa de un programa del PATH, o null. En Windows prueba también .exe/.cmd/.bat… */
export function which(bin) {
  if (!bin) return null;
  const candidates = (dir) => {
    const p = path.join(dir, bin);
    if (!IS_WIN || path.extname(bin)) return [p];
    return WIN_EXTS.map((e) => p + e);
  };
  if (path.isAbsolute(bin)) {
    for (const p of candidates('')) { try { fs.accessSync(p, IS_WIN ? fs.constants.F_OK : fs.constants.X_OK); if (fs.statSync(p).isFile()) return p; } catch {} }
    return null;
  }
  for (const dir of (process.env.PATH || process.env.Path || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const p of candidates(dir.replace(/^"|"$/g, ''))) {
      try { fs.accessSync(p, IS_WIN ? fs.constants.F_OK : fs.constants.X_OK); if (fs.statSync(p).isFile()) return p; } catch {}
    }
  }
  return null;
}

// Node con el que ejecutar scripts .js: el del sistema si existe; si no, el propio ejecutable (Electron hace de Node con ELECTRON_RUN_AS_NODE)
export function nodeRuntime() {
  if (!process.versions.electron) return { command: process.execPath, env: {} };
  const sys = which('node');
  return sys ? { command: sys, env: {} } : { command: process.execPath, env: { ELECTRON_RUN_AS_NODE: '1' } };
}

// Los "shims" .cmd de npm llaman a node con un script: lo leemos para lanzar el script directamente (sin cmd.exe,
// que rompe los argumentos largos con saltos de línea o comillas, como los prompts de los agentes)
function npmShimTarget(cmdFile) {
  let txt; try { txt = fs.readFileSync(cmdFile, 'utf8'); } catch { return null; }
  const dir = path.dirname(cmdFile);
  const m = /"%(?:~?dp0|dp0)%\\?([^"%]+?)"\s+%\*/i.exec(txt) || /"%~dp0\\?([^"%]+?)"\s+%\*/i.exec(txt);
  if (!m) return null;
  const target = path.join(dir, m[1]);
  if (!fs.existsSync(target)) return null;
  if (/\.(c|m)?js$/i.test(target)) {
    const local = path.join(dir, 'node.exe');
    return { node: fs.existsSync(local) ? local : null, script: target };
  }
  return { exe: target };
}

// Comillas para cmd.exe (solo se usa como último recurso)
const cmdQuote = (a) => (/^[\w\-.:\\/=@,+]+$/.test(a) ? a : `"${String(a).replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1').replace(/[%^&|<>()!]/g, '^$&')}"`);

/** Cómo lanzar `cmd args` en esta plataforma: { command, args, env, windowsVerbatimArguments } */
export function resolveCommand(cmd, args = []) {
  if (!IS_WIN) return { command: cmd, args, env: {} };
  const full = which(cmd) || cmd;
  if (/\.(cmd|bat)$/i.test(full)) {
    const t = npmShimTarget(full);
    if (t?.exe) return { command: t.exe, args, env: {} };
    if (t?.script) {
      const rt = t.node ? { command: t.node, env: {} } : nodeRuntime();
      return { command: rt.command, args: [t.script, ...args], env: rt.env };
    }
    return { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', `"${[full, ...args].map(cmdQuote).join(' ')}"`], env: {}, windowsVerbatimArguments: true };
  }
  if (/\.ps1$/i.test(full)) return { command: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', full, ...args], env: {} };
  return { command: full, args, env: {} };
}

/** spawn() que funciona igual en las tres plataformas (incluidos los .cmd de npm en Windows) */
export function spawnCommand(cmd, args = [], opts = {}) {
  const r = resolveCommand(cmd, args);
  return spawn(r.command, r.args, { ...opts, env: { ...(opts.env || process.env), ...r.env }, windowsVerbatimArguments: r.windowsVerbatimArguments, windowsHide: true });
}
/** execFile() equivalente */
export function execCommand(cmd, args = [], opts = {}, cb) {
  const r = resolveCommand(cmd, args);
  return execFile(r.command, r.args, { ...opts, env: { ...(opts.env || process.env), ...r.env }, windowsVerbatimArguments: r.windowsVerbatimArguments, windowsHide: true }, cb);
}

/** Abre una carpeta, archivo o URL con la aplicación del sistema */
export function openPath(target) {
  const [cmd, args] = IS_WIN ? ['explorer.exe', [target]] : IS_MAC ? ['open', [target]] : ['xdg-open', [target]];
  const c = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: false });
  c.on('error', () => {}); c.unref();
}

// ---- Shell de las terminales ----
const posixQuote = (a) => (/^[A-Za-z0-9_\/.,:=@%+-]+$/.test(a) ? a : `'${String(a).replace(/'/g, `'\\''`)}'`);
const psQuote = (a) => (/^[A-Za-z0-9_\\/.,:=@%+-]+$/.test(a) ? a : `'${String(a).replace(/'/g, "''")}'`);

/** Escribe un comando (programa + argumentos) para la shell de las terminales de esta plataforma */
export function commandLine(argv) {
  if (!IS_WIN) return argv.map(posixQuote).join(' ');
  const [first, ...rest] = argv;
  return `& ${psQuote(first)}${rest.length ? ' ' + rest.map(psQuote).join(' ') : ''}`;
}
export const quoteArg = IS_WIN ? psQuote : posixQuote;

/** La shell de las terminales: { file, args(cmd) } — PowerShell en Windows, la del usuario (login) en Linux y macOS */
export function terminalShell() {
  if (IS_WIN) {
    const file = which('pwsh') || 'powershell.exe';
    return { file, name: path.basename(file), args: (cmd) => (cmd ? ['-NoLogo', '-NoExit', '-Command', cmd] : ['-NoLogo']) };
  }
  const file = process.env.SHELL || (IS_MAC ? '/bin/zsh' : '/bin/bash');
  return { file, name: path.basename(file), args: (cmd) => (cmd ? ['-lc', cmd] : ['-l']) };
}

/** Abre una terminal externa del sistema en `cwd` ejecutando `cmd` (string ya escrito con commandLine) */
export function openExternalTerminal(cwd, cmd, env) {
  const sh = terminalShell();
  let c;
  if (IS_WIN) {
    c = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'start', '""', sh.file, '-NoLogo', '-NoExit', ...(cmd ? ['-Command', cmd] : [])], { cwd, env, detached: true, stdio: 'ignore' });
  } else if (IS_MAC) {
    const script = `cd ${posixQuote(cwd)}${cmd ? `; ${cmd}` : ''}`;
    c = spawn('osascript', ['-e', `tell application "Terminal" to do script ${JSON.stringify(script)}`, '-e', 'tell application "Terminal" to activate'], { env, detached: true, stdio: 'ignore' });
  } else {
    const inner = cmd ? `${cmd}; exec ${posixQuote(sh.file)}` : `exec ${posixQuote(sh.file)}`;
    c = spawn('xdg-terminal-exec', [`--dir=${cwd}`, sh.file, '-lc', inner], { cwd, env, detached: true, stdio: 'ignore' });
  }
  c.on('error', () => {}); c.unref();
}

/** Expande ~ (también ~\ en Windows) */
export const expandHome = (p) => (p ? String(p).replace(/^~(?=$|[\\/])/, HOME) : HOME);

/** Primer ejecutable que exista de una lista (rutas absolutas o nombres del PATH) */
export const firstExisting = (list) => { for (const p of list) { if (!p) continue; if (path.isAbsolute(p) ? fs.existsSync(p) : which(p)) return path.isAbsolute(p) ? p : which(p); } return null; };

// Navegador para capturas y PDF (Chromium, Chrome o Edge)
export function findChromium() {
  const pf = process.env.ProgramFiles || 'C:\\Program Files', pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', la = process.env.LOCALAPPDATA || '';
  return firstExisting(IS_WIN ? [
    `${pf}\\Google\\Chrome\\Application\\chrome.exe`, `${pf86}\\Google\\Chrome\\Application\\chrome.exe`, `${la}\\Google\\Chrome\\Application\\chrome.exe`,
    `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`, `${pf}\\Chromium\\Application\\chrome.exe`,
  ] : IS_MAC ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    path.join(HOME, 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  ] : ['/usr/bin/chromium', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/snap/bin/chromium', '/usr/bin/microsoft-edge', 'chromium', 'google-chrome']);
}
export function findBlender() {
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  let winFound = null;
  if (IS_WIN) { try { const base = `${pf}\\Blender Foundation`; const v = fs.readdirSync(base).filter((d) => /^Blender/i.test(d)).sort().reverse()[0]; if (v) winFound = `${base}\\${v}\\blender.exe`; } catch {} }
  return firstExisting(IS_WIN ? [winFound, 'blender'] : IS_MAC ? ['/Applications/Blender.app/Contents/MacOS/Blender', 'blender'] : ['/usr/bin/blender', '/usr/local/bin/blender', '/opt/blender/blender', '/snap/bin/blender', 'blender']);
}

/** Carpeta de datos de ejecución (scripts copiados, archivos temporales de sesiones) */
// node-pty trae en macOS un «spawn-helper» que npm a veces deja sin permiso de ejecución
// (y entonces todas las terminales fallan con «posix_spawnp failed»): se lo devolvemos.
export function ensurePtyHelper() {
  if (IS_WIN) return;
  let root;
  try { root = path.dirname(path.dirname(fileURLToPath(import.meta.resolve('node-pty')))); } catch { return; }
  for (const dir of ['build/Release', ...['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64'].map((d) => `prebuilds/${d}`)]) {
    const f = path.join(root, dir, 'spawn-helper');
    try { const st = fs.statSync(f); if (!(st.mode & 0o111)) fs.chmodSync(f, 0o755); } catch {}
  }
}

export function dataDir() {
  if (IS_WIN) return path.join(process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local'), 'mcp-hub');
  if (IS_MAC) return path.join(HOME, 'Library', 'Application Support', 'mcp-hub');
  return path.join(process.env.XDG_DATA_HOME || path.join(HOME, '.local', 'share'), 'mcp-hub');
}
