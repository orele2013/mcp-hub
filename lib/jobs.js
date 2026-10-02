// Encargos entre agentes: cola con prioridades, perfiles de permisos, entornos aislados (git worktree),
// bandeja de aprobaciones, límites de tiempo/turnos/gasto, reanudación y revisión de cambios.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';

export const PERMISSIONS = {
  read: { label: 'Solo lectura', desc: 'Lee y responde; no edita ni ejecuta comandos.' },
  edit: { label: 'Editar archivos', desc: 'Puede editar archivos de la carpeta; sin comandos de terminal.' },
  ask: { label: 'Aprobar cada acción', desc: 'Edita, y te pide permiso para cada comando u acción delicada (solo Claude Code; en otros agentes equivale a "Editar archivos" con aprobación antes de empezar).' },
  full: { label: 'Sin límites', desc: 'Edita y ejecuta lo que quiera sin preguntar.' },
};
export const ISOLATION = { none: 'En la carpeta original', worktree: 'Entorno aislado (git worktree)' };
const ACTIVE = ['waiting', 'queued', 'paused', 'awaiting_approval', 'running'];
const FINISHED = ['done', 'error', 'cancelled', 'timeout', 'interrupted', 'rejected', 'skipped'];
// Qué hacer si falla una dependencia: omitir el encargo, lanzarlo igualmente o lanzarlo si al menos una salió bien
export const ON_DEP_FAIL = { skip: 'Omitirlo', run: 'Lanzarlo igualmente', any: 'Lanzarlo si al menos una terminó bien' };
// Orden de preferencia para elegir un revisor distinto del autor
const REVIEW_ORDER = ['claude', 'codex', 'gemini', 'opencode', 'cursor'];
// Tipos de encargo: los de chat, debate y sombra se ven en su propia pantalla, no en la lista de encargos
export const KINDS = ['task', 'review', 'synthesis', 'chat', 'debate', 'shadow', 'board', 'replay', 'map', 'monitor', 'issue'];
export const QUIET_KINDS = ['chat', 'debate', 'shadow'];
const VERDICTS = { APROBADO: 'approved', 'CAMBIOS NECESARIOS': 'changes', RECHAZADO: 'rejected' };
const WT_ROOT = path.join(os.homedir(), '.local', 'share', 'mcp-hub', 'worktrees');

const git = (cwd, args, input) => new Promise((resolve, reject) => {
  const p = execFile('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 }, (e, out, err) => (e ? reject(new Error(String(err || e.message).trim())) : resolve(String(out))));
  if (input != null) { p.stdin.write(input); p.stdin.end(); }
});
const short = (v, n = 300) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s.length > n ? s.slice(0, n) + '…' : s; };

export class JobManager {
  // hooks: { start(job) -> sessionId, kill(sessionId), emit(), notify(text), agentName(id), installed(id), runDir, approvalsScript, port }
  constructor(confDir, hooks) {
    this.file = path.join(confDir, 'delegations.json');
    this.settingsFile = path.join(confDir, 'delegation-settings.json');
    // Estado de cada encargo en marcha (id de sesión del agente, uso): fuera de run/, que se vacía al arrancar
    this.stateDir = path.join(confDir, 'job-state');
    fs.mkdirSync(this.stateDir, { recursive: true, mode: 0o700 });
    this.hooks = hooks;
    let data = [];
    try { data = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch {}
    // Compatibilidad: antes era una lista de encargos; ahora { jobs, approvals }
    this.jobs = Array.isArray(data) ? data : data.jobs || [];
    this.approvals = Array.isArray(data) ? [] : data.approvals || [];
    this.settings = { permission: 'full', isolation: 'none', approveFull: false, timeoutMin: 60, maxRunning: 4, maxDepth: 3,
      ...(() => { try { return JSON.parse(fs.readFileSync(this.settingsFile, 'utf8')); } catch { return {}; } })() };
    for (const j of this.jobs) {
      j.permission ||= 'full'; j.isolation ||= 'none'; j.priority ??= 0; j.attempts ||= 1;
      if (j.status === 'running' || j.status === 'starting') {
        try { const st = JSON.parse(fs.readFileSync(this.statePath(j.id), 'utf8')); j.sid = st.sid || j.sid; if (st.usage) j.usage = mergeUsage(j.usage, st.usage); } catch {}
        j.status = 'interrupted'; j.result = 'MCP Hub se reinició mientras el encargo estaba en marcha. Puedes reanudarlo.'; j.endedAt = Date.now();
        if (j.startedAt) j.duration = (j.duration || 0) + (j.endedAt - j.startedAt);
      }
    }
    for (const a of this.approvals) if (a.status === 'pending') a.status = 'expired';
    // Un encargo que esperaba aprobación pierde su aprobación al reiniciar: se vuelve a pedir
    for (const j of this.jobs) if (j.status === 'awaiting_approval' && !this.approvals.some((a) => a.job === j.id && a.status === 'pending')) j.needsApproval = true;
    this.waiters = new Map(); this.approvalWaiters = new Map(); this.timers = new Map();
    this.save();
    setTimeout(() => {
      for (const j of this.jobs.filter((x) => x.needsApproval)) { delete j.needsApproval; this.requestApproval({ job: j.id, kind: 'start', tool: 'Empezar encargo', input: { agente: this.hooks.agentName(j.agent), carpeta: j.cwd, tarea: short(j.task, 600), nota: 'MCP Hub se reinició; se vuelve a pedir' } }); }
      this.release(); this.pump();
    }, 500);
  }
  save() {
    this.jobs = this.jobs.slice(-200);
    this.approvals = this.approvals.filter((a) => a.status === 'pending' || Date.now() - a.at < 7 * 86400_000).slice(-200);
    fs.writeFileSync(this.file + '.tmp', JSON.stringify({ jobs: this.jobs, approvals: this.approvals }), { mode: 0o600 });
    fs.renameSync(this.file + '.tmp', this.file);
    this.hooks.emit?.();
  }
  saveSettings(patch) {
    const s = this.settings;
    if (patch.permission !== undefined) { if (!PERMISSIONS[patch.permission]) throw new Error('Permiso no válido'); s.permission = patch.permission; }
    if (patch.isolation !== undefined) { if (!ISOLATION[patch.isolation]) throw new Error('Aislamiento no válido'); s.isolation = patch.isolation; }
    if (patch.approveFull !== undefined) s.approveFull = !!patch.approveFull;
    if (patch.timeoutMin !== undefined) s.timeoutMin = Math.max(0, Math.min(Number(patch.timeoutMin) || 0, 24 * 60));
    if (patch.maxRunning !== undefined) s.maxRunning = Math.max(1, Math.min(Number(patch.maxRunning) || 1, 12));
    fs.writeFileSync(this.settingsFile, JSON.stringify(s, null, 2), { mode: 0o600 });
    this.pump(); this.hooks.emit?.();
    return s;
  }
  statePath(id) { return path.join(this.stateDir, `${id}.json`); }
  get(id) { const j = this.jobs.find((x) => x.id === id); if (!j) throw new Error(`No existe el encargo ${id}`); return j; }
  view(j) {
    const { resultFile, file, steps, ...rest } = j;
    return { ...rest, stepCount: steps?.length || 0, agentName: this.hooks.agentName(j.agent), queuePos: j.status === 'queued' ? this.queue().findIndex((x) => x.id === j.id) + 1 : null };
  }
  queue() { return this.jobs.filter((j) => j.status === 'queued').sort((a, b) => b.priority - a.priority || a.at - b.at); }
  running() { return this.jobs.filter((j) => j.status === 'running' || j.status === 'starting'); }

  // ---- Crear ----
  create(o) {
    if (!this.hooks.installed(o.agent)) throw new Error(`${this.hooks.agentName(o.agent)} no está instalado o no existe. Usa list_agents.`);
    const task = String(o.task || '').trim();
    if (!task) throw new Error('La tarea está vacía');
    const cwd = path.resolve(String(o.cwd || os.homedir()).replace(/^~(?=$|\/)/, os.homedir()));
    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error(`La carpeta no existe: ${cwd}`);
    const parent = o.fromSession && this.jobs.find((j) => j.sessionId === o.fromSession);
    const depth = Math.max(Number(o.depth) || 0, parent ? parent.depth + 1 : 0);
    if (depth >= this.settings.maxDepth) throw new Error(`Límite de encargos en cadena alcanzado (${this.settings.maxDepth}). Hazlo tú mismo.`);
    const permission = o.permission || this.settings.permission;
    if (!PERMISSIONS[permission]) throw new Error(`Permiso no válido: ${permission}. Usa ${Object.keys(PERMISSIONS).join(', ')}`);
    const isolation = o.isolation || this.settings.isolation;
    if (!ISOLATION[isolation]) throw new Error(`Aislamiento no válido: ${isolation}`);
    const num = (v, max) => (v == null || v === '' ? null : Math.max(0, Math.min(Number(v) || 0, max)) || null);
    const after = [...new Set((Array.isArray(o.after) ? o.after : o.after ? String(o.after).split(/[\s,]+/) : []).map(String).filter(Boolean))];
    for (const d of after) if (!this.jobs.some((x) => x.id === d)) throw new Error(`No existe el encargo ${d} del que depende`);
    if (after.length > 20) throw new Error('Demasiadas dependencias (máx. 20)');
    const onDepFail = o.onDepFail || 'skip';
    if (!ON_DEP_FAIL[onDepFail]) throw new Error(`Valor no válido para onDepFail: ${onDepFail}`);
    const job = {
      id: crypto.randomBytes(3).toString('hex'), agent: o.agent, task, cwd, model: o.model || null, from: String(o.from || 'Tú (MCP Hub)').slice(0, 80),
      depth, permission, isolation, role: o.roleName || null, priority: Math.max(-10, Math.min(Number(o.priority) || 0, 10)),
      limits: { minutes: num(o.timeoutMin ?? this.settings.timeoutMin, 24 * 60), maxTurns: num(o.maxTurns, 500), budgetUsd: num(o.budgetUsd, 1000) },
      status: 'queued', result: null, exitCode: null, at: Date.now(), attempts: 1, sid: null, usage: null, notes: [],
      after, onDepFail, useResults: after.length ? o.useResults !== false : false, kind: KINDS.includes(o.kind) ? o.kind : 'task', meta: o.meta && typeof o.meta === 'object' ? JSON.parse(JSON.stringify(o.meta)) : undefined,
      group: o.group || null, reviewOf: o.kind === 'review' ? o.reviewOf : null,
    };
    if (after.length) job.status = 'waiting';
    // Aprobación antes de empezar: siempre que lo pida el encargo, con "sin límites" si así está configurado, y con "ask" en agentes sin aprobaciones por acción
    if (o.requireApproval || (permission === 'full' && this.settings.approveFull) || (permission === 'ask' && job.agent !== 'claude')) {
      job.status = 'awaiting_approval'; job.gated = true;
      this.requestApproval({ job: job.id, kind: 'start', tool: 'Empezar encargo', input: { agente: this.hooks.agentName(job.agent), permisos: PERMISSIONS[permission].label, carpeta: cwd, tarea: short(task, 600) } });
    }
    this.jobs.push(job);
    this.save();
    this.release();
    this.pump();
    return job;
  }

  // ---- Varios agentes en paralelo (15) ----
  // Encarga la misma tarea a varios agentes; opcionalmente otro agente reúne y compara las respuestas cuando terminan
  createGroup(o) {
    const list = (Array.isArray(o.agents) ? o.agents : []).map((a) => (typeof a === 'string' ? (([agent, ...m]) => ({ agent, model: m.join(':') || null }))(a.split(':')) : a)).filter((a) => a?.agent);
    if (list.length < 2) throw new Error('Elige al menos dos agentes para un encargo en paralelo');
    if (list.length > 8) throw new Error('Máximo 8 agentes en paralelo');
    for (const a of list) if (!this.hooks.installed(a.agent)) throw new Error(`${this.hooks.agentName(a.agent)} no está instalado`);
    if (o.synthesize && !this.hooks.installed(o.synthesize)) throw new Error(`${this.hooks.agentName(o.synthesize)} no está instalado`);
    const group = 'g' + crypto.randomBytes(3).toString('hex');
    const { agents, synthesize, synthModel, ...base } = o;
    const jobs = list.map((a) => this.create({ ...base, agent: a.agent, model: a.model || null, group }));
    let synth = null;
    if (synthesize) {
      synth = this.create({ agent: synthesize, model: synthModel || null, cwd: base.cwd, from: base.from, depth: base.depth, fromSession: base.fromSession, group,
        kind: 'synthesis', after: jobs.map((j) => j.id), onDepFail: 'any', useResults: true, permission: 'read', isolation: 'none', priority: base.priority,
        task: `Varios agentes han hecho la misma tarea por separado. Reúne y compara sus respuestas (van al final):\n- en qué coinciden,\n- en qué difieren y quién tiene razón (compruébalo en el código o en fuentes si hace falta),\n- errores o riesgos que veas en cada una,\n- y una respuesta final unificada con lo mejor de todas.\nNo modifiques archivos.\n\nTarea original:\n${base.task}` });
    }
    return { group, jobs, synth };
  }
  groupJobs(group) { return this.jobs.filter((j) => j.group === group); }
  async waitAll(ids, seconds) {
    const end = Date.now() + Math.min(Math.max(seconds, 1), 55) * 1000;
    for (;;) {
      const pending = ids.map((id) => this.get(id)).filter((j) => ACTIVE.includes(j.status) || j.status === 'starting');
      const left = Math.round((end - Date.now()) / 1000);
      if (!pending.length || left < 1) break;
      await this.wait(pending[0].id, left);
    }
    return ids.map((id) => this.get(id));
  }

  // ---- Revisión independiente (16) ----
  // Otro agente analiza el resultado (y el diff si trabajó aislado) con permisos de solo lectura y da un veredicto
  requestReview(id, { agent = 'auto', model = null, from, fromSession, depth } = {}) {
    const j = this.get(id);
    if (j.kind === 'review') throw new Error('No se puede revisar una revisión');
    const live = j.reviewJob && this.jobs.find((x) => x.id === j.reviewJob);
    if (live && (ACTIVE.includes(live.status) || live.status === 'starting')) throw new Error(`Ya hay una revisión en marcha (encargo ${live.id})`);
    if (FINISHED.includes(j.status) && j.status !== 'done') throw new Error('Solo se revisan encargos que terminaron bien (o que aún no han terminado)');
    if (!agent || agent === 'auto') {
      agent = REVIEW_ORDER.find((a) => a !== j.agent && this.hooks.installed(a));
      if (!agent) throw new Error('No hay otro agente instalado para revisar');
    }
    const r = this.create({ agent, model, cwd: j.cwd, from: from || j.from, fromSession, depth: depth ?? j.depth, kind: 'review', reviewOf: j.id, after: [j.id], onDepFail: 'skip',
      useResults: false, permission: 'read', isolation: 'none', group: j.group, task: `Revisión independiente del encargo ${j.id} (${this.hooks.agentName(j.agent)}): ${j.task.replace(/\s+/g, ' ').slice(0, 200)}` });
    j.reviewJob = r.id; j.verdict = null;
    if (agent === j.agent) r.notes.push('Aviso: lo revisa el mismo agente que lo hizo');
    this.save();
    return r;
  }

  // ---- Dependencias (14) ----
  depState(j) {
    const deps = (j.after || []).map((d) => this.jobs.find((x) => x.id === d));
    // Un encargo interrumpido por un reinicio no ha fallado: los que dependen de él siguen esperando a que lo reanudes
    if (deps.some((d) => d && (ACTIVE.includes(d.status) || d.status === 'starting' || d.status === 'interrupted'))) return 'pending';
    const ok = deps.filter((d) => d?.status === 'done').length;
    if (ok === deps.length) return 'ready';
    if (j.onDepFail === 'run' || (j.onDepFail === 'any' && ok > 0)) return 'ready';
    return 'failed';
  }
  // Pasa a la cola los encargos cuyas dependencias terminaron, y omite los que dependían de algo que falló (en cadena)
  release() {
    let changed = true, any = false;
    while (changed) {
      changed = false;
      for (const j of this.jobs) {
        if (j.status !== 'waiting') continue;
        const st = this.depState(j);
        if (st === 'pending') continue;
        changed = any = true;
        if (st === 'ready') j.status = 'queued';
        else {
          const bad = j.after.map((d) => this.jobs.find((x) => x.id === d)).filter((d) => d?.status !== 'done');
          j.status = 'skipped'; j.endedAt = Date.now();
          j.result = `No se lanzó porque ${bad.map((d) => (d ? `el encargo ${d.id} acabó "${STATUS_LABEL[d.status] || d.status}"` : 'una dependencia ya no existe')).join(' y ')}.`;
          this.wake(j.id);
        }
      }
    }
    if (any) this.save();
  }
  // Texto que se añade a la tarea con las respuestas de las dependencias
  depContext(j) {
    const parts = [];
    for (const id of j.after || []) {
      const d = this.jobs.find((x) => x.id === id);
      if (!d) continue;
      const head = `### Encargo ${d.id} · ${this.hooks.agentName(d.agent)}${d.model ? ` (${d.model})` : ''} · ${STATUS_LABEL[d.status] || d.status}`;
      const rv = d.worktree && !d.worktree.removed && d.review?.files ? `\n(Trabajó en un entorno aislado: ${d.review.files} archivo(s) cambiado(s), aún sin aplicar a la carpeta original.)` : '';
      parts.push(`${head}${rv}\n${clip(d.result || '(sin respuesta)', 12_000)}`);
    }
    return parts.length ? `\n\n---\n\nRespuestas de los encargos previos de los que depende este:\n\n${parts.join('\n\n')}` : '';
  }
  async reviewPrompt(j) {
    const t = this.jobs.find((x) => x.id === j.reviewOf);
    if (!t) throw new Error('El encargo a revisar ya no existe');
    let changes = '';
    if (t.worktree && !t.worktree.removed && fs.existsSync(t.worktree.dir)) {
      const d = await this.diff(t.id).catch(() => null);
      changes = d?.patch?.trim() ? `\n\nCambios que hizo (diff respecto al estado inicial; aún NO están aplicados en la carpeta del usuario; estás trabajando dentro de su copia aislada):\n\`\`\`diff\n${clip(d.patch, 60_000)}\n\`\`\`` : '\n\nTrabajó en un entorno aislado y no cambió ningún archivo.';
    } else if (t.review?.status === 'applied') changes = '\n\nSus cambios ya se aplicaron a la carpeta: revisa el estado actual (por ejemplo con git diff o git log si es un repositorio).';
    else changes = '\n\nTrabajó directamente en la carpeta: revisa el estado actual de los archivos (por ejemplo con git status y git diff si es un repositorio).';
    return `Actúa como revisor independiente. Otro agente (${this.hooks.agentName(t.agent)}) hizo el encargo de abajo. NO modifiques archivos.
Comprueba si lo resolvió de verdad y busca fallos: errores de lógica, casos límite, seguridad, cosas que dice haber hecho y no hizo, pruebas que faltan y efectos secundarios.
Devuelve los hallazgos ordenados por gravedad (archivo:línea cuando aplique), y termina con una última línea exactamente así:
VEREDICTO: APROBADO | CAMBIOS NECESARIOS | RECHAZADO

Encargo original:
${clip(t.task, 12_000)}

Respuesta del agente:
${clip(t.result || '(sin respuesta)', 12_000)}${changes}`;
  }

  // ---- Cola ----
  // Retener la cola (por ejemplo, al salir de casa): los encargos en marcha siguen, los nuevos esperan
  hold(on, reason = null) { this.held = on ? { reason: reason || 'Cola en pausa', since: Date.now() } : null; this.hooks.emit?.(); if (!on) this.pump(); }
  pump() {
    if (this.held) return;
    while (this.running().length < this.settings.maxRunning) {
      const next = this.queue()[0];
      if (!next) break;
      next.status = 'starting';
      this.launch(next).catch((e) => { next.status = 'error'; next.result = e.message; next.endedAt = Date.now(); this.wake(next.id); this.save(); });
    }
  }
  async launch(j) {
    const resumeSid = j.resumeSid || null;
    j.resumeSid = null;
    const run = { cwd: j.cwd };
    let task = j.task;
    if (j.kind === 'review') {
      task = await this.reviewPrompt(j);
      const t = this.jobs.find((x) => x.id === j.reviewOf);
      if (t?.worktree && !t.worktree.removed && fs.existsSync(t.worktree.runCwd)) run.cwd = t.worktree.runCwd;
    } else if (j.useResults) task += this.depContext(j);
    if (j.isolation === 'worktree') {
      if (!j.worktree) j.worktree = await this.makeWorktree(j);
      run.cwd = j.worktree.runCwd;
    }
    j.runCwd = run.cwd !== j.cwd ? run.cwd : undefined;
    const runDir = this.hooks.runDir;
    j.file = path.join(runDir, `job-${j.id}.json`);
    j.resultFile = path.join(runDir, `job-${j.id}.result.json`);
    fs.rmSync(j.resultFile, { force: true });
    fs.writeFileSync(j.file, JSON.stringify({ id: j.id, agent: j.agent, task, cwd: run.cwd, model: j.model, resultFile: j.resultFile, from: j.from,
      stateFile: this.statePath(j.id), permission: j.permission, maxTurns: j.limits?.maxTurns, budgetUsd: j.limits?.budgetUsd, resumeSid,
      approvals: { script: this.hooks.approvalsScript, port: this.hooks.port } }), { mode: 0o600 });
    j.status = 'running'; j.startedAt = Date.now();
    j.sessionId = this.hooks.start(j);
    if (j.limits?.minutes) {
      this.timers.set(j.id, setTimeout(() => {
        if (j.status !== 'running') return;
        j.timedOut = true;
        this.hooks.kill(j.sessionId);
      }, j.limits.minutes * 60_000));
    }
    this.save();
  }
  // Llamado cuando termina la pestaña del encargo
  async finished(id, exitCode) {
    const j = this.jobs.find((x) => x.id === id);
    if (!j || !['running', 'starting', 'cancelled'].includes(j.status)) return;
    clearTimeout(this.timers.get(id)); this.timers.delete(id);
    let r = {}, st = {};
    try { r = JSON.parse(fs.readFileSync(j.resultFile, 'utf8')); } catch {}
    try { st = JSON.parse(fs.readFileSync(this.statePath(j.id), 'utf8')); } catch {}
    for (const f of [j.resultFile, this.statePath(j.id), path.join(this.hooks.runDir, `job-${j.id}.mcp.json`)]) fs.rmSync(f, { force: true });
    j.sid = r.sid || st.sid || j.sid;
    if (Array.isArray(r.steps) && r.steps.length) j.steps = [...(j.steps || []), ...r.steps].slice(-400);
    const usage = r.usage || st.usage;
    if (usage && Object.values(usage).some((v) => v != null)) j.usage = mergeUsage(j.usage, usage);
    j.endedAt = Date.now();
    j.duration = (j.duration || 0) + (j.endedAt - (j.startedAt || j.endedAt));
    if (j.status === 'cancelled') { j.result ||= 'Cancelado.'; }
    else if (j.timedOut) { j.status = 'timeout'; j.result = `Se alcanzó el límite de ${j.limits.minutes} min. ${r.result ? 'Último mensaje: ' + r.result : ''}`.trim(); j.timedOut = false; }
    else {
      j.exitCode = r.exitCode ?? exitCode;
      j.result = r.result ?? 'El encargo terminó sin respuesta (se cerró la pestaña o falló al arrancar).';
      j.status = j.exitCode === 0 ? 'done' : 'error';
    }
    if (j.worktree) {
      try { j.review = { status: 'pending', ...(await this.diffStat(j)) }; if (!j.review.files) j.review.status = 'empty'; }
      catch (e) { j.review = { status: 'error', error: e.message }; }
    }
    if (j.kind === 'review') {
      const t = this.jobs.find((x) => x.id === j.reviewOf);
      const m = [...String(j.result || '').matchAll(/VEREDICTO:\s*\**\s*(APROBADO|CAMBIOS NECESARIOS|RECHAZADO)/gi)].pop();
      j.verdict = j.status === 'done' && m ? VERDICTS[m[1].toUpperCase()] : null;
      if (t && t.reviewJob === j.id) t.verdict = j.verdict;
    }
    this.save();
    this.wake(id);
    this.release();
    this.pump();
    try { this.hooks.onFinished?.(j); } catch (e) { console.error('onFinished', e); }
    if (!QUIET_KINDS.includes(j.kind) && (j.duration > 120_000 || j.review?.status === 'pending')) {
      this.hooks.notify?.('jobs', `${j.status === 'done' ? '✅' : '⚠️'} Encargo ${j.id} (${this.hooks.agentName(j.agent)}): ${STATUS_LABEL[j.status]}${j.review?.status === 'pending' ? ` · ${j.review.files} archivo(s) cambiado(s) pendientes de revisión` : ''}.`);
    }
  }
  wake(id) { for (const w of this.waiters.get(id) || []) w(); this.waiters.delete(id); }
  wait(id, seconds) {
    const j = this.get(id);
    if (!ACTIVE.includes(j.status) && j.status !== 'starting') return Promise.resolve(j);
    return new Promise((resolve) => {
      const done = () => { clearTimeout(t); resolve(j); };
      const t = setTimeout(() => { this.waiters.set(id, (this.waiters.get(id) || []).filter((x) => x !== done)); resolve(j); }, Math.min(Math.max(seconds, 1), 55) * 1000);
      this.waiters.set(id, [...(this.waiters.get(id) || []), done]);
    });
  }

  // ---- Acciones ----
  cancel(id) {
    const j = this.get(id);
    if (!ACTIVE.includes(j.status)) return j;
    const wasRunning = j.status === 'running';
    j.status = 'cancelled'; j.result = 'Cancelado.'; j.endedAt = Date.now();
    for (const a of this.approvals) if (a.job === id && a.status === 'pending') this.decide(a.id, false, 'Encargo cancelado');
    if (wasRunning) this.hooks.kill(j.sessionId); else { this.wake(id); }
    this.save(); this.release(); this.pump();
    return j;
  }
  pause(id) { const j = this.get(id); if (j.status !== 'queued') throw new Error('Solo se pueden pausar encargos en cola'); j.status = 'paused'; this.save(); return j; }
  unpause(id) { const j = this.get(id); if (j.status !== 'paused') throw new Error('El encargo no está pausado'); j.status = 'queued'; this.save(); this.pump(); return j; }
  setPriority(id, priority) { const j = this.get(id); j.priority = Math.max(-10, Math.min(Number(priority) || 0, 10)); this.save(); this.pump(); return j; }
  // Reanuda un encargo interrumpido, fallido o que agotó el tiempo; si el agente informó de su sesión, continúa esa conversación
  resume(id, { fresh = false } = {}) {
    const j = this.get(id);
    if (!['interrupted', 'error', 'timeout', 'cancelled', 'skipped'].includes(j.status)) throw new Error('Solo se pueden reanudar encargos interrumpidos, fallidos, cancelados, omitidos o sin tiempo');
    if (j.status === 'skipped' && this.depState(j) === 'failed') throw new Error('Sus dependencias siguen sin terminar bien: reanuda primero esas');
    if (j.review?.status && j.review.status !== 'pending' && j.review.status !== 'empty' && j.worktree) throw new Error('Los cambios de este encargo ya se revisaron; crea uno nuevo');
    j.attempts = (j.attempts || 1) + 1;
    j.status = j.after?.length ? 'waiting' : 'queued'; j.result = null; j.exitCode = null; j.review = null; j.at = Date.now();
    j.resumeSid = fresh ? null : j.sid;
    j.notes = [...(j.notes || []), `Intento ${j.attempts}${j.resumeSid ? ' (continúa la sesión anterior)' : ''}`];
    this.save();
    this.release();
    this.pump();
    return j;
  }

  // ---- Aprobaciones ----
  requestApproval({ job, kind = 'action', tool, input }) {
    const a = { id: crypto.randomBytes(3).toString('hex'), job, kind, tool: String(tool).slice(0, 80), input: short(input, 2000), at: Date.now(), status: 'pending' };
    this.approvals.push(a);
    this.save();
    const j = this.jobs.find((x) => x.id === job);
    this.hooks.notify?.('approvals', `🔔 Aprobación ${a.id} · encargo ${job}${j ? ` (${this.hooks.agentName(j.agent)})` : ''}: ${a.tool}\n${short(input, 400)}\n\nResponde /aprobar ${a.id} o /denegar ${a.id}, o decide en MCP Hub → Agentes.`);
    return a;
  }
  decide(id, allow, note = '') {
    const a = this.approvals.find((x) => x.id === id);
    if (!a) throw new Error(`No existe la aprobación ${id}`);
    if (a.status !== 'pending') return a;
    a.status = allow ? 'allowed' : 'denied'; a.note = String(note || '').slice(0, 300); a.decidedAt = Date.now();
    if (a.kind === 'start') {
      const j = this.jobs.find((x) => x.id === a.job);
      if (j && j.status === 'awaiting_approval') {
        if (allow) j.status = j.after?.length ? 'waiting' : 'queued';
        else { j.status = 'rejected'; j.result = `No aprobado por el usuario${a.note ? ': ' + a.note : ''}.`; j.endedAt = Date.now(); this.wake(j.id); }
      }
    }
    for (const w of this.approvalWaiters.get(id) || []) w();
    this.approvalWaiters.delete(id);
    this.save(); this.release(); this.pump();
    return a;
  }
  waitApproval(id, seconds) {
    const a = this.approvals.find((x) => x.id === id);
    if (!a) return Promise.reject(new Error('No existe la aprobación'));
    if (a.status !== 'pending') return Promise.resolve(a);
    return new Promise((resolve) => {
      const done = () => { clearTimeout(t); resolve(a); };
      const t = setTimeout(() => { this.approvalWaiters.set(id, (this.approvalWaiters.get(id) || []).filter((x) => x !== done)); resolve(a); }, Math.min(Math.max(seconds, 1), 55) * 1000);
      this.approvalWaiters.set(id, [...(this.approvalWaiters.get(id) || []), done]);
    });
  }
  pendingApprovals() { return this.approvals.filter((a) => a.status === 'pending'); }

  // ---- Entornos aislados y revisión de cambios ----
  async makeWorktree(j) {
    let root;
    try { root = (await git(j.cwd, ['rev-parse', '--show-toplevel'])).trim(); }
    catch { throw new Error('El aislamiento necesita que la carpeta sea un repositorio git. Elige "En la carpeta original" o inicializa git.'); }
    const rel = path.relative(root, j.cwd);
    // Si depende de un encargo aislado del mismo repositorio cuyos cambios aún no se han revisado, parte de esos cambios
    const src = (j.after || []).map((d) => this.jobs.find((x) => x.id === d)).reverse()
      .find((d) => d?.status === 'done' && d.worktree && !d.worktree.removed && d.worktree.root === root && d.review?.status === 'pending' && fs.existsSync(d.worktree.dir));
    if (src) return this.worktreeFrom(j, src, rel);
    const head = (await git(root, ['rev-parse', 'HEAD']).catch(() => '')).trim();
    if (!head) throw new Error('El repositorio no tiene ningún commit todavía; haz un primer commit para poder aislar el encargo.');
    const name = `${path.basename(root)}-${j.id}`;
    const dir = path.join(WT_ROOT, name);
    const branch = `mcphub/encargo-${j.id}`;
    fs.mkdirSync(WT_ROOT, { recursive: true });
    await git(root, ['worktree', 'add', '-q', '-b', branch, dir, head]);
    // Lleva al entorno aislado los cambios sin confirmar (incluidos archivos nuevos) para que el agente vea lo mismo que tú
    const dirty = (await git(root, ['status', '--porcelain'])).trim();
    if (dirty) {
      const patch = await git(root, ['diff', 'HEAD', '--binary']);
      if (patch.trim()) await git(dir, ['apply', '--whitespace=nowarn'], patch);
      const untracked = (await git(root, ['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean);
      for (const f of untracked) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.cpSync(path.join(root, f), path.join(dir, f), { recursive: true }); }
      j.notes = [...(j.notes || []), 'Incluye tus cambios sin confirmar del repositorio'];
    }
    await git(dir, ['add', '-A']);
    await git(dir, ['-c', 'user.name=MCP Hub', '-c', 'user.email=mcp-hub@localhost', 'commit', '-q', '--allow-empty', '-m', `MCP Hub: estado inicial del encargo ${j.id}`]);
    const base = (await git(dir, ['rev-parse', 'HEAD'])).trim();
    return { root, dir, branch, base, runCwd: path.join(dir, rel), created: Date.now() };
  }
  async worktreeFrom(j, src, rel) {
    const s = src.worktree;
    await git(s.dir, ['add', '-A']);
    await git(s.dir, ['-c', 'user.name=MCP Hub', '-c', 'user.email=mcp-hub@localhost', 'commit', '-q', '--allow-empty', '-m', `MCP Hub: cambios del encargo ${src.id} (base del encargo ${j.id})`]);
    const base = (await git(s.dir, ['rev-parse', 'HEAD'])).trim();
    const dir = path.join(WT_ROOT, `${path.basename(s.root)}-${j.id}`);
    const branch = `mcphub/encargo-${j.id}`;
    await git(s.root, ['worktree', 'add', '-q', '-b', branch, dir, base]);
    j.notes = [...(j.notes || []), `Parte de los cambios del encargo ${src.id} (aplica o conserva ese antes que este)`];
    return { root: s.root, dir, branch, base, fromJob: src.id, runCwd: path.join(dir, rel), created: Date.now() };
  }
  async diffStat(j) {
    const w = j.worktree;
    await git(w.dir, ['add', '-A']);
    const stat = (await git(w.dir, ['diff', '--cached', '--numstat', w.base])).trim();
    const files = stat ? stat.split('\n').map((l) => { const [add, del, ...f] = l.split('\t'); return { file: f.join('\t'), add: Number(add) || 0, del: Number(del) || 0 }; }) : [];
    return { files: files.length, added: files.reduce((s, f) => s + f.add, 0), removed: files.reduce((s, f) => s + f.del, 0), list: files.slice(0, 200) };
  }
  async diff(id) {
    const j = this.get(id);
    if (!j.worktree || !fs.existsSync(j.worktree.dir)) throw new Error('Este encargo no tiene un entorno aislado con cambios');
    await git(j.worktree.dir, ['add', '-A']);
    const patch = await git(j.worktree.dir, ['diff', '--cached', j.worktree.base]);
    return { patch: patch.length > 400_000 ? patch.slice(0, 400_000) + '\n… (diff recortado)' : patch, ...(await this.diffStat(j)) };
  }
  async review(id, action) {
    const j = this.get(id);
    const w = j.worktree;
    if (!w) throw new Error('Este encargo no tiene un entorno aislado');
    if (ACTIVE.includes(j.status)) throw new Error('Espera a que termine el encargo');
    if (j.review && !['pending', 'empty', 'error'].includes(j.review.status)) throw new Error('Este encargo ya se revisó');
    const rj = j.reviewJob && this.jobs.find((x) => x.id === j.reviewJob);
    if (rj && (ACTIVE.includes(rj.status) || rj.status === 'starting')) throw new Error(`Espera a que termine la revisión independiente (encargo ${rj.id}): está leyendo esta copia aislada`);
    const dep = this.jobs.find((x) => x.worktree?.fromJob === j.id && !x.worktree.removed && (ACTIVE.includes(x.status) || x.status === 'starting'));
    if (dep) throw new Error(`El encargo ${dep.id} está trabajando sobre estos cambios; espera a que termine`);
    if (action === 'apply' && w.fromJob) {
      const src = this.jobs.find((x) => x.id === w.fromJob);
      if (src?.review?.status === 'pending') throw new Error(`Este encargo parte de los cambios del encargo ${src.id}, que aún no has revisado. Aplica (o conserva) primero ese.`);
    }
    if (action === 'apply') {
      await git(w.dir, ['add', '-A']);
      const patch = await git(w.dir, ['diff', '--cached', '--binary', w.base]);
      if (patch.trim()) {
        try { await git(w.root, ['apply', '--whitespace=nowarn'], patch).catch(() => git(w.root, ['apply', '--3way', '--whitespace=nowarn'], patch)); }
        catch (e) { throw new Error(`No se pudieron aplicar los cambios limpiamente (conflictos con tu copia): ${e.message.slice(0, 400)}. Puedes "Conservar en una rama" y fusionarla tú.`); }
      }
      await this.removeWorktree(j, { keepBranch: false });
      j.review = { ...j.review, status: 'applied', at: Date.now() };
    } else if (action === 'keep') {
      await git(w.dir, ['add', '-A']);
      await git(w.dir, ['-c', 'user.name=MCP Hub', '-c', 'user.email=mcp-hub@localhost', 'commit', '-q', '--allow-empty', '-m', `Encargo ${j.id} (${this.hooks.agentName(j.agent)}): ${j.task.replace(/\s+/g, ' ').slice(0, 60)}`]);
      await this.removeWorktree(j, { keepBranch: true });
      j.review = { ...j.review, status: 'kept', branch: w.branch, at: Date.now() };
    } else if (action === 'discard') {
      await this.removeWorktree(j, { keepBranch: false });
      j.review = { ...(j.review || {}), status: 'discarded', at: Date.now() };
    } else throw new Error('Acción no válida');
    this.save();
    return j;
  }
  async removeWorktree(j, { keepBranch }) {
    const w = j.worktree;
    await git(w.root, ['worktree', 'remove', '--force', w.dir]).catch(() => fs.rmSync(w.dir, { recursive: true, force: true }));
    await git(w.root, ['worktree', 'prune']).catch(() => {});
    if (!keepBranch) await git(w.root, ['branch', '-D', w.branch]).catch(() => {});
    w.removed = Date.now();
  }
}

export const STATUS_LABEL = { waiting: 'esperando a otros encargos', skipped: 'omitido', queued: 'en cola', paused: 'en pausa', awaiting_approval: 'esperando tu aprobación', starting: 'arrancando', running: 'en marcha',
  done: 'terminado', error: 'falló', cancelled: 'cancelado', timeout: 'sin tiempo', interrupted: 'interrumpido', rejected: 'no aprobado' };
const clip = (s, n) => (s.length > n ? s.slice(0, n) + `\n… (recortado, ${s.length - n} caracteres más)` : s);
function mergeUsage(a = {}, b = {}) {
  const out = { ...(a || {}) };
  for (const k of ['costUsd', 'turns', 'inputTokens', 'outputTokens']) if (b[k] != null) out[k] = (out[k] || 0) + b[k];
  return out;
}
export { ACTIVE, FINISHED };
