// Mensajería: Telegram, email, Discord y Slack en las dos direcciones.
// Los agentes te avisan o te preguntan (vía messaging-mcp.js) y tú respondes o controlas las sesiones desde el móvil.
// Solo se aceptan mensajes del chat/usuario/dirección configurados: escribir en una sesión equivale a teclear en ella.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export const CHANNEL_IDS = ['telegram', 'email', 'discord', 'slack'];
const NAMES = { telegram: 'Telegram', email: 'Email', discord: 'Discord', slack: 'Slack' };
// Campos secretos: se enmascaran al mandarlos a la interfaz
const SECRET_FIELDS = { telegram: ['token'], email: ['password'], discord: ['token'], slack: ['token'] };
const LIMITS = { telegram: 4000, discord: 1900, slack: 3900, email: 100000 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const newId = () => crypto.randomBytes(3).toString('hex');

function chunks(text, n) {
  const out = [];
  for (let s = String(text); s.length; s = s.slice(n)) out.push(s.slice(0, n));
  return out.length ? out : [''];
}

// Quita el texto citado de una respuesta de email
function stripQuoted(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const out = [];
  for (const l of lines) {
    if (/^(On|El)\s.+(wrote|escribió):\s*$/i.test(l) || /^-{2,}\s*(Original Message|Mensaje original)/i.test(l) || /^>/.test(l)) break;
    out.push(l);
  }
  return out.join('\n').trim();
}

// ---------------- Canales ----------------
const telegram = {
  api: async (c, method, body, timeout = 20000) => {
    const r = await fetch(`https://api.telegram.org/bot${c.token}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(timeout),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(`Telegram: ${j.description || r.status}`);
    return j.result;
  },
  check: (c) => { if (!c.token) throw new Error('Falta el token del bot'); if (!c.chatId) throw new Error('Falta tu chat (pulsa "Detectar")'); },
  async send(c, text, opt = {}) {
    let first;
    for (const part of chunks(text, LIMITS.telegram)) {
      const m = await this.api(c, 'sendMessage', { chat_id: c.chatId, text: part, ...(opt.replyTo ? { reply_parameters: { message_id: Number(opt.replyTo), allow_sending_without_reply: true } } : {}) });
      first ??= String(m.message_id);
    }
    return first;
  },
  async poll(c, state, onMessage, alive) {
    if (state.offset == null) {
      const last = await this.api(c, 'getUpdates', { offset: -1, timeout: 0 });
      state.offset = last.length ? last[last.length - 1].update_id + 1 : 0;
    }
    while (alive()) {
      const ups = await this.api(c, 'getUpdates', { offset: state.offset, timeout: 25, allowed_updates: ['message'] }, 35000);
      for (const u of ups) {
        state.offset = u.update_id + 1;
        const m = u.message;
        if (!m || String(m.chat.id) !== String(c.chatId) || !m.text) continue;
        await onMessage({ text: m.text, extId: String(m.message_id), replyTo: m.reply_to_message ? String(m.reply_to_message.message_id) : null,
          from: m.from?.username || m.from?.first_name || 'tú' });
      }
    }
  },
  // Busca el último chat que escribió al bot (tras mandarle /start)
  async detect(c) {
    const ups = await this.api(c, 'getUpdates', { timeout: 0 });
    const chats = ups.map((u) => u.message?.chat).filter(Boolean);
    if (!chats.length) throw new Error('No hay mensajes. Abre tu bot en Telegram, pulsa Iniciar (o envía /start) y vuelve a intentarlo.');
    const ch = chats[chats.length - 1];
    return { chatId: String(ch.id), name: ch.username ? '@' + ch.username : [ch.first_name, ch.last_name].filter(Boolean).join(' ') || ch.title };
  },
};

const email = {
  check: (c) => {
    for (const [k, l] of [['address', 'tu cuenta'], ['password', 'la contraseña de aplicación'], ['smtpHost', 'el servidor SMTP'], ['imapHost', 'el servidor IMAP'], ['to', 'la dirección a la que avisar']]) {
      if (!c[k]) throw new Error(`Falta ${l}`);
    }
  },
  transport: (c) => nodemailer.createTransport({ host: c.smtpHost, port: Number(c.smtpPort) || 465, secure: Number(c.smtpPort || 465) === 465,
    auth: { user: c.address, pass: c.password } }),
  async send(c, text, opt = {}) {
    const info = await this.transport(c).sendMail({
      from: `MCP Hub <${c.address}>`, to: c.to, subject: `[MCP Hub] ${opt.subject || 'Aviso'}`, text,
      ...(opt.replyTo ? { inReplyTo: opt.replyTo, references: opt.replyTo } : {}),
    });
    return info.messageId;
  },
  async poll(c, state, onMessage, alive) {
    while (alive()) {
      const client = new ImapFlow({ host: c.imapHost, port: Number(c.imapPort) || 993, secure: true, auth: { user: c.address, pass: c.password }, logger: false });
      await client.connect();
      try {
        const lock = await client.getMailboxLock('INBOX');
        try {
          state.since ??= new Date().toISOString();
          const uids = await client.search({ seen: false, from: c.to, since: new Date(state.since) }, { uid: true });
          for (const uid of uids || []) {
            const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
            await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
            const p = await simpleParser(msg.source);
            if (!p.from?.value?.some((a) => a.address?.toLowerCase() === c.to.toLowerCase())) continue;
            const text = stripQuoted(p.text || '');
            if (!text) continue;
            await onMessage({ text, extId: p.messageId, replyTo: p.inReplyTo || null, from: c.to, subject: p.subject });
          }
        } finally { lock.release(); }
      } finally { await client.logout().catch(() => {}); }
      for (let i = 0; i < 30 && alive(); i++) await sleep(1000);
    }
  },
  async test(c) { await this.transport(c).verify(); },
};

const discord = {
  api: async (c, method, p, body) => {
    const r = await fetch(`https://discord.com/api/v10${p}`, { method, headers: { authorization: `Bot ${c.token}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Discord: ${j.message || r.status}`);
    return j;
  },
  check: (c) => { if (!c.token) throw new Error('Falta el token del bot'); if (!/^\d{5,}$/.test(c.userId || '')) throw new Error('Falta tu ID de usuario de Discord'); },
  async dm(c, state) {
    state.dm ??= (await this.api(c, 'POST', '/users/@me/channels', { recipient_id: c.userId })).id;
    return state.dm;
  },
  async send(c, text, opt = {}, state = {}) {
    const ch = await this.dm(c, state);
    let first;
    for (const part of chunks(text, LIMITS.discord)) {
      const m = await this.api(c, 'POST', `/channels/${ch}/messages`, { content: part, ...(opt.replyTo ? { message_reference: { message_id: opt.replyTo, fail_if_not_exists: false } } : {}) });
      first ??= m.id;
    }
    return first;
  },
  async poll(c, state, onMessage, alive) {
    const ch = await this.dm(c, state);
    if (!state.lastId) state.lastId = (await this.api(c, 'GET', `/channels/${ch}/messages?limit=1`))[0]?.id || '0';
    while (alive()) {
      const list = await this.api(c, 'GET', `/channels/${ch}/messages?after=${state.lastId}&limit=50`);
      for (const m of list.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))) {
        state.lastId = m.id;
        if (m.author?.id !== c.userId || !m.content) continue;
        await onMessage({ text: m.content, extId: m.id, replyTo: m.message_reference?.message_id || null, from: m.author.username });
      }
      for (let i = 0; i < 4 && alive(); i++) await sleep(1000);
    }
  },
};

const slack = {
  api: async (c, method, body) => {
    const r = await fetch(`https://slack.com/api/${method}`, { method: 'POST', headers: { authorization: `Bearer ${c.token}`, 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body || {}), signal: AbortSignal.timeout(20000) });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(`Slack: ${j.error || r.status}`);
    return j;
  },
  check: (c) => { if (!/^xoxb-/.test(c.token || '')) throw new Error('Falta el Bot token (empieza por xoxb-)'); if (!/^[UW][A-Z0-9]+$/.test(c.userId || '')) throw new Error('Falta tu ID de miembro de Slack (U…)'); },
  async dm(c, state) {
    state.dm ??= (await this.api(c, 'conversations.open', { users: c.userId })).channel.id;
    return state.dm;
  },
  async send(c, text, opt = {}, state = {}) {
    const ch = await this.dm(c, state);
    let first;
    for (const part of chunks(text, LIMITS.slack)) first ??= (await this.api(c, 'chat.postMessage', { channel: ch, text: part })).ts;
    return first;
  },
  async poll(c, state, onMessage, alive) {
    const ch = await this.dm(c, state);
    state.lastTs ??= String(Date.now() / 1000);
    while (alive()) {
      const r = await this.api(c, 'conversations.history', { channel: ch, oldest: state.lastTs, limit: 50 });
      for (const m of (r.messages || []).sort((a, b) => Number(a.ts) - Number(b.ts))) {
        state.lastTs = m.ts;
        if (m.user !== c.userId || !m.text || m.subtype) continue;
        await onMessage({ text: m.text, extId: m.ts, replyTo: m.thread_ts && m.thread_ts !== m.ts ? m.thread_ts : null, from: 'tú' });
      }
      for (let i = 0; i < 5 && alive(); i++) await sleep(1000);
    }
  },
};

const ADAPTERS = { telegram, email, discord, slack };

// ---------------- Gestor ----------------
export class Messenger {
  // hooks: { sessions() -> [{id,title,exited}], write(id, text), screen(id) -> Promise<string>, changed() }
  constructor(confDir, getConfig, saveConfig, hooks) {
    this.file = path.join(confDir, 'messages.json');
    this.getConfig = getConfig; this.saveConfig = saveConfig; this.hooks = hooks;
    let d = {}; try { d = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch {}
    this.log = d.log || []; this.questions = d.questions || {}; this.inbox = d.inbox || []; this.extMap = d.extMap || {};
    this.status = {}; this.runs = {}; this.waiters = new Map();
  }
  get config() {
    const c = this.getConfig();
    c.channels ||= {}; for (const id of CHANNEL_IDS) c.channels[id] ||= { enabled: false };
    c.primary ||= 'telegram'; c.notifyExit ??= true;
    c.rules ||= {};
    c.rules.types = { sessions: c.notifyExit, jobs: true, approvals: true, schedules: true, design: true, security: true, monitors: true, shadow: true, ...(c.rules.types || {}) };
    c.rules.quiet ||= { enabled: false, from: '23:00', to: '08:00' };
    c.rules.urgentInQuiet ??= true;
    return c;
  }
  persist() {
    this.log = this.log.slice(-300); this.inbox = this.inbox.slice(-100);
    const keep = Object.entries(this.questions).sort((a, b) => b[1].at - a[1].at).slice(0, 100);
    this.questions = Object.fromEntries(keep);
    this.extMap = Object.fromEntries(Object.entries(this.extMap).slice(-400));
    fs.writeFileSync(this.file + '.tmp', JSON.stringify({ log: this.log, questions: this.questions, inbox: this.inbox, extMap: this.extMap }), { mode: 0o600 });
    fs.renameSync(this.file + '.tmp', this.file);
    this.hooks.changed?.();
  }
  record(e) { this.log.push({ at: Date.now(), ...e }); this.persist(); }

  // Configuración tal cual la ve la interfaz (secretos enmascarados)
  publicConfig() {
    const c = this.config;
    const channels = Object.fromEntries(CHANNEL_IDS.map((id) => {
      const ch = { ...c.channels[id] }; delete ch.state;
      for (const f of SECRET_FIELDS[id]) if (ch[f]) ch[f] = '••••' + String(ch[f]).slice(-4);
      return [id, { ...ch, status: this.status[id] || (ch.enabled ? { state: 'starting' } : { state: 'off' }) }];
    }));
    return { channels, primary: c.primary, notifyExit: c.notifyExit, target: c.target || null, rules: c.rules, quietNow: this.isQuiet() };
  }
  setChannel(id, patch) {
    if (!CHANNEL_IDS.includes(id)) throw new Error('Canal desconocido');
    const c = this.config, cur = c.channels[id];
    const next = { ...cur };
    for (const [k, v] of Object.entries(patch || {})) {
      if (k === 'state' || k === 'status') continue;
      if (SECRET_FIELDS[id].includes(k) && (v === undefined || String(v).startsWith('••••'))) continue;
      next[k] = typeof v === 'string' ? v.trim() : v;
    }
    // Si cambian las credenciales, se empieza de cero (sin repetir mensajes antiguos)
    if (['token', 'chatId', 'userId', 'address', 'to', 'imapHost'].some((k) => next[k] !== cur[k])) delete next.state;
    if (next.enabled) ADAPTERS[id].check(next);
    c.channels[id] = next;
    if (next.enabled && !c.channels[c.primary]?.enabled) c.primary = id;
    this.saveConfig();
    this.restart(id);
  }
  // ¿Estamos en horas de silencio? (admite rangos que cruzan la medianoche)
  isQuiet(now = new Date()) {
    const q = this.config.rules.quiet;
    if (!q.enabled) return false;
    const mins = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
    const n = now.getHours() * 60 + now.getMinutes(), a = mins(q.from), b = mins(q.to);
    return a <= b ? n >= a && n < b : n >= a || n < b;
  }
  // Aviso con reglas: tipos activados, horas de silencio y urgentes. Devuelve si se envió.
  notify(type, text, { subject, urgent = false } = {}) {
    const c = this.config;
    if (c.rules.types[type] === false) return false;
    if (this.isQuiet() && !(urgent && c.rules.urgentInQuiet)) { this.record({ dir: 'out', channel: '-', from: 'MCP Hub (silenciado)', text: `[${type}] ${text}` }); return false; }
    // Otros destinos de avisos (Home Assistant), con las mismas reglas
    try { this.hooks.forward?.(type, text, { subject, urgent }); } catch {}
    if (!CHANNEL_IDS.some((x) => c.channels[x].enabled)) return false;
    this.send(text, { subject }).catch(() => {});
    return true;
  }
  setRules(r = {}) {
    const c = this.config;
    if (r.types) for (const [k, v] of Object.entries(r.types)) if (k in c.rules.types) c.rules.types[k] = !!v;
    if (r.quiet) {
      const ok = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '');
      if ((r.quiet.from && !ok(r.quiet.from)) || (r.quiet.to && !ok(r.quiet.to))) throw new Error('Hora no válida (HH:MM)');
      c.rules.quiet = { ...c.rules.quiet, ...r.quiet, enabled: !!(r.quiet.enabled ?? c.rules.quiet.enabled) };
    }
    if (r.urgentInQuiet !== undefined) c.rules.urgentInQuiet = !!r.urgentInQuiet;
    c.notifyExit = c.rules.types.sessions;
    this.saveConfig(); this.hooks.changed?.();
  }
  setSettings({ primary, notifyExit }) {
    const c = this.config;
    if (primary !== undefined) { if (!CHANNEL_IDS.includes(primary)) throw new Error('Canal desconocido'); c.primary = primary; }
    if (notifyExit !== undefined) { c.notifyExit = !!notifyExit; c.rules.types.sessions = !!notifyExit; }
    this.saveConfig(); this.hooks.changed?.();
  }

  start() { for (const id of CHANNEL_IDS) this.restart(id); }
  restart(id) {
    const run = { alive: true };
    if (this.runs[id]) this.runs[id].alive = false;
    this.runs[id] = run;
    const ch = this.config.channels[id];
    if (!ch.enabled) { this.status[id] = { state: 'off' }; this.hooks.changed?.(); return; }
    this.status[id] = { state: 'starting' };
    (async () => {
      let delay = 5000;
      while (run.alive) {
        try {
          ch.state ||= {};
          this.status[id] = { state: 'on', since: Date.now() }; this.hooks.changed?.();
          await ADAPTERS[id].poll(ch, ch.state, (m) => this.incoming(id, m).finally(() => this.saveConfig()), () => run.alive);
        } catch (e) {
          if (!run.alive) break;
          this.status[id] = { state: 'error', error: e.message, at: Date.now() }; this.hooks.changed?.();
          await sleep(delay); delay = Math.min(delay * 2, 120000);
          continue;
        }
        delay = 5000;
      }
    })();
  }

  channelFor(pref) {
    const c = this.config;
    const id = pref && c.channels[pref]?.enabled ? pref : c.channels[c.primary]?.enabled ? c.primary : CHANNEL_IDS.find((x) => c.channels[x].enabled);
    if (!id) throw new Error('No hay ningún canal de mensajería activo. Configúralo en MCP Hub → Mensajería.');
    return id;
  }
  async send(text, { channel, subject, replyTo, from = 'MCP Hub', question } = {}) {
    const id = this.channelFor(channel);
    const ch = this.config.channels[id];
    ch.state ||= {};
    const extId = await ADAPTERS[id].send(ch, text, { subject, replyTo }, ch.state);
    if (extId) this.extMap[`${id}:${extId}`] = question || '';
    this.record({ dir: 'out', channel: id, from, text });
    this.saveConfig();
    return { channel: id, extId };
  }
  async test(id) {
    const ch = { ...this.config.channels[id] };
    ADAPTERS[id].check(ch);
    if (id === 'email') await email.test(ch);
    ch.state = this.config.channels[id].state ||= {};
    await ADAPTERS[id].send(ch, '✅ MCP Hub conectado. Escribe /ayuda para ver lo que puedes hacer desde aquí.', { subject: 'Prueba' }, ch.state);
    this.record({ dir: 'out', channel: id, from: 'MCP Hub', text: 'Mensaje de prueba' });
  }
  async detectTelegram(token) {
    const cur = this.config.channels.telegram;
    const real = !token || String(token).startsWith('••••') ? cur.token : token;
    if (!real) throw new Error('Falta el token del bot');
    const wasOn = this.runs.telegram?.alive; if (this.runs.telegram) this.runs.telegram.alive = false;
    try { return await telegram.detect({ token: real }); } finally { if (wasOn) this.restart('telegram'); }
  }

  // ---- Preguntas de los agentes ----
  async ask(question, meta = {}) {
    const id = newId();
    const label = meta.label || 'Un agente';
    const q = { id, question, label, session: meta.session || null, at: Date.now(), answer: null };
    this.questions[id] = q;
    const subject = `Pregunta #${id} · ${label}`;
    const r = await this.send(`❓ ${label} pregunta (#${id}):\n\n${question}\n\n↩️ Responde a este mensaje.`, { channel: meta.channel, subject, from: label, question: id });
    q.channel = r.channel;
    this.persist();
    return id;
  }
  answer(id, text, channel) {
    const q = this.questions[id];
    if (!q || q.answer != null) return false;
    q.answer = text; q.answeredAt = Date.now(); q.answeredVia = channel;
    this.persist();
    for (const w of this.waiters.get(id) || []) w(text);
    this.waiters.delete(id);
    return true;
  }
  async waitAnswer(id, seconds) {
    const q = this.questions[id];
    if (!q) throw new Error(`No existe la pregunta #${id}`);
    if (q.answer != null) return q.answer;
    return new Promise((resolve) => {
      const done = (v) => { clearTimeout(t); resolve(v); };
      const t = setTimeout(() => { const l = this.waiters.get(id) || []; this.waiters.set(id, l.filter((x) => x !== done)); resolve(null); }, Math.min(Math.max(seconds, 1), 55) * 1000);
      this.waiters.set(id, [...(this.waiters.get(id) || []), done]);
    });
  }
  pending() { return Object.values(this.questions).filter((q) => q.answer == null).sort((a, b) => a.at - b.at); }
  readInbox() { const items = this.inbox.filter((m) => !m.read); for (const m of items) m.read = true; if (items.length) this.persist(); return items; }

  // ---- Mensajes entrantes ----
  async incoming(channel, m) {
    const text = String(m.text || '').trim();
    this.record({ dir: 'in', channel, from: m.from || 'tú', text });
    const reply = (t) => this.send(t, { channel, replyTo: m.extId, subject: m.subject?.replace(/^(Re:\s*)+/i, '').replace(/^\[MCP Hub\]\s*/, '') || 'Respuesta' }).catch(() => {});

    // 1) Respuesta a una pregunta: por "responder a", por #id o si solo hay una pendiente
    const byReply = m.replyTo ? this.extMap[`${channel}:${m.replyTo}`] : null;
    const tag = /#([0-9a-f]{6})\b/.exec(text)?.[1] || /#([0-9a-f]{6})\b/.exec(m.subject || '')?.[1];
    const pend = this.pending();
    const qid = (byReply && this.questions[byReply]?.answer == null && byReply)
      || (tag && this.questions[tag]?.answer == null && tag)
      || (!text.startsWith('/') && pend.length === 1 ? pend[0].id : null);
    if (qid) {
      this.answer(qid, text.replace(/#[0-9a-f]{6}\b/, '').trim(), channel);
      return reply(`👍 Respuesta enviada a ${this.questions[qid].label} (#${qid}).`);
    }

    // 2) Comandos
    const sessions = this.hooks.sessions().filter((s) => !s.exited);
    const pick = (arg) => {
      if (!arg) return sessions.find((s) => s.id === this.config.target) || (sessions.length === 1 ? sessions[0] : null);
      const n = Number(arg);
      return Number.isInteger(n) && n >= 1 ? sessions[n - 1] : sessions.find((s) => s.id.startsWith(arg));
    };
    const [cmd, ...rest] = text.split(/\s+/);
    const arg = rest.join(' ');
    switch (cmd.toLowerCase()) {
      case '/start': case '/ayuda': case '/help':
        return reply(['MCP Hub — lo que puedes hacer desde aquí:', '',
          '/sesiones — lista las sesiones abiertas',
          '/ver [n] — muestra la pantalla de una sesión',
          '/usar n — tus mensajes irán a esa sesión',
          '/s n texto — escribe un texto en la sesión n una vez',
          '/preguntas — preguntas de agentes sin responder',
          '/encargos — encargos activos y aprobaciones pendientes',
          '/aprobar id · /denegar id — decide una aprobación de un encargo',
          '/soltar — deja de enviar tus mensajes a una sesión', '',
          'Para responder a un agente, responde a su pregunta (o escribe #id y tu respuesta).',
          'Cualquier otro texto va a la sesión elegida con /usar, o a la bandeja que leen los agentes.'].join('\n'));
      case '/sesiones': case '/sessions':
        if (!sessions.length) return reply('No hay sesiones abiertas en MCP Hub.');
        return reply(sessions.map((s, i) => `${i + 1}. ${s.title}${s.id === this.config.target ? '  ← tus mensajes van aquí' : ''}`).join('\n'));
      case '/ver': case '/screen': {
        const s = pick(rest[0]);
        if (!s) return reply(sessions.length ? 'Indica cuál: /ver n (mira /sesiones).' : 'No hay sesiones abiertas.');
        return reply(`🖥 ${s.title}\n\n${(await this.hooks.screen(s.id)) || '(pantalla vacía)'}`);
      }
      case '/usar': case '/use': {
        const s = pick(rest[0] || '-');
        if (!s) return reply('No encuentro esa sesión. Mira /sesiones.');
        this.config.target = s.id; this.saveConfig(); this.hooks.changed?.();
        return reply(`➡️ Tus mensajes irán a: ${s.title}`);
      }
      case '/soltar': this.config.target = null; this.saveConfig(); this.hooks.changed?.(); return reply('Listo: tus mensajes irán a la bandeja de los agentes.');
      case '/aprobar': case '/denegar': {
        const J = this.hooks.jobs;
        if (!J) return reply('Los encargos no están disponibles.');
        const pendingA = J.pending();
        const a = rest[0] ? pendingA.find((x) => x.id === rest[0]) : pendingA.length === 1 ? pendingA[0] : null;
        if (!a) return reply(pendingA.length ? `Indica cuál: ${pendingA.map((x) => `${cmd} ${x.id} (${x.tool})`).join(', ')}` : 'No hay aprobaciones pendientes.');
        J.decide(a.id, cmd === '/aprobar', rest.slice(1).join(' '));
        return reply(`${cmd === '/aprobar' ? '✅ Aprobado' : '⛔ Denegado'}: ${a.tool} (encargo ${a.job}).`);
      }
      case '/encargos': {
        const J = this.hooks.jobs;
        const list = J ? J.list() : [];
        const pa = J ? J.pending() : [];
        return reply([list.length ? list.map((j) => `${j.id} · ${j.agentName} · ${j.statusLabel} · ${j.task.slice(0, 60)}`).join('\n') : 'No hay encargos activos.',
          pa.length ? `\nAprobaciones pendientes:\n${pa.map((a) => `${a.id} · ${a.tool}: ${String(a.input).slice(0, 120)}`).join('\n')}\nResponde /aprobar id o /denegar id.` : ''].join('\n'));
      }
      case '/preguntas': return reply(pend.length ? pend.map((q) => `#${q.id} · ${q.label}: ${q.question.slice(0, 200)}`).join('\n\n') : 'No hay preguntas pendientes.');
      case '/s': {
        const s = pick(rest[0]);
        const body = rest.slice(1).join(' ');
        if (!s || !body) return reply('Uso: /s n texto');
        this.hooks.write(s.id, body);
        return reply(`⌨️ Enviado a ${s.title}`);
      }
    }
    if (text.startsWith('/')) return reply('No conozco ese comando. Escribe /ayuda.');

    // 3) Texto libre: a la sesión elegida o a la bandeja
    const target = sessions.find((s) => s.id === this.config.target);
    if (target) { this.hooks.write(target.id, text); return reply(`⌨️ Enviado a ${target.title}`); }
    if (pend.length > 1) return reply(`Hay ${pend.length} preguntas pendientes. Responde a la que quieras o empieza con su #id:\n\n${pend.map((q) => `#${q.id} · ${q.label}`).join('\n')}`);
    this.inbox.push({ id: newId(), at: Date.now(), channel, text, read: false });
    this.persist();
    return reply('📥 Guardado en la bandeja: los agentes lo verán con read_messages. Para hablar con una sesión usa /usar n (mira /sesiones).');
  }

  sessionExited(s) {
    const c = this.config;
    if (c.target === s.id) { c.target = null; this.saveConfig(); }
    this.notify('sessions', `${s.exitCode === 0 ? '✅' : '⚠️'} Terminó la sesión ${s.title} (código ${s.exitCode}).`, { subject: `Sesión terminada · ${s.title}` });
  }
}
