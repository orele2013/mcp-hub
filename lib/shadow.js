// Agente sombra: mientras trabajas en una terminal, otro agente mira de vez en cuando lo que se ve en ella
// y te avisa si detecta un error, un fallo de tests, un comando peligroso o un riesgo.
// Solo se consulta al agente cuando la pantalla ha cambiado desde la última vez, y como mucho cada "every" minutos.
import crypto from 'node:crypto';

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex');

export class Shadow {
  // hooks: { screen(sessionId, lines) -> Promise<string>, session(id) -> {title, cwd, client, exited} | null, createJob(opts) -> job, installed(id), notify(type, text), emit(), alert(obj) }
  constructor(hooks) {
    this.hooks = hooks;
    this.watch = new Map(); // sessionId -> { agent, model, every, lastAt, lastHash, job, alerts: [], checks }
    this.timer = setInterval(() => this.tick().catch(() => {}), 30_000);
  }
  view() { return Object.fromEntries([...this.watch].map(([k, w]) => [k, { ...w }])); }
  set(sessionId, { enabled, agent = 'claude', model = null, every = 5 } = {}) {
    if (!enabled) { this.watch.delete(sessionId); this.hooks.emit?.(); return null; }
    const s = this.hooks.session(sessionId);
    if (!s || s.exited) throw new Error('Esa sesión ya no está abierta');
    if (s.job) throw new Error('Las pestañas de encargos no se vigilan');
    if (!this.hooks.installed(agent)) throw new Error('Ese agente no está instalado');
    const prev = this.watch.get(sessionId);
    const w = { agent, model: model || (agent === 'claude' ? 'haiku' : null), every: Math.max(2, Math.min(Number(every) || 5, 120)),
      lastAt: prev?.lastAt || 0, lastHash: prev?.lastHash || null, job: prev?.job || null, alerts: prev?.alerts || [], checks: prev?.checks || 0 };
    this.watch.set(sessionId, w);
    this.hooks.emit?.();
    return w;
  }
  async tick() {
    const now = Date.now();
    for (const [id, w] of this.watch) {
      const s = this.hooks.session(id);
      if (!s || s.exited) { this.watch.delete(id); this.hooks.emit?.(); continue; }
      if (w.job || now - w.lastAt < w.every * 60_000) continue;
      const text = await this.hooks.screen(id, 120);
      const h = hash(text);
      if (!text.trim() || h === w.lastHash) continue; // nada nuevo que mirar: no se gasta nada
      w.lastHash = h; w.lastAt = now; w.checks++;
      try {
        const j = this.hooks.createJob({ agent: w.agent, model: w.model, cwd: s.cwd, kind: 'shadow', permission: 'read', isolation: 'none', timeoutMin: 5,
          from: `Sombra · ${s.title}`.slice(0, 80), meta: { shadow: id },
          task: `Eres un observador silencioso. El usuario está trabajando en una terminal ("${s.title}", carpeta ${s.cwd}). Esto es lo último que se ve en ella:

----- PANTALLA -----
${text}
----- FIN -----

Si ves algo que el usuario debería saber YA (un error o excepción sin resolver, tests que fallan, un comando peligroso o destructivo, credenciales a la vista, un agente atascado en bucle o que hace algo distinto de lo pedido), responde empezando por "AVISO:" y explícalo en 1–3 frases con lo que conviene hacer.
Si todo parece normal, responde exactamente: NADA
No modifiques archivos ni ejecutes comandos con efectos.` });
        w.job = j.id;
      } catch (e) { w.alerts.unshift({ at: now, text: `No se pudo lanzar la comprobación: ${e.message}`, error: true }); w.alerts = w.alerts.slice(0, 20); }
      this.hooks.emit?.();
    }
  }
  jobFinished(j) {
    const id = j.meta?.shadow;
    const w = this.watch.get(id);
    if (!w || w.job !== j.id) return;
    w.job = null;
    const r = String(j.result || '').trim();
    const m = /AVISO:\s*([\s\S]+)/i.exec(r);
    if (j.status === 'done' && m) {
      const s = this.hooks.session(id);
      const a = { at: Date.now(), text: m[1].trim().slice(0, 1200), session: id, title: s?.title || '' };
      w.alerts.unshift(a); w.alerts = w.alerts.slice(0, 20);
      this.hooks.alert?.(a);
      this.hooks.notify?.('shadow', `👀 ${a.title}: ${a.text}`);
    } else if (j.status !== 'done') {
      w.alerts.unshift({ at: Date.now(), text: `La comprobación falló (${j.status}).`, error: true }); w.alerts = w.alerts.slice(0, 20);
    }
    this.hooks.emit?.();
  }
}
