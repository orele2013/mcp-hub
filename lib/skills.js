// Skills (formato SKILL.md) desde skills.sh: buscar, revisar, instalar y quitar.
// Buscar y revisar usan la API pública de skills.sh; instalar y quitar usan su CLI (`npx skills`).
import { execFile } from 'node:child_process';

const BASE = 'https://skills.sh';
// ids de agente del CLI de skills
export const SKILL_AGENTS = { claude: 'claude-code', codex: 'codex', opencode: 'opencode', gemini: 'gemini-cli', cursor: 'cursor' };
const AGENT_NAMES = { 'Claude Code': 'claude', Codex: 'codex', OpenCode: 'opencode', 'Gemini CLI': 'gemini', Cursor: 'cursor' };

const clean = (s) => ({ id: s.id, source: s.source, slug: s.skillId || s.slug, name: s.name, installs: s.installs || 0 });

export async function searchSkills(q, limit = 60) {
  const r = await fetch(`${BASE}/api/search?q=${encodeURIComponent(q)}&limit=${limit}`, { signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `skills.sh respondió ${r.status}`);
  return (j.skills || []).map(clean);
}

// skills.sh no tiene un listado público sin búsqueda: se mezclan varias búsquedas amplias.
let popularCache = null;
const POPULAR_QUERIES = ['react', 'python', 'testing', 'design', 'docs', 'git', 'security', 'pdf', 'api', 'data', 'frontend', 'writing'];
export async function popularSkills() {
  if (popularCache && Date.now() - popularCache.at < 3600_000) return popularCache.items;
  const results = await Promise.allSettled(POPULAR_QUERIES.map((q) => searchSkills(q, 40)));
  const map = new Map();
  for (const r of results) if (r.status === 'fulfilled') for (const s of r.value) map.set(s.id, s);
  if (!map.size) throw new Error('No se pudo contactar con skills.sh');
  const items = [...map.values()].sort((a, b) => b.installs - a.installs).slice(0, 60);
  popularCache = { at: Date.now(), items };
  return items;
}

// Contenido de la skill para revisarla antes de instalar
export async function skillDetail(source, slug) {
  const [owner, repo] = source.split('/');
  const r = await fetch(`${BASE}/api/download/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(slug)}`, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`No se pudo descargar la skill (${r.status})`);
  const j = await r.json();
  const files = (j.files || []).map((f) => ({ path: f.path, size: (f.contents || '').length }));
  const skillMd = (j.files || []).find((f) => /(^|\/)SKILL\.md$/i.test(f.path))?.contents || '';
  const fm = /^---\n([\s\S]*?)\n---/.exec(skillMd)?.[1] || '';
  const description = /^description:\s*(.+)$/m.exec(fm)?.[1]?.replace(/^["']|["']$/g, '') || '';
  const scripts = files.filter((f) => /\.(sh|bash|py|js|mjs|cjs|ts|rb|pl|ps1|exe|bin)$/i.test(f.path)).map((f) => f.path);
  return { source, slug, description, skillMd, files, scripts };
}

// Quita códigos de terminal, spinners, el banner ASCII y los adornos de @clack del texto del CLI
function cleanOutput(text) {
  return text
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    .split('\n')
    .map((l) => l.split('\r').pop())
    .map((l) => l.replace(/^.*\[1G/, ''))
    .map((l) => l.replace(/^[\s│┌└├◇◆●■▲◒◐◓◑╭╮╰╯─]+/u, '').trimEnd())
    .filter((l) => l && !/[█╗╔╚╝═║]/.test(l) && !/Cloning repository|Tip: use the/.test(l))
    .join('\n');
}

// Traduce los fallos conocidos del CLI a un mensaje claro
function friendlyError(out) {
  const missing = /No matching skills found for:\s*(.+)/.exec(out);
  if (missing) {
    const available = [...out.matchAll(/^\s*-\s+(\S+)/gm)].map((m) => m[1]);
    return `El repositorio ya no contiene la skill "${missing[1].trim()}" (skills.sh tiene el índice desactualizado).`
      + (available.length ? ` Skills disponibles en ese repositorio: ${available.join(', ')}.` : '');
  }
  return '';
}

function runSkills(args, timeout = 240000) {
  return new Promise((resolve, reject) => {
    execFile('npx', ['-y', 'skills', ...args], { timeout, maxBuffer: 20 * 1024 * 1024, env: { ...process.env, CI: '1', NO_COLOR: '1' } },
      (err, stdout, stderr) => {
        const out = cleanOutput((stdout || '') + (stderr || ''));
        if (err) reject(new Error(friendlyError(out) || out.slice(-1500) || err.message));
        else resolve(stdout);
      });
  });
}

export async function installedSkills() {
  const out = await runSkills(['ls', '-g', '--json'], 90000);
  const list = JSON.parse(out.slice(out.indexOf('[')));
  return list.map((s) => {
    const agents = new Set((s.agents || []).map((a) => AGENT_NAMES[a]).filter(Boolean));
    // ~/.agents/skills es la carpeta "universal" que leen Codex y OpenCode
    if (String(s.path).includes('/.agents/skills/')) { agents.add('codex'); agents.add('opencode'); }
    return { name: s.name, path: s.path, source: s.source, sourceUrl: s.sourceUrl, agents: [...agents],
      otherAgents: (s.agents || []).filter((a) => !AGENT_NAMES[a]) };
  });
}

export async function installSkill(source, slug, clients) {
  const agents = clients.map((c) => SKILL_AGENTS[c]).filter(Boolean);
  if (!agents.length) throw new Error('Elige al menos un agente');
  if (!/^[\w.-]+\/[\w.-]+$/.test(source) || !/^[\w.:-]+$/.test(slug)) throw new Error('Skill no válida');
  return runSkills(['add', source, '--skill', slug, '--agent', ...agents, '--global', '--yes']);
}

export async function removeSkill(name) {
  if (!/^[\w.:-]+$/.test(name)) throw new Error('Nombre no válido');
  return runSkills(['remove', name, '--global', '--yes']);
}
