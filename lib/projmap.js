// Mapa del proyecto: módulos y dependencias calculados leyendo los imports del código (JS/TS, Python, CSS), sin IA.
// Se recalcula solo cuando cambia el repositorio (commit, archivos modificados o fechas). Opcionalmente un agente
// describe cada módulo; las descripciones se guardan y se conservan para los módulos que siguen existiendo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';

const CODE = /\.(m?[jt]sx?|cjs|vue|svelte|py|css|scss|html?)$/i;
const PKG = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;
const SKIP = /(^|\/)(node_modules|\.git|dist|build|out|coverage|vendor|venv|\.venv|__pycache__|\.next|\.cache|target)(\/|$)/;
const MAX_FILES = 4000, MAX_BYTES = 400_000;
const run = (cwd, cmd, args) => new Promise((res) => execFile(cmd, args, { cwd, maxBuffer: 32 * 1024 * 1024, timeout: 20000 }, (e, out) => res(e ? null : String(out))));

async function listFiles(root) {
  const g = await run(root, 'git', ['ls-files', '-co', '--exclude-standard']);
  let files = g != null ? g.split('\n').filter(Boolean) : null;
  if (!files) {
    files = [];
    const walk = (d) => {
      if (files.length > MAX_FILES * 3) return;
      for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) {
        const rel = d ? `${d}/${e.name}` : e.name;
        if (SKIP.test(rel) || e.name.startsWith('.')) continue;
        if (e.isDirectory()) walk(rel); else files.push(rel);
      }
    };
    walk('');
  }
  return files.filter((f) => CODE.test(f) && !SKIP.test(f)).slice(0, MAX_FILES);
}
async function signature(root, files) {
  const head = (await run(root, 'git', ['rev-parse', 'HEAD'])) || '';
  const status = (await run(root, 'git', ['status', '--porcelain'])) || '';
  let mt = 0;
  if (!head) for (const f of files) { try { mt = Math.max(mt, fs.statSync(path.join(root, f)).mtimeMs); } catch {} }
  // Con git: commit + cambios sin confirmar (y la fecha de los modificados, para notar ediciones sucesivas)
  if (head) for (const l of status.split('\n').filter(Boolean)) { try { mt = Math.max(mt, fs.statSync(path.join(root, l.slice(3).split(' -> ').pop())).mtimeMs); } catch {} }
  return crypto.createHash('sha1').update(`${head}|${status}|${mt}|${files.length}`).digest('hex');
}

function parseImports(file, src) {
  const out = [];
  if (/\.py$/.test(file)) {
    for (const m of src.matchAll(/^\s*from\s+(\.*[\w.]*)\s+import\s+([\w*, ()]+)/gm)) out.push({ py: m[1], names: m[2].replace(/[()]/g, '').split(',').map((x) => x.trim().split(/\s+/)[0]).filter(Boolean) });
    for (const m of src.matchAll(/^\s*import\s+([\w., ]+)/gm)) for (const x of m[1].split(',')) out.push({ py: x.trim().split(/\s+/)[0] });
  } else if (/\.html?$/.test(file)) {
    for (const m of src.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\shref)=["']([^"'#?]+)["']/gi)) if (!/^(https?:)?\/\//.test(m[1])) out.push({ js: m[1].startsWith('/') ? m[1] : './' + m[1], html: true });
  } else if (/\.s?css$/.test(file)) {
    for (const m of src.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)) out.push({ js: m[1] });
  } else {
    for (const m of src.matchAll(/(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push({ js: m[1] || m[2] || m[3] || m[4] });
  }
  return out;
}

export async function buildMap(root) {
  root = path.resolve(root);
  const files = await listFiles(root);
  const set = new Set(files);
  const sig = await signature(root, files);
  const nodes = {}, edges = new Map(), external = {};
  const resolveJs = (from, spec) => {
    if (!spec.startsWith('.') && !spec.startsWith('/')) return null;
    // Rutas absolutas de una web (/app.js): se buscan desde la carpeta del HTML y desde public/ o static/
    if (spec.startsWith('/')) {
      const rel = spec.slice(1);
      return [path.posix.join(path.posix.dirname(from), rel), rel, `public/${rel}`, `static/${rel}`].find((t) => set.has(t)) || null;
    }
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec.split('?')[0]));
    const tries = [base, ...['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.css', '.scss'].map((e) => base + e),
      ...['index.js', 'index.ts', 'index.tsx', 'index.mjs'].map((e) => `${base}/${e}`), base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx')];
    return tries.find((t) => set.has(t)) || null;
  };
  const resolvePy = (from, mod, name) => {
    let parts;
    if (mod.startsWith('.')) {
      const dots = mod.match(/^\.+/)[0].length;
      let dir = path.posix.dirname(from);
      for (let i = 1; i < dots; i++) dir = path.posix.dirname(dir);
      parts = [dir === '.' ? '' : dir, ...mod.slice(dots).split('.').filter(Boolean)];
    } else parts = mod.split('.');
    const base = parts.filter(Boolean).join('/');
    const cands = [name && `${base}/${name}.py`, `${base}.py`, `${base}/__init__.py`];
    // También dentro de src/ (estructura habitual)
    for (const c of [...cands]) if (c) cands.push(`src/${c}`);
    return cands.find((c) => c && set.has(c)) || null;
  };
  for (const f of files) {
    let src = '';
    try { const st = fs.statSync(path.join(root, f)); if (st.size > MAX_BYTES) { nodes[f] = { lines: null, big: true }; continue; } src = fs.readFileSync(path.join(root, f), 'utf8'); } catch { continue; }
    nodes[f] = { lines: src.split('\n').length };
    for (const imp of parseImports(f, src)) {
      let to = null;
      if (imp.js) { to = resolveJs(f, imp.js); if (!to && !imp.js.startsWith('.')) { const pkg = imp.js.startsWith('@') ? imp.js.split('/').slice(0, 2).join('/') : imp.js.split('/')[0]; if (pkg && PKG.test(pkg) && !imp.html) (external[pkg] ||= new Set()).add(f); } }
      else if (imp.py) { to = (imp.names || [null]).map((n) => resolvePy(f, imp.py, n)).find(Boolean) || null; if (!to && !imp.py.startsWith('.') && PKG.test(imp.py.split('.')[0])) (external[imp.py.split('.')[0]] ||= new Set()).add(f); }
      if (to && to !== f) { const k = `${f}\n${to}`; edges.set(k, (edges.get(k) || 0) + 1); }
    }
  }
  // Módulos: carpetas (hasta 2 niveles); los archivos sueltos de la raíz forman el módulo "(raíz)"
  const modOf = (f) => { const p = f.split('/'); return p.length === 1 ? '(raíz)' : p.slice(0, Math.min(2, p.length - 1)).join('/'); };
  const modules = {};
  for (const [f, n] of Object.entries(nodes)) { const m = (modules[modOf(f)] ||= { id: modOf(f), files: [], lines: 0 }); m.files.push(f); m.lines += n.lines || 0; }
  const medges = new Map();
  for (const [k, w] of edges) { const [a, b] = k.split('\n'); const ma = modOf(a), mb = modOf(b); if (ma === mb) continue; const kk = `${ma}\n${mb}`; medges.set(kk, (medges.get(kk) || 0) + w); }
  return {
    root, sig, at: Date.now(), truncated: files.length >= MAX_FILES,
    files: Object.entries(nodes).map(([id, n]) => ({ id, module: modOf(id), lines: n.lines, big: !!n.big })),
    fileEdges: [...edges].map(([k, w]) => { const [from, to] = k.split('\n'); return { from, to, w }; }),
    modules: Object.values(modules).map((m) => ({ ...m, files: m.files.sort() })),
    edges: [...medges].map(([k, w]) => { const [from, to] = k.split('\n'); return { from, to, w }; }),
    external: Object.entries(external).map(([name, s]) => ({ name, uses: s.size })).sort((a, b) => b.uses - a.uses).slice(0, 60),
  };
}

export class ProjectMaps {
  // hooks: { createJob(opts) -> job, emit() }
  constructor(confDir, hooks) {
    this.dir = path.join(confDir, 'maps');
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    this.hooks = hooks;
    this.cache = new Map();
  }
  fileFor(root) { return path.join(this.dir, crypto.createHash('sha1').update(root).digest('hex').slice(0, 16) + '.json'); }
  meta(root) { try { return JSON.parse(fs.readFileSync(this.fileFor(root), 'utf8')); } catch { return { root, descriptions: {}, describedAt: null }; } }
  saveMeta(root, m) { fs.writeFileSync(this.fileFor(root), JSON.stringify(m), { mode: 0o600 }); }
  async get(dir) {
    const root0 = path.resolve(String(dir || '').replace(/^~(?=$|\/)/, os.homedir()));
    if (!fs.existsSync(root0) || !fs.statSync(root0).isDirectory()) throw new Error(`La carpeta no existe: ${root0}`);
    const top = (await run(root0, 'git', ['rev-parse', '--show-toplevel']))?.trim();
    const root = top || root0;
    const files = await listFiles(root);
    const sig = await signature(root, files);
    let map = this.cache.get(root);
    const changed = !map || map.sig !== sig;
    if (changed) { map = await buildMap(root); this.cache.set(root, map); }
    const meta = this.meta(root);
    return { ...map, changed, descriptions: meta.descriptions || {}, describedAt: meta.describedAt, describeJob: meta.job || null };
  }
  // Un agente describe cada módulo (solo lectura). La respuesta debe ser JSON { "módulo": "descripción" }.
  async describe(dir, { agent = 'claude', model = null } = {}) {
    const map = await this.get(dir);
    if (!map.modules.length) throw new Error('No se encontró código que describir');
    const list = map.modules.slice(0, 80).map((m) => `- ${m.id}: ${m.files.slice(0, 12).join(', ')}${m.files.length > 12 ? ` (+${m.files.length - 12})` : ''}`).join('\n');
    const j = this.hooks.createJob({ agent, model, cwd: map.root, kind: 'map', permission: 'read', isolation: 'none', from: 'Mapa del proyecto', meta: { map: map.root },
      task: `Describe en UNA frase corta (máx. 20 palabras, en español) para qué sirve cada uno de estos módulos del proyecto ${map.root}. Mira el código si hace falta; no modifiques nada.

${list}

Responde SOLO con un objeto JSON válido, sin texto alrededor, con esta forma: {"nombre del módulo": "descripción", ...}` });
    const meta = this.meta(map.root); meta.job = j.id; this.saveMeta(map.root, meta);
    return j;
  }
  jobFinished(j) {
    const root = j.meta?.map;
    if (!root) return;
    const meta = this.meta(root);
    meta.job = null;
    if (j.status === 'done') {
      const m = /\{[\s\S]*\}/.exec(j.result || '');
      try {
        const obj = JSON.parse(m[0]);
        for (const [k, v] of Object.entries(obj)) if (typeof v === 'string') meta.descriptions[k] = v.slice(0, 300);
        meta.describedAt = Date.now(); meta.error = null;
      } catch { meta.error = 'El agente no devolvió un JSON válido con las descripciones.'; }
    } else meta.error = `El encargo de descripción acabó: ${j.status}`;
    this.saveMeta(root, meta);
    this.hooks.emit?.();
  }
}
