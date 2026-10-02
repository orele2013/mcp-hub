#!/usr/bin/env node
// Captura del diseño actual para que el agente vea su propio resultado (lo usa desde Diseño de MCP Hub).
// Uso, desde la carpeta del proyecto:  node <ruta>/design-shot.mjs [--width 1440] [--height 900] [--full] [--slide N] [--angles]
// Escribe JPG en /tmp y muestra sus rutas: ábrelas con tu herramienta de ver imágenes.
// --angles (objetos 3D): además de la vista inicial, captura de frente, de lado y desde arriba.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const has = (name) => args.includes(`--${name}`);
const dir = process.cwd();
const slug = path.basename(dir);
const PORT = Number(process.env.MCP_HUB_PORT || 7777);
let token;
try { token = fs.readFileSync(path.join(os.homedir(), '.config', 'mcp-hub', 'agent-token'), 'utf8').trim(); }
catch { console.error('No encuentro el token de MCP Hub (~/.config/mcp-hub/agent-token).'); process.exit(1); }

async function shot(extra = {}) {
  const body = { slug, width: Number(opt('width')) || undefined, height: Number(opt('height')) || undefined, full_page: has('full'), slide: Number(opt('slide')) || undefined, ...extra };
  const res = await fetch(`http://127.0.0.1:${PORT}/agent/design/screenshot`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-agent-token': token }, body: JSON.stringify(body) })
    .catch(() => { throw new Error('MCP Hub no está en marcha.'); });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
  return j;
}

try {
  const views = has('angles') ? [['inicial'], ['frente', 'front'], ['lado', 'side'], ['arriba', 'top']] : [['inicial']];
  for (const [label, view] of views) {
    const j = await shot(view ? { view } : {});
    const file = path.join(os.tmpdir(), `mcphub-${slug}-${label}-${Date.now()}.jpg`);
    fs.writeFileSync(file, Buffer.from(j.png, 'base64'));
    console.log(`${label}: ${file} (${j.width}×${j.height}${j.slides ? `, diapositiva ${j.slide} de ${j.slides}` : ''})`);
  }
  if (!has('angles') && fs.existsSync(path.join(dir, 'stage.js'))) console.log('Consejo: con --angles verás también el objeto de frente, de lado y desde arriba.');
} catch (e) { console.error(`No se pudo capturar: ${e.message}`); process.exit(1); }
