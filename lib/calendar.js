// Calendario: lee tus calendarios en formato iCal (por ejemplo, la "dirección secreta en formato iCal" de Google Calendar),
// con eventos recurrentes (RRULE, EXDATE, excepciones) y zonas horarias. Los agentes pueden consultar tu agenda y las tareas
// programadas pueden aplazarse si a esa hora estás ocupado. Las URLs son secretas: se guardan con permisos 600 y no se muestran enteras.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CACHE_MS = 10 * 60_000;

// ---- Zonas horarias ----
function tzOffset(zone, t) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  } catch { return null; }
}
// Hora de reloj (año, mes, día, h, min) en una zona → instante UTC
function wallToUtc(w, zone) {
  const guess = Date.UTC(w.y, w.mo, w.d, w.h, w.mi, w.s || 0);
  if (!zone) return new Date(w.y, w.mo, w.d, w.h, w.mi, w.s || 0).getTime(); // hora "flotante": la local
  let off = tzOffset(zone, guess);
  if (off == null) return new Date(w.y, w.mo, w.d, w.h, w.mi, w.s || 0).getTime();
  let t = guess - off;
  const off2 = tzOffset(zone, t);
  if (off2 !== off) t = guess - off2;
  return t;
}
function parseDate(value, params = {}) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(String(value).trim());
  if (!m) return null;
  const w = { y: +m[1], mo: +m[2] - 1, d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
  const allDay = !m[4] || params.VALUE === 'DATE';
  if (m[7]) return { t: Date.UTC(w.y, w.mo, w.d, w.h, w.mi, w.s), w, zone: 'UTC', allDay: false };
  return { t: wallToUtc(w, allDay ? null : params.TZID), w, zone: allDay ? null : params.TZID || null, allDay };
}
const DUR = (s) => { const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(s || ''); if (!m) return null; return (m[1] === '-' ? -1 : 1) * ((+m[2] || 0) * 604800 + (+m[3] || 0) * 86400 + (+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) * 1000; };

// ---- Lectura del iCal ----
export function parseIcs(text) {
  const lines = String(text).replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let ev = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { ev = { exdates: [] }; continue; }
    if (line === 'END:VEVENT') { if (ev) events.push(ev); ev = null; continue; }
    if (!ev) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const [name, ...ps] = line.slice(0, i).split(';');
    const params = Object.fromEntries(ps.map((p) => { const [k, v = ''] = p.split('='); return [k.toUpperCase(), v.replace(/^"|"$/g, '')]; }));
    const val = line.slice(i + 1);
    const unesc = (s) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
    switch (name.toUpperCase()) {
      case 'SUMMARY': ev.title = unesc(val); break;
      case 'LOCATION': ev.location = unesc(val); break;
      case 'UID': ev.uid = val; break;
      case 'DTSTART': ev.start = parseDate(val, params); break;
      case 'DTEND': ev.end = parseDate(val, params); break;
      case 'DURATION': ev.duration = DUR(val); break;
      case 'RRULE': ev.rrule = Object.fromEntries(val.split(';').map((p) => p.split('='))); break;
      case 'EXDATE': for (const v of val.split(',')) { const d = parseDate(v, params); if (d) ev.exdates.push(d.t); } break;
      case 'RECURRENCE-ID': ev.recurrenceId = parseDate(val, params)?.t; break;
      case 'STATUS': ev.cancelled = val.toUpperCase() === 'CANCELLED'; break;
      case 'TRANSP': ev.free = val.toUpperCase() === 'TRANSPARENT'; break;
    }
  }
  return events.filter((e) => e.start);
}
const DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
// Fecha de reloj sumando días (sin depender de la zona del sistema)
const addDays = (w, n) => { const d = new Date(Date.UTC(w.y, w.mo, w.d + n)); return { ...w, y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate() }; };
const dow = (w) => new Date(Date.UTC(w.y, w.mo, w.d)).getUTCDay();

// Ocurrencias de un evento entre from y to
function occurrences(ev, from, to) {
  const len = ev.end ? ev.end.t - ev.start.t : ev.duration ?? (ev.start.allDay ? 86400_000 : 3600_000);
  const toUtc = (w) => (ev.start.allDay ? new Date(w.y, w.mo, w.d).getTime() : ev.start.zone === 'UTC' ? Date.UTC(w.y, w.mo, w.d, w.h, w.mi, w.s) : wallToUtc(w, ev.start.zone));
  const out = [];
  const push = (t) => { if (t + len > from && t < to && !ev.exdates.includes(t)) out.push({ start: t, end: t + len }); };
  const r = ev.rrule;
  if (!r) { push(ev.start.t); return out; }
  const interval = Math.max(1, +r.INTERVAL || 1);
  const until = r.UNTIL ? parseDate(r.UNTIL, {})?.t ?? Infinity : Infinity;
  const count = r.COUNT ? +r.COUNT : Infinity;
  const byday = r.BYDAY ? r.BYDAY.split(',').map((x) => { const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(x); return m ? { n: m[1] ? +m[1] : null, d: DAYS[m[2]] } : null; }).filter(Boolean) : null;
  const bymonthday = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : null;
  let n = 0;
  const emit = (w) => { const t = toUtc(w); if (t < ev.start.t) return true; if (t > until || n >= count) return false; n++; push(t); return t < to; };
  const w0 = ev.start.w;
  let guard = 0;
  if (r.FREQ === 'DAILY') {
    for (let w = w0; guard++ < 20000; w = addDays(w, interval)) if (!(byday && !byday.some((b) => b.d === dow(w))) && !emit(w)) break;
  } else if (r.FREQ === 'WEEKLY') {
    const days = byday ? byday.map((b) => b.d) : [dow(w0)];
    let weekStart = addDays(w0, -((dow(w0) + 6) % 7)); // lunes de la semana inicial
    outer: for (; guard++ < 5000; weekStart = addDays(weekStart, 7 * interval)) {
      for (let k = 0; k < 7; k++) { const w = addDays(weekStart, k); if (days.includes(dow(w)) && !emit({ ...w, h: w0.h, mi: w0.mi, s: w0.s })) break outer; }
    }
  } else if (r.FREQ === 'MONTHLY') {
    for (let k = 0; guard++ < 2000; k += interval) {
      const y = w0.y + Math.floor((w0.mo + k) / 12), mo = (w0.mo + k) % 12;
      const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
      let ds = [];
      if (byday) for (const b of byday) {
        const all = []; for (let d = 1; d <= dim; d++) if (new Date(Date.UTC(y, mo, d)).getUTCDay() === b.d) all.push(d);
        if (b.n == null) ds.push(...all); else { const x = b.n > 0 ? all[b.n - 1] : all[all.length + b.n]; if (x) ds.push(x); }
      } else ds = (bymonthday || [w0.d]).map((d) => (d < 0 ? dim + d + 1 : d)).filter((d) => d >= 1 && d <= dim);
      let stop = false;
      for (const d of ds.sort((a, b) => a - b)) if (!emit({ ...w0, y, mo, d })) { stop = true; break; }
      if (stop) break;
    }
  } else if (r.FREQ === 'YEARLY') {
    for (let k = 0; guard++ < 200; k += interval) if (!emit({ ...w0, y: w0.y + k })) break;
  } else push(ev.start.t);
  return out;
}

export function expand(events, from, to) {
  const overrides = new Map(events.filter((e) => e.recurrenceId).map((e) => [`${e.uid}|${e.recurrenceId}`, e]));
  const out = [];
  for (const e of events) {
    if (e.recurrenceId) { if (!e.cancelled) for (const o of occurrences({ ...e, rrule: null }, from, to)) out.push({ ...o, title: e.title || '(sin título)', location: e.location, allDay: e.start.allDay, free: !!e.free }); continue; }
    if (e.cancelled) continue;
    for (const o of occurrences(e, from, to)) {
      if (overrides.has(`${e.uid}|${o.start}`)) continue;
      out.push({ ...o, title: e.title || '(sin título)', location: e.location, allDay: e.start.allDay, free: !!e.free });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

export class Calendar {
  constructor(confDir) {
    this.file = path.join(confDir, 'calendar.json');
    try { this.conf = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { this.conf = { sources: [], allDayBusy: false }; }
    this.cache = new Map();
  }
  save() { fs.writeFileSync(this.file, JSON.stringify(this.conf), { mode: 0o600 }); }
  view() {
    return { allDayBusy: !!this.conf.allDayBusy, sources: this.conf.sources.map((s) => ({ id: s.id, name: s.name, url: mask(s.url), error: this.cache.get(s.id)?.error || null, at: this.cache.get(s.id)?.at || null, count: this.cache.get(s.id)?.events?.length ?? null })) };
  }
  async addSource({ name, url }) {
    url = String(url || '').trim().replace(/^webcal:/i, 'https:');
    let u; try { u = new URL(url); } catch { throw new Error('URL no válida'); }
    if (u.protocol !== 'https:' && !/^(127\.0\.0\.1|localhost)$/.test(u.hostname)) throw new Error('Usa una dirección https (la de iCal de tu calendario)');
    const src = { id: crypto.randomBytes(3).toString('hex'), name: String(name || u.hostname).trim().slice(0, 60), url };
    const evs = await this.fetchSource(src); // comprueba que funciona antes de guardarla
    this.conf.sources.push(src); this.save();
    return { ...src, url: mask(url), count: evs.length };
  }
  removeSource(id) { this.conf.sources = this.conf.sources.filter((s) => s.id !== id); this.cache.delete(id); this.save(); }
  setOptions({ allDayBusy }) { if (allDayBusy !== undefined) this.conf.allDayBusy = !!allDayBusy; this.save(); }
  async fetchSource(src, force = false) {
    const c = this.cache.get(src.id);
    if (!force && c?.events && Date.now() - c.at < CACHE_MS) return c.events;
    try {
      const res = await fetch(src.url, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'MCP-Hub/1.0' } });
      if (!res.ok) throw new Error(`El calendario respondió ${res.status}`);
      const text = await res.text();
      if (!text.includes('BEGIN:VCALENDAR')) throw new Error('No es un calendario iCal (¿es la dirección "en formato iCal"?)');
      const events = parseIcs(text);
      this.cache.set(src.id, { at: Date.now(), events, error: null });
      return events;
    } catch (e) {
      const msg = e.name === 'TimeoutError' ? 'El calendario no respondió' : e.message;
      this.cache.set(src.id, { at: Date.now(), events: c?.events || null, error: msg });
      if (c?.events) return c.events;
      throw new Error(msg);
    }
  }
  get configured() { return this.conf.sources.length > 0; }
  async events(from, to) {
    const out = [];
    for (const s of this.conf.sources) {
      let evs; try { evs = await this.fetchSource(s); } catch { continue; }
      for (const e of expand(evs, from, to)) out.push({ ...e, calendar: s.name });
    }
    return out.sort((a, b) => a.start - b.start);
  }
  // ¿Estás ocupado en el instante t? Devuelve el evento (el que termina más tarde si se solapan)
  async busyAt(t = Date.now()) {
    if (!this.configured) return null;
    const evs = (await this.events(t - 86400_000, t + 86400_000)).filter((e) => !e.free && (this.conf.allDayBusy || !e.allDay) && e.start <= t && e.end > t);
    return evs.sort((a, b) => b.end - a.end)[0] || null;
  }
  // Huecos libres de al menos `minutes` entre from y to (en horario de 8 a 21 h salvo que se indique otro)
  async freeSlots(from, to, minutes = 30, { dayStart = 8, dayEnd = 21 } = {}) {
    const busy = (await this.events(from, to)).filter((e) => !e.free && (this.conf.allDayBusy || !e.allDay));
    const slots = [];
    for (let d = new Date(from); d.getTime() < to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      let a = Math.max(from, new Date(d.getFullYear(), d.getMonth(), d.getDate(), dayStart).getTime());
      const end = Math.min(to, new Date(d.getFullYear(), d.getMonth(), d.getDate(), dayEnd).getTime());
      for (const e of busy) {
        if (e.end <= a || e.start >= end) continue;
        if (e.start - a >= minutes * 60_000) slots.push({ start: a, end: e.start });
        a = Math.max(a, e.end);
      }
      if (end - a >= minutes * 60_000) slots.push({ start: a, end });
    }
    return slots;
  }
}
function mask(url) { try { const u = new URL(url); return `${u.protocol}//${u.host}/…${u.pathname.slice(-12)}`; } catch { return '••••'; } }
