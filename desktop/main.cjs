// MCP Hub como aplicación de escritorio (Windows, macOS y Linux).
// Arranca el servidor de MCP Hub con el Node que trae la propia app (no hace falta tener Node instalado)
// y lo abre en una ventana. Si ya hay un MCP Hub en marcha en el puerto, se usa ese.
const { app, BrowserWindow, shell, dialog, Menu, nativeTheme } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');

const PORT = Number(process.env.MCP_HUB_PORT || 7777);
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.join(__dirname, '..');
const DATA = process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'mcp-hub')
  : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support', 'mcp-hub')
  : path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'mcp-hub');
const LOG = path.join(DATA, 'server.log');

let server = null; // proceso del servidor si lo hemos arrancado nosotros
let win = null;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

const ping = () => new Promise((resolve) => {
  const req = http.get(`${BASE}/icon.svg`, { timeout: 1500 }, (res) => { res.resume(); resolve(res.statusCode === 200); });
  req.on('error', () => resolve(false));
  req.on('timeout', () => { req.destroy(); resolve(false); });
});

async function startServer() {
  if (await ping()) return true; // ya hay uno (p. ej. arrancado desde la terminal)
  fs.mkdirSync(DATA, { recursive: true });
  const out = fs.openSync(LOG, 'a');
  fs.writeSync(out, `\n--- ${new Date().toISOString()} · MCP Hub ${app.getVersion()} (${process.platform}-${process.arch})\n`);
  server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', MCP_HUB_APP: '1', MCP_HUB_PORT: String(PORT) },
    stdio: ['ignore', out, out], windowsHide: true,
  });
  server.on('exit', (code) => { server = null; if (code && win && !app.isQuitting) dialog.showErrorBox('MCP Hub se ha detenido', `El servidor terminó con el código ${code}.\nRegistro: ${LOG}`); });
  for (let i = 0; i < 100; i++) { if (await ping()) return true; await new Promise((r) => setTimeout(r, 200)); }
  return false;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600, title: 'MCP Hub', show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0A0A0A' : '#FFFFFF', autoHideMenuBar: true,
    icon: path.join(ROOT, 'public', 'icon-512.png'),
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());
  // Enlaces: los de MCP Hub (p. ej. «Abrir en una ventana» de Diseño) en otra ventana de la app; el resto, en el navegador
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(BASE + '/')) return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: path.join(ROOT, 'public', 'icon-512.png') } };
    if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(BASE + '/')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.loadURL(`${BASE}/`);
  win.on('closed', () => { win = null; });
}

app.whenReady().then(async () => {
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
  const ok = await startServer();
  if (!ok) {
    dialog.showErrorBox('No se pudo arrancar MCP Hub', `El servidor no respondió en el puerto ${PORT}.\nRevisa el registro: ${LOG}`);
    app.quit();
    return;
  }
  createWindow();
  app.on('activate', () => { if (!win) createWindow(); });
});

app.on('before-quit', () => { app.isQuitting = true; });
app.on('window-all-closed', () => app.quit());
// Al salir se para el servidor que arrancamos (y con él las terminales abiertas)
app.on('will-quit', () => { if (server) { try { server.kill(); } catch {} } });
