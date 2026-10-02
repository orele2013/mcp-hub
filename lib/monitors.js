// Monitor de webs y APIs: comprueba una URL cada N minutos. Tras 2 fallos seguidos se considera caída: te avisa y,
// si lo configuras, un agente investiga (un encargo por incidente) y te propone el arreglo. Al recuperarse también avisa.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const FAILS_TO_DOWN = 2;

export class Monitors {
  // hooks: { createJob(opts) -> job, getJob(id), installed(id), notify(type, text, opts), emit() }
  constructor(confDir, hooks) {
    this.file = path.join(confDir, 'monitors.json');
    this.hooks = hooks;
    try { this.items = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { this.items = []; }
    this.busy = new Set();
    this.timer = setInterval(() => this.tick(), 15_000);
  }
  save() { fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.items), { mode: 0o600 }); fs.renameSync(this.file + '.tmp', this.file); this.hooks.emit?.(); }
  get(id) { const m = this.items.find((x) => x.id === id); if (!m) throw new Error('No existe ese monitor'); return m; }
  view() { return this.items.map((m) => ({ ...m, url: maskUrl(m.url), history: m.history.slice(-60) })); }
  save1(o) {
    const prev = o.id ? this.get(o.id) : null;
    let url = String(o.url || '').trim();
    if (prev && url === maskUrl(prev.url)) url = prev.url; // la interfaz recibe la URL con los secretos ocultos
    else if (url.includes('••••')) throw new Error('La URL tiene partes ocultas: escríbela completa de nuevo');
    let u; try { u = new URL(url); } catch { throw new Error('URL no válida'); }
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Solo se admiten URLs http o https');
    const every = Math.max(1, Math.min(Number(o.every) || 5, 1440));
    const [lo, hi] = String(o.expectStatus || '200-399').split('-').map((x) => Number(x.trim()));
    if (!(lo >= 100 && lo <= 599) || (hi && !(hi >= lo && hi <= 599))) throw new Error('Códigos de estado no válidos (ejemplo: 200-399 o 200)');
    const inv = o.investigate?.agent ? o.investigate : null;
    if (inv) {
      if (!this.hooks.installed(inv.agent)) throw new Error('El agente para investigar no está instalado');
      inv.cwd = path.resolve(String(inv.cwd || os.homedir()).replace(/^~(?=$|\/)/, os.homedir()));
      if (!fs.existsSync(inv.cwd)) throw new Error(`La carpeta no existe: ${inv.cwd}`);
      if (!['read', 'edit', 'full'].includes(inv.permission || 'read')) throw new Error('Permiso no válido');
    }
    const m = {
      id: prev?.id || crypto.randomBytes(3).toString('hex'), name: String(o.name || u.host).trim().slice(0, 80), url, method: o.method === 'HEAD' ? 'HEAD' : 'GET',
      every, expectStatus: hi ? `${lo}-${hi}` : String(lo), expectText: String(o.expectText || '').slice(0, 200), timeoutSec: Math.max(2, Math.min(Number(o.timeoutSec) || 10, 60)),
      enabled: o.enabled !== false, investigate: inv ? { agent: inv.agent, model: inv.model || null, cwd: inv.cwd, permission: inv.permission || 'read' } : null,
      state: prev?.state || 'unknown', fails: prev?.fails || 0, lastCheck: prev?.lastCheck || 0, history: prev?.history || [], incident: prev?.incident || null, incidents: prev?.incidents || [],
    };
    if (prev) Object.assign(prev, m); else this.items.push(m);
    this.save();
    if (m.enabled) this.check(m).catch(() => {});
    return m;
  }
  remove(id) { this.items = this.items.filter((x) => x.id !== id); this.save(); }
  tick() { const now = Date.now(); for (const m of this.items) if (m.enabled && now - m.lastCheck >= m.every * 60_000) this.check(m).catch(() => {}); }
  async check(m) {
    if (this.busy.has(m.id)) return;
    this.busy.add(m.id);
    const t0 = Date.now();
    let r;
    try {
      const res = await fetch(m.url, { method: m.method, redirect: 'follow', signal: AbortSignal.timeout(m.timeoutSec * 1000), headers: { 'user-agent': 'MCP-Hub-Monitor/1.0' } });
      const [lo, hi] = m.expectStatus.split('-').map(Number);
      const okStatus = res.status >= lo && res.status <= (hi || lo);
      let okText = true;
      if (m.expectText && m.method === 'GET') { const body = (await res.text()).slice(0, 2_000_000); okText = body.includes(m.expectText); }
      else res.body?.cancel?.().catch?.(() => {});
      r = { at: t0, ok: okStatus && okText, ms: Date.now() - t0, status: res.status, error: !okStatus ? `Código ${res.status}` : !okText ? `No aparece el texto "${m.expectText}"` : undefined };
    } catch (e) {
      r = { at: t0, ok: false, ms: Date.now() - t0, status: null, error: e.name === 'TimeoutError' ? `Sin respuesta en ${m.timeoutSec} s` : (e.cause?.code || e.message) };
    } finally { this.busy.delete(m.id); }
    m.lastCheck = t0;
    m.history.push(r); m.history = m.history.slice(-300);
    if (r.ok) {
      if (m.state === 'down') {
        const mins = Math.round((Date.now() - (m.incident?.since || Date.now())) / 60000);
        if (m.incident) { m.incident.until = Date.now(); m.incidents = [m.incident, ...m.incidents].slice(0, 30); }
        this.hooks.notify?.('monitors', `✅ ${m.name} vuelve a funcionar (caída de ${mins} min).`, { subject: 'Monitores' });
      }
      m.state = 'up'; m.fails = 0; m.incident = null;
    } else {
      m.fails++;
      if (m.state !== 'down' && m.fails >= FAILS_TO_DOWN) {
        m.state = 'down';
        m.incident = { since: m.history.at(-FAILS_TO_DOWN)?.at || t0, error: r.error, job: null };
        let extra = '';
        if (m.investigate) {
          try {
            const recent = m.history.slice(-10).map((h) => `${new Date(h.at).toLocaleString('es-ES')}: ${h.ok ? 'OK' : 'FALLO'} ${h.status ?? ''} ${h.ms} ms ${h.error || ''}`).join('\n');
            const j = this.hooks.createJob({ agent: m.investigate.agent, model: m.investigate.model, cwd: m.investigate.cwd, kind: 'monitor', permission: m.investigate.permission,
              isolation: m.investigate.permission === 'read' ? 'none' : undefined, from: `Monitor · ${m.name}`, meta: { monitor: m.id },
              task: `El monitor "${m.name}" detecta que ${maskUrl(m.url)} ha dejado de funcionar.
Último error: ${r.error}
Comprobaciones recientes:
${recent}

Investiga la causa probable (mira el código y la configuración de esta carpeta, logs si los hay y la propia URL) y propón el arreglo concreto.
${m.investigate.permission === 'read' ? 'No modifiques nada: solo diagnostica y propone.' : 'Si el arreglo es claro y seguro, aplícalo y explica qué cambiaste.'}
Empieza la respuesta con una línea de diagnóstico corto.` });
            m.incident.job = j.id; extra = `\nUn agente lo está investigando (encargo ${j.id}).`;
          } catch (e) { extra = `\nNo se pudo lanzar la investigación: ${e.message}`; }
        }
        this.hooks.notify?.('monitors', `🔴 ${m.name} no funciona: ${r.error}.${extra}`, { subject: 'Monitores', urgent: true });
      }
    }
    this.save();
    return r;
  }
  jobFinished(j) {
    const m = this.items.find((x) => x.id === j.meta?.monitor);
    if (!m) return;
    const inc = m.incident?.job === j.id ? m.incident : m.incidents.find((x) => x.job === j.id);
    if (!inc) return;
    const first = String(j.result || '').split('\n').find((l) => l.trim()) || '';
    inc.diagnosis = first.replace(/^[#>*\-\s]+/, '').replace(/\*\*|__|`/g, '').trim().slice(0, 300) || null;
    this.save();
    this.hooks.notify?.('monitors', `🔎 Diagnóstico de ${m.name}: ${inc.diagnosis || j.status}. Detalle en MCP Hub → Agentes → Encargos (${j.id}).`, { subject: 'Monitores' });
  }
}
// Oculta usuario, contraseña y parámetros con pinta de secreto
export function maskUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = '••••';
    for (const k of [...u.searchParams.keys()]) if (/key|token|secret|pass|auth|sig/i.test(k)) u.searchParams.set(k, '••••');
    return u.toString();
  } catch { return url; }
}
