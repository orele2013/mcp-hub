// Tablero kanban: tareas en columnas. Al pasar una tarjeta a "En curso" se crea su encargo; cuando termina, pasa sola a "Revisar".
// "Hecho" lo decides tú. Las tarjetas pueden venir de issues de GitHub. Se guarda en ~/.config/mcp-hub/board.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const COLUMNS = { ideas: 'Ideas', doing: 'En curso', review: 'Revisar', done: 'Hecho' };
const ACTIVE = ['waiting', 'queued', 'paused', 'awaiting_approval', 'starting', 'running'];

export class Board {
  // hooks: { createJob(opts) -> job, cancelJob(id), getJob(id), emit() }
  constructor(confDir, hooks) {
    this.file = path.join(confDir, 'board.json');
    this.hooks = hooks;
    try { this.cards = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { this.cards = []; }
  }
  save() { fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.cards), { mode: 0o600 }); fs.renameSync(this.file + '.tmp', this.file); this.hooks.emit?.(); }
  get(id) { const c = this.cards.find((x) => x.id === id); if (!c) throw new Error('No existe esa tarjeta'); return c; }
  view() {
    return this.cards.map((c) => {
      const j = c.job ? this.hooks.getJob(c.job) : null;
      return { ...c, jobStatus: j?.status || null, jobReview: j?.review?.status || null, jobFiles: j?.review?.files || 0, verdict: j?.verdict || null };
    });
  }
  save1(o) {
    const title = String(o.title || '').trim();
    if (!title) throw new Error('Ponle un título a la tarjeta');
    const prev = o.id ? this.get(o.id) : null;
    const cwd = path.resolve(String(o.cwd || prev?.cwd || os.homedir()).replace(/^~(?=$|\/)/, os.homedir()));
    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error(`La carpeta no existe: ${cwd}`);
    const c = {
      id: prev?.id || crypto.randomBytes(3).toString('hex'), title: title.slice(0, 160), desc: String(o.desc ?? prev?.desc ?? '').slice(0, 20000), cwd,
      agent: o.agent || prev?.agent || 'claude', model: o.model ?? prev?.model ?? null, role: o.role ?? prev?.role ?? null,
      permission: o.permission || prev?.permission || null, isolation: o.isolation || prev?.isolation || null, reviewWith: o.reviewWith ?? prev?.reviewWith ?? null,
      column: prev?.column || (COLUMNS[o.column] ? o.column : 'ideas'), job: prev?.job || null, jobs: prev?.jobs || [], source: prev?.source || o.source || null,
      labels: Array.isArray(o.labels) ? o.labels.map((l) => String(l).slice(0, 30)).slice(0, 8) : prev?.labels || [],
      created: prev?.created || Date.now(), updated: Date.now(), order: prev?.order ?? Date.now(),
    };
    if (prev) Object.assign(prev, c); else this.cards.push(c);
    this.save();
    return c;
  }
  remove(id) {
    const c = this.get(id);
    const j = c.job && this.hooks.getJob(c.job);
    if (j && ACTIVE.includes(j.status)) throw new Error('Su encargo sigue en marcha: cancélalo o espera a que termine');
    this.cards = this.cards.filter((x) => x !== c); this.save();
  }
  // Mover a "En curso" lanza el encargo; sacar de "En curso" una tarjeta con encargo activo exige cancelarlo
  move(id, column, { cancel = false, order } = {}) {
    const c = this.get(id);
    if (!COLUMNS[column]) throw new Error('Columna no válida');
    const j = c.job ? this.hooks.getJob(c.job) : null;
    const active = j && ACTIVE.includes(j.status);
    if (c.column === 'doing' && column !== 'doing' && active) {
      if (!cancel) throw new Error('Su encargo está en marcha. ¿Quieres cancelarlo?');
      this.hooks.cancelJob(j.id);
    }
    if (column === 'doing' && !active) {
      const task = `${c.title}${c.desc ? `\n\n${c.desc}` : ''}${c.source?.url ? `\n\nOrigen: ${c.source.url}` : ''}`;
      const job = this.hooks.createJob({ agent: c.agent, model: c.model, role: c.role || undefined, cwd: c.cwd, task, permission: c.permission || undefined,
        isolation: c.isolation || undefined, reviewWith: c.reviewWith || undefined, kind: 'board', from: `Tablero · ${c.title}`.slice(0, 80), meta: { card: c.id } });
      c.job = job.id; c.jobs = [...c.jobs, job.id].slice(-20);
    }
    c.column = column;
    if (order != null) c.order = Number(order);
    c.updated = Date.now();
    this.save();
    return c;
  }
  jobFinished(j) {
    const c = this.cards.find((x) => x.id === j.meta?.card && x.job === j.id);
    if (!c || c.column !== 'doing') return;
    c.column = 'review'; c.updated = Date.now();
    this.save(); // el aviso ya lo da el propio encargo (si fue largo o tiene cambios por revisar)
  }
}
