// GitHub con la CLI `gh` (usa tu sesión de gh; MCP Hub no guarda ningún token):
// - listar issues del repositorio de una carpeta y convertirlos en encargos o tarjetas del tablero;
// - crear un pull request con los cambios de un encargo aislado, adjuntando su revisión independiente.
// Subir una rama y abrir un PR es una acción hacia fuera: solo se hace cuando la pides desde la interfaz.
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { execFile } from 'node:child_process';

const run = (cwd, cmd, args, input) => new Promise((resolve, reject) => {
  const p = execFile(cmd, args, { cwd, maxBuffer: 32 * 1024 * 1024, timeout: 60000, env: { ...process.env, GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0' } },
    (e, out, err) => (e ? reject(new Error(String(err || e.message).trim().slice(0, 600))) : resolve(String(out))));
  if (input != null) { p.stdin.write(input); p.stdin.end(); }
});
const dirOf = (d) => {
  const dir = path.resolve(String(d || '').replace(/^~(?=$|\/)/, os.homedir()));
  if (!fs.existsSync(dir)) throw new Error(`La carpeta no existe: ${dir}`);
  return dir;
};

export async function status() {
  try { const out = await run(os.homedir(), 'gh', ['auth', 'status']); return { ok: true, text: out.split('\n').find((l) => /Logged in/.test(l))?.trim() || 'Sesión iniciada' }; }
  catch (e) { return { ok: false, text: /not found|ENOENT/.test(e.message) ? 'No está instalada la CLI de GitHub (gh).' : 'gh no tiene la sesión iniciada: ejecuta `gh auth login` en una terminal.' }; }
}
export async function repoInfo(cwd) {
  const dir = dirOf(cwd);
  try { return JSON.parse(await run(dir, 'gh', ['repo', 'view', '--json', 'nameWithOwner,url,defaultBranchRef'])); }
  catch { throw new Error('Esta carpeta no es un repositorio de GitHub (o gh no tiene acceso a él)'); }
}
export async function issues(cwd, { state = 'open', search = '' } = {}) {
  const dir = dirOf(cwd);
  const args = ['issue', 'list', '--json', 'number,title,body,labels,url,author,createdAt,assignees,comments', '--limit', '50', '--state', ['open', 'closed', 'all'].includes(state) ? state : 'open'];
  if (search) args.push('--search', String(search).slice(0, 200));
  const list = JSON.parse(await run(dir, 'gh', args));
  return list.map((i) => ({ number: i.number, title: i.title, body: String(i.body || '').slice(0, 20000), url: i.url, author: i.author?.login, createdAt: i.createdAt,
    labels: (i.labels || []).map((l) => l.name), comments: (i.comments || []).length }));
}
export async function issue(cwd, number) {
  const dir = dirOf(cwd);
  const i = JSON.parse(await run(dir, 'gh', ['issue', 'view', String(Number(number)), '--json', 'number,title,body,labels,url,comments']));
  const comments = (i.comments || []).slice(-10).map((c) => `— ${c.author?.login}: ${String(c.body).slice(0, 2000)}`).join('\n');
  return { number: i.number, title: i.title, url: i.url, labels: (i.labels || []).map((l) => l.name),
    text: `Issue #${i.number}: ${i.title}\n${i.url}\n\n${String(i.body || '(sin descripción)').slice(0, 20000)}${comments ? `\n\nComentarios recientes:\n${comments}` : ''}` };
}
// Crea un PR a partir de la rama de un encargo (ya conservada con "keep"). Devuelve la URL.
export async function createPr({ root, branch, title, body, base, draft = true }) {
  const info = await repoInfo(root);
  const baseBranch = base || info.defaultBranchRef?.name || 'main';
  await run(root, 'git', ['push', '-u', 'origin', `${branch}:${branch}`]);
  const out = await run(root, 'gh', ['pr', 'create', '--head', branch, '--base', baseBranch, '--title', String(title).slice(0, 240), '--body-file', '-', ...(draft ? ['--draft'] : [])], body);
  return { url: out.trim().split('\n').pop(), base: baseBranch, repo: info.nameWithOwner };
}
