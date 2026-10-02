// Tareas programadas: encargos que se lanzan solos cada cierto tiempo o a una hora fija.
// Usan la cola de encargos (mismos permisos, aislamiento, límites y aprobaciones). Se guardan en schedules.json.
// Si MCP Hub estaba apagado a la hora prevista, la ejecución perdida NO se recupera: se calcula la siguiente.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function nextRun(when, from = Date.now()) {
  if (when.kind === 'interval') {
    const ms = Math.max(5, Number(when.minutes) || 60) * 60_000;
    return from + ms;
  }
  if (when.kind === 'daily') {
    const [h, m] = String(when.time || '09:00').split(':').map(Number);
    const days = when.days?.length ? when.days : [0, 1, 2, 3, 4, 5, 6];
    const d = new Date(from);
    for (let i = 0; i < 8; i++) {
      const c = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i, h, m, 0, 0);
      if (c.getTime() > from && days.includes(c.getDay())) return c.getTime();
    }
  }
  throw new Error('Programación no válida');
}
export function describe(when) {
  if (when.kind === 'interval') { const m = Number(when.minutes); return m % 1440 === 0 ? `cada ${m / 1440} día(s)` : m % 60 === 0 ? `cada ${m / 60} h` : `cada ${m} min`; }
  const days = when.days?.length && when.days.length < 7 ? when.days.map((d) => DAYS[d]).join(', ') : 'todos los días';
  return `${days} a las ${when.time}`;
}

export class Scheduler {
  // hooks: { create(jobOpts) -> job, emit(), notify(text) }
  constructor(confDir, hooks) {
    this.file = path.join(confDir, 'schedules.json');
    this.hooks = hooks;
    try { this.items = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { this.items = []; }
    for (const s of this.items) if (s.enabled && (!s.next || s.next < Date.now())) s.next = nextRun(s.when);
    this.save();
    this.timer = setInterval(() => { if (this.ticking) return; this.ticking = true; this.tick().catch(() => {}).finally(() => { this.ticking = false; }); }, 30_000);
  }
  save() { fs.writeFileSync(this.file, JSON.stringify(this.items, null, 2), { mode: 0o600 }); this.hooks.emit?.(); }
  validate(when) {
    if (when?.kind === 'interval') { if (!(Number(when.minutes) >= 5)) throw new Error('El intervalo mínimo es de 5 minutos'); return { kind: 'interval', minutes: Math.round(Number(when.minutes)) }; }
    if (when?.kind === 'daily') {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(when.time || '')) throw new Error('Hora no válida (HH:MM)');
      const days = (when.days || []).map(Number).filter((d) => d >= 0 && d <= 6);
      return { kind: 'daily', time: when.time, days: [...new Set(days)].sort() };
    }
    throw new Error('Elige cada cuánto se ejecuta');
  }
  save1(o) {
    const name = String(o.name || '').trim();
    if (!name) throw new Error('Ponle un nombre');
    if (!String(o.job?.task || '').trim()) throw new Error('Falta la tarea');
    if (!o.job?.agent) throw new Error('Falta el agente');
    const when = this.validate(o.when);
    const prev = this.items.find((x) => x.id === o.id);
    const s = { id: prev?.id || crypto.randomBytes(3).toString('hex'), name, when, job: { ...o.job }, enabled: o.enabled !== false,
      created: prev?.created || Date.now(), lastRun: prev?.lastRun || null, lastJob: prev?.lastJob || null, runs: prev?.runs || 0, avoidBusy: !!o.avoidBusy };
    s.next = s.enabled ? nextRun(when) : null;
    if (prev) Object.assign(prev, s); else this.items.push(s);
    this.save();
    return s;
  }
  remove(id) { this.items = this.items.filter((x) => x.id !== id); this.save(); }
  toggle(id, on) { const s = this.items.find((x) => x.id === id); if (!s) throw new Error('No existe'); s.enabled = !!on; s.next = on ? nextRun(s.when) : null; this.save(); return s; }
  runNow(id) { const s = this.items.find((x) => x.id === id); if (!s) throw new Error('No existe'); return this.fire(s, true); }
  fire(s, manual = false) {
    try {
      const job = this.hooks.create({ ...s.job, from: `Programado · ${s.name}` });
      Object.assign(s, { lastRun: Date.now(), lastJob: job.id, lastError: null, runs: (s.runs || 0) + 1 });
      return job;
    } catch (e) {
      Object.assign(s, { lastRun: Date.now(), lastError: e.message });
      this.hooks.notify?.('schedules', `⚠️ La tarea programada "${s.name}" no se pudo lanzar: ${e.message}`);
      if (manual) throw e;
      return null;
    } finally {
      if (s.enabled) s.next = nextRun(s.when);
      this.save();
    }
  }
  async tick() {
    const now = Date.now();
    for (const s of this.items) {
      if (!s.enabled || !s.next || s.next > now) continue;
      // Si así se pidió y el calendario dice que estás ocupado, se aplaza hasta que termine el evento
      if (s.avoidBusy && this.hooks.busy) {
        const ev = await this.hooks.busy(now);
        if (ev) { s.next = ev.end + 60_000; s.postponed = { at: now, until: s.next, reason: ev.title }; this.save(); continue; }
      }
      s.postponed = null;
      this.fire(s);
    }
  }
  view() { return this.items.map((s) => ({ ...s, whenText: describe(s.when) })); }
}
