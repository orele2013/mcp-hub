// Funciones ampliadas de MCP Hub, conectadas al servidor en un solo punto:
// chat unificado y debates, tablero kanban, recetas (grabar y repetir), agente sombra, mapa del proyecto, monitores,
// calendario, GitHub, Home Assistant y el MCP "mcp-hub-extras" para los agentes.
import path from 'node:path';
import { Chats } from './lib/chat.js';
import { Board, COLUMNS } from './lib/board.js';
import { Shadow } from './lib/shadow.js';
import { ProjectMaps } from './lib/projmap.js';
import { Monitors } from './lib/monitors.js';
import { Calendar } from './lib/calendar.js';
import { HomeAssistant } from './lib/homeassistant.js';
import * as gh from './lib/github.js';
import { QUIET_KINDS } from './lib/jobs.js';

export function setupFeatures(ctx) {
  const { CONF_DIR, jobsMgr, createJobs, library, messenger, sessions, sessionInfo, screenText, broadcastEvent, agentName, installed, removeSession } = ctx;
  const emitter = (t) => () => broadcastEvent({ t });
  const createJob = (o) => {
    const r = createJobs(o);
    return jobsMgr.get(r.id);
  };
  const cancelJob = (id) => jobsMgr.cancel(id);
  const getJob = (id) => jobsMgr.jobs.find((j) => j.id === id) || null;
  const notify = (type, text, opts = {}) => { try { messenger.notify(type, text, opts); } catch {} };

  const chats = new Chats(CONF_DIR, { createJob, cancelJob, installed, agentName, emit: emitter('chats') });
  const board = new Board(CONF_DIR, { createJob, cancelJob, getJob, emit: emitter('board') });
  const maps = new ProjectMaps(CONF_DIR, { createJob, emit: emitter('map') });
  const monitors = new Monitors(CONF_DIR, { createJob, getJob, installed, notify, emit: emitter('monitors') });
  const calendar = new Calendar(CONF_DIR);
  const ha = new HomeAssistant(CONF_DIR, {
    hold: (on, reason) => jobsMgr.hold(on, reason), emit: emitter('ha'),
    log: (text) => { try { messenger.record({ dir: 'out', channel: '-', from: 'Home Assistant', text }); } catch {} },
  });
  const shadow = new Shadow({
    screen: screenText, installed, notify, emit: emitter('shadow'), createJob,
    session: (id) => { const s = sessions.get(id); return s ? { ...sessionInfo(s), job: s.job || null } : null; },
    alert: (a) => broadcastEvent({ t: 'shadow-alert', alert: a }),
  });
  messenger.hooks.forward = (type, text, opts) => ha.forward(type, text, opts);

  // Al terminar cualquier encargo: cada módulo recoge los suyos; las pestañas de chat, debate y sombra se cierran solas
  jobsMgr.hooks.onFinished = (j) => {
    for (const m of [chats, board, shadow, maps, monitors]) try { m.jobFinished(j); } catch (e) { console.error('jobFinished', e); }
    if (QUIET_KINDS.includes(j.kind) && j.sessionId) setTimeout(() => removeSession(j.sessionId), 15_000);
  };

  const dayRange = (days) => { const a = new Date(); a.setHours(0, 0, 0, 0); return [a.getTime(), a.getTime() + Math.max(1, Math.min(Number(days) || 7, 62)) * 86400_000]; };
  const evView = (e) => ({ ...e, startText: new Date(e.start).toLocaleString('es-ES'), endText: new Date(e.end).toLocaleString('es-ES') });
  const ghDir = (d) => path.resolve(String(d || '').replace(/^~(?=$|\/)/, process.env.HOME));

  async function prFromJob(id, { draft = true } = {}) {
    const j = jobsMgr.get(id);
    if (!j.worktree) throw new Error('Solo se pueden convertir en PR los encargos que trabajaron en un entorno aislado');
    if (j.review?.status === 'pending') await jobsMgr.review(j.id, 'keep');
    else if (j.review?.status !== 'kept') throw new Error('Los cambios de este encargo ya se aplicaron o descartaron; no hay rama que subir');
    const rj = j.reviewJob && getJob(j.reviewJob);
    const VER = { approved: 'Aprobado', changes: 'Cambios necesarios', rejected: 'Rechazado' };
    const issueNo = j.meta?.issue;
    const body = `${issueNo ? `Closes #${issueNo}\n\n` : ''}## Encargo
${j.task.slice(0, 3000)}

## Resumen del agente (${agentName(j.agent)}${j.model ? ` · ${j.model}` : ''})
${String(j.result || '').slice(0, 6000)}
${rj ? `\n## Revisión independiente (${agentName(rj.agent)}): ${VER[rj.verdict] || 'sin veredicto'}\n<details><summary>Ver la revisión</summary>\n\n${String(rj.result || '').slice(0, 20000)}\n\n</details>\n` : ''}
---
Creado desde MCP Hub (encargo ${j.id}).`;
    const title = (issueNo ? `#${issueNo} ` : '') + j.task.replace(/\s+/g, ' ').replace(/^Issue #\d+:\s*/, '').slice(0, 72);
    const r = await gh.createPr({ root: j.worktree.root, branch: j.worktree.branch, title, body, draft });
    j.pr = { url: r.url, at: Date.now() }; jobsMgr.save();
    return r;
  }

  const routes = {
    // ---- Chat y debates ----
    'GET /api/chats': async () => ({ threads: chats.list(), agents: chats.available() }),
    'GET /api/chats/thread': async (_b, url) => chats.get(url.searchParams.get('id')),
    'POST /api/chats/create': async (b) => chats.create(b),
    'POST /api/chats/post': async (b) => chats.post(b.id, b.text),
    'POST /api/chats/settings': async (b) => chats.settings(b.id, b),
    'POST /api/chats/stop': async (b) => chats.stopDebate(b.id),
    'POST /api/chats/delete': async (b) => { chats.remove(b.id); return {}; },
    // ---- Tablero ----
    'GET /api/board': async () => ({ cards: board.view(), columns: COLUMNS }),
    'POST /api/board/save': async (b) => board.save1(b),
    'POST /api/board/move': async (b) => board.move(b.id, b.column, { cancel: !!b.cancel, order: b.order }),
    'POST /api/board/delete': async (b) => { board.remove(b.id); return {}; },
    // ---- Recetas ----
    'GET /api/recipes': async () => ({ recipes: library.recipes.map(({ steps, ...r }) => ({ ...r, stepCount: steps.length, preview: steps.slice(0, 8) })) }),
    'GET /api/delegations/steps': async (_b, url) => ({ steps: jobsMgr.get(url.searchParams.get('id')).steps || [] }),
    'POST /api/recipes/save': async (b) => { const r = library.saveRecipe(jobsMgr.get(b.job), b.name); return { id: r.id, name: r.name, steps: r.steps.length }; },
    'POST /api/recipes/delete': async (b) => { library.deleteRecipe(b.id); return {}; },
    'POST /api/recipes/run': async (b) => {
      const { recipe, task } = library.recipeTask(b.id, String(b.notes || '').slice(0, 4000));
      return createJobs({ agent: b.agent || recipe.agent, model: b.model ?? recipe.model, cwd: b.cwd, task, kind: 'replay', permission: b.permission || recipe.permission,
        isolation: b.isolation || recipe.isolation, reviewWith: b.reviewWith || undefined, from: `Receta · ${recipe.name}`.slice(0, 80), meta: { recipe: recipe.id } });
    },
    // ---- Agente sombra ----
    'GET /api/shadow': async () => ({ watch: shadow.view() }),
    'POST /api/shadow/set': async (b) => shadow.set(String(b.session || ''), b),
    // ---- Mapa del proyecto ----
    'GET /api/map': async (_b, url) => maps.get(url.searchParams.get('dir')),
    'POST /api/map/describe': async (b) => { const j = await maps.describe(b.dir, { agent: b.agent, model: b.model }); return { job: j.id }; },
    // ---- Monitores ----
    'GET /api/monitors': async () => ({ monitors: monitors.view() }),
    'POST /api/monitors/save': async (b) => monitors.save1(b),
    'POST /api/monitors/delete': async (b) => { monitors.remove(b.id); return {}; },
    'POST /api/monitors/check': async (b) => monitors.check(monitors.get(b.id)),
    // ---- Calendario ----
    'GET /api/calendar': async (_b, url) => {
      const [from, to] = dayRange(url.searchParams.get('days') || 7);
      const busy = await calendar.busyAt().catch(() => null);
      return { ...calendar.view(), events: (await calendar.events(from, to)).map(evView), busyNow: busy && evView(busy) };
    },
    'POST /api/calendar/add': async (b) => calendar.addSource(b),
    'POST /api/calendar/remove': async (b) => { calendar.removeSource(b.id); return {}; },
    'POST /api/calendar/options': async (b) => { calendar.setOptions(b); return calendar.view(); },
    // ---- GitHub ----
    'GET /api/github/status': async () => gh.status(),
    'GET /api/github/issues': async (_b, url) => {
      const dir = ghDir(url.searchParams.get('dir'));
      const [repo, list] = await Promise.all([gh.repoInfo(dir), gh.issues(dir, { state: url.searchParams.get('state') || 'open', search: url.searchParams.get('q') || '' })]);
      const linked = new Map();
      for (const j of jobsMgr.jobs) if (j.meta?.issue && j.meta.repo === repo.nameWithOwner) linked.set(j.meta.issue, { job: j.id, status: j.status, pr: j.pr?.url || null });
      for (const c of board.cards) if (c.source?.type === 'github' && c.source.repo === repo.nameWithOwner) linked.set(c.source.number, { ...(linked.get(c.source.number) || {}), card: c.id, column: c.column });
      return { repo, issues: list.map((i) => ({ ...i, linked: linked.get(i.number) || null })) };
    },
    'POST /api/github/issue': async (b) => {
      const dir = ghDir(b.dir);
      const [repo, it] = await Promise.all([gh.repoInfo(dir), gh.issue(dir, b.number)]);
      if (b.to === 'board') {
        return board.save1({ title: `#${it.number} ${it.title}`, desc: it.text, cwd: dir, agent: b.agent, model: b.model, permission: b.permission, isolation: b.isolation || 'worktree',
          reviewWith: b.reviewWith || null, labels: it.labels, source: { type: 'github', repo: repo.nameWithOwner, number: it.number, url: it.url } });
      }
      return createJobs({ agent: b.agent, model: b.model, cwd: dir, kind: 'issue', isolation: b.isolation || 'worktree', permission: b.permission || 'edit', reviewWith: b.reviewWith || undefined,
        from: `GitHub · ${repo.nameWithOwner}#${it.number}`.slice(0, 80), meta: { issue: it.number, repo: repo.nameWithOwner, url: it.url },
        task: `Resuelve este issue de GitHub en el repositorio (${repo.nameWithOwner}).\n\n${it.text}\n\nHaz el cambio mínimo y correcto, con tests si el proyecto los tiene. Al terminar, resume qué cambiaste y cómo comprobarlo.` });
    },
    'POST /api/github/pr': async (b) => prFromJob(String(b.job || ''), { draft: b.draft !== false }),
    // ---- Home Assistant ----
    'GET /api/ha': async () => ha.view(),
    'POST /api/ha/config': async (b) => ha.setConfig(b),
    'POST /api/ha/test': async () => ha.test(),
    'POST /api/ha/discover': async () => ha.discover(),
    'POST /api/ha/send-test': async () => ({ done: await ha.send('Prueba de avisos de MCP Hub', { title: 'MCP Hub' }) }),
    // ---- Sala de control ----
    'GET /api/control': async () => ({
      sessions: [...sessions.values()].filter((s) => !s.exited).map(sessionInfo),
      jobs: jobsMgr.jobs.filter((j) => ['running', 'starting', 'queued', 'waiting', 'awaiting_approval'].includes(j.status) && !QUIET_KINDS.includes(j.kind)).map(jobsMgr.view.bind(jobsMgr)),
      approvals: jobsMgr.pendingApprovals(), held: jobsMgr.held || null,
      monitors: monitors.view().map(({ id, name, state, history }) => ({ id, name, state, last: history.at(-1) || null })),
      shadow: Object.entries(shadow.view()).map(([id, w]) => ({ session: id, alerts: w.alerts.slice(0, 3), busy: !!w.job })),
      busyNow: await calendar.busyAt().catch(() => null),
    }),
  };

  // ---- API para agentes (MCP mcp-hub-extras) ----
  async function agentApi(action, b) {
    switch (action) {
      case 'calendar_events': { const [from, to] = dayRange(b.days || 1); return { events: (await calendar.events(from, to)).map(evView), configured: calendar.configured }; }
      case 'calendar_free': { const [from, to] = dayRange(b.days || 3); return { slots: (await calendar.freeSlots(Math.max(from, Date.now()), to, Number(b.minutes) || 30)).map((s) => ({ start: new Date(s.start).toLocaleString('es-ES'), end: new Date(s.end).toLocaleString('es-ES') })), configured: calendar.configured }; }
      case 'calendar_now': { const e = await calendar.busyAt(); return { busy: !!e, event: e && evView(e), configured: calendar.configured }; }
      case 'board_list': return { cards: board.view().map(({ id, title, column, agent, jobStatus, cwd }) => ({ id, title, column: COLUMNS[column], agent, jobStatus, cwd })) };
      case 'board_add': return board.save1({ title: b.title, desc: b.description, cwd: b.cwd, agent: b.agent || 'claude', column: 'ideas', isolation: b.isolation, permission: b.permission });
      case 'project_map': {
        const m = await maps.get(b.cwd);
        return { root: m.root, modules: m.modules.map((x) => ({ module: x.id, files: x.files.length, lines: x.lines, description: m.descriptions[x.id] || null })),
          dependencies: m.edges, external: m.external.slice(0, 30), truncated: m.truncated };
      }
      case 'monitors_status': return { monitors: monitors.view().map(({ name, url, state, history, incident }) => ({ name, url, state, last: history.at(-1) || null, incident })) };
      default: throw new Error('Acción desconocida');
    }
  }

  async function binary(url, res) {
    // Vídeo de demostración de un diseño (GET /api/design/video?slug=&format=mp4|gif|webm)
    const q = url.searchParams;
    const r = await ctx.designer.video(q.get('slug'), { format: q.get('format') || 'mp4', width: Number(q.get('w')) || undefined, height: Number(q.get('h')) || undefined });
    res.writeHead(200, { 'content-type': r.mime, 'content-disposition': `attachment; filename="${r.name}"`, 'cache-control': 'no-store' });
    res.end(r.data);
  }

  // Tareas programadas que se aplazan si estás ocupado según el calendario
  ctx.scheduler.hooks.busy = (t) => calendar.busyAt(t).catch(() => null);

  return { routes, agentApi, binary, chats, board, shadow, maps, monitors, calendar, ha };
}
