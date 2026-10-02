// Home Assistant: los avisos de MCP Hub pueden llegar a un servicio de notificación (por ejemplo, la app de HA en el móvil),
// hacer parpadear una luz o decirse en voz alta por un altavoz. Además, al salir de casa (según una entidad person/device_tracker)
// se pausan los encargos nuevos, y al volver se reanudan. El token de acceso se guarda con permisos 600 y nunca se devuelve entero.
import fs from 'node:fs';
import path from 'node:path';

const TYPES = ['jobs', 'approvals', 'schedules', 'design', 'security', 'monitors', 'shadow', 'sessions'];

export class HomeAssistant {
  // hooks: { hold(on, reason), emit(), log(text) }
  constructor(confDir, hooks) {
    this.file = path.join(confDir, 'homeassistant.json');
    this.hooks = hooks;
    try { this.conf = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { this.conf = {}; }
    this.conf = { enabled: false, url: '', token: '', notifyService: '', light: { entity: '', color: [255, 120, 0] }, tts: { entity: '', player: '' },
      types: { approvals: true, monitors: true, shadow: false, jobs: false, security: true }, presence: { entity: '', pauseAway: true }, ...this.conf };
    this.state = { lastPresence: null, away: false, error: null, lastSent: null };
    this.timer = setInterval(() => this.pollPresence().catch(() => {}), 60_000);
    setTimeout(() => this.pollPresence().catch(() => {}), 3000);
  }
  save() { fs.writeFileSync(this.file, JSON.stringify(this.conf), { mode: 0o600 }); this.hooks.emit?.(); }
  view() { const c = this.conf; return { ...c, token: c.token ? '••••' + c.token.slice(-4) : '', state: this.state, typeList: TYPES }; }
  setConfig(o) {
    const c = this.conf;
    if (o.url !== undefined) {
      const url = String(o.url).trim().replace(/\/+$/, '');
      if (url) { let u; try { u = new URL(url); } catch { throw new Error('URL de Home Assistant no válida'); } if (!['http:', 'https:'].includes(u.protocol)) throw new Error('La URL debe empezar por http:// o https://'); }
      c.url = url;
    }
    if (o.token !== undefined && !String(o.token).startsWith('••••')) c.token = String(o.token).trim();
    const ent = (v) => { v = String(v || '').trim(); if (v && !/^[a-z_]+\.[\w-]+$/.test(v)) throw new Error(`Entidad no válida: ${v}`); return v; };
    if (o.notifyService !== undefined) { const v = String(o.notifyService || '').trim().replace(/^notify\./, ''); if (v && !/^[\w-]+$/.test(v)) throw new Error('Servicio de notificación no válido'); c.notifyService = v; }
    if (o.light) c.light = { entity: ent(o.light.entity), color: Array.isArray(o.light.color) ? o.light.color.slice(0, 3).map((x) => Math.max(0, Math.min(255, Number(x) || 0))) : c.light.color };
    if (o.tts) c.tts = { entity: ent(o.tts.entity), player: ent(o.tts.player) };
    if (o.types) c.types = Object.fromEntries(TYPES.map((t) => [t, !!o.types[t]]));
    if (o.presence) c.presence = { entity: ent(o.presence.entity), pauseAway: !!o.presence.pauseAway };
    if (o.enabled !== undefined) c.enabled = !!o.enabled;
    if (c.enabled && (!c.url || !c.token)) throw new Error('Falta la URL o el token de Home Assistant');
    this.save();
    if (!c.presence.entity || !c.enabled) this.setAway(false);
    return this.view();
  }
  async api(method, p, body) {
    const c = this.conf;
    if (!c.url || !c.token) throw new Error('Home Assistant no está configurado');
    const res = await fetch(`${c.url}/api${p}`, { method, headers: { authorization: `Bearer ${c.token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) })
      .catch((e) => { throw new Error(e.name === 'TimeoutError' ? 'Home Assistant no responde' : `No se pudo conectar con Home Assistant (${e.cause?.code || e.message})`); });
    if (res.status === 401) throw new Error('Home Assistant rechazó el token (401)');
    if (!res.ok) throw new Error(`Home Assistant respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json().catch(() => ({}));
  }
  async test() { const r = await this.api('GET', '/'); return { message: r.message || 'Conectado' }; }
  // Entidades y servicios para elegir en la interfaz
  async discover() {
    const [states, services] = await Promise.all([this.api('GET', '/states'), this.api('GET', '/services')]);
    const of = (dom) => states.filter((s) => s.entity_id.startsWith(dom + '.')).map((s) => ({ id: s.entity_id, name: s.attributes?.friendly_name || s.entity_id, state: s.state }));
    return { notify: (services.find((s) => s.domain === 'notify')?.services ? Object.keys(services.find((s) => s.domain === 'notify').services) : []).filter((x) => x !== 'notify' && x !== 'send_message'),
      lights: of('light'), players: of('media_player'), tts: of('tts'), people: [...of('person'), ...of('device_tracker')] };
  }
  // Aviso desde MCP Hub (respeta los tipos elegidos; las reglas de silencio ya las aplicó el gestor de mensajería)
  forward(type, text, { subject } = {}) {
    const c = this.conf;
    if (!c.enabled || !c.types[type]) return;
    this.send(text, { title: subject || 'MCP Hub' }).catch((e) => { this.state.error = e.message; this.hooks.emit?.(); });
  }
  async send(text, { title = 'MCP Hub' } = {}) {
    const c = this.conf, done = [];
    const msg = String(text).slice(0, 1000);
    if (c.notifyService) { await this.api('POST', `/services/notify/${c.notifyService}`, { title, message: msg }); done.push('notificación'); }
    if (c.light.entity) { await this.api('POST', '/services/light/turn_on', { entity_id: c.light.entity, flash: 'short', rgb_color: c.light.color }); done.push('luz'); }
    if (c.tts.entity && c.tts.player) { await this.api('POST', '/services/tts/speak', { entity_id: c.tts.entity, media_player_entity_id: c.tts.player, message: msg.replace(/[^\p{L}\p{N}\s.,:;!?¿¡()'"-]/gu, ' ').slice(0, 300) }); done.push('voz'); }
    this.state.lastSent = { at: Date.now(), done }; this.state.error = null; this.hooks.emit?.();
    if (!done.length) throw new Error('No has elegido ningún destino (notificación, luz o altavoz)');
    return done;
  }
  async pollPresence() {
    const c = this.conf;
    if (!c.enabled || !c.presence.entity) return;
    try {
      const s = await this.api('GET', `/states/${c.presence.entity}`);
      const prev = this.state.lastPresence;
      this.state.lastPresence = s.state; this.state.error = null;
      // "home" = en casa; cualquier otra zona o "not_home" = fuera. Solo se actúa en los cambios.
      const away = s.state !== 'home' && s.state !== 'unknown' && s.state !== 'unavailable';
      if (prev !== s.state || away !== this.state.away) this.setAway(away && c.presence.pauseAway);
    } catch (e) { this.state.error = e.message; }
    this.hooks.emit?.();
  }
  setAway(on) {
    if (this.state.away === on) return;
    this.state.away = on;
    this.hooks.hold?.(on, on ? 'Has salido de casa (Home Assistant)' : null);
    this.hooks.log?.(on ? '🏠 Has salido de casa: los encargos nuevos esperan en la cola hasta que vuelvas.' : '🏠 Has vuelto a casa: se reanuda la cola de encargos.');
  }
}
