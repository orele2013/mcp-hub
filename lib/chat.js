// Chat unificado: una conversación con varios agentes. Escribes @claude, @codex, @gemini… y cada uno responde en el mismo hilo,
// viendo lo que se ha dicho antes. También modo debate: dos agentes discuten por turnos y un tercero hace de juez.
// Cada respuesta es un encargo (kind "chat" o "debate") de la cola normal, con los permisos que elijas (por defecto, solo lectura).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const AGENTS = ['claude', 'codex', 'gemini', 'opencode', 'cursor'];
const ALIASES = { claude: 'claude', codex: 'codex', gpt: 'codex', gemini: 'gemini', opencode: 'opencode', cursor: 'cursor' };
const clip = (s, n) => (s.length > n ? '…' + s.slice(-n) : s);
const id = () => crypto.randomBytes(4).toString('hex');

// Devuelve los agentes mencionados con @ (en orden, sin repetir); "@todos" menciona a todos los disponibles
export function mentions(text, available) {
  const out = [];
  for (const m of String(text).matchAll(/(^|[\s(,])@([a-záéíóú]+)/gi)) {
    const k = m[2].toLowerCase();
    if (k === 'todos' || k === 'all') { for (const a of available) if (!out.includes(a)) out.push(a); continue; }
    const a = ALIASES[k];
    if (a && available.includes(a) && !out.includes(a)) out.push(a);
  }
  return out;
}

export class Chats {
  // hooks: { createJob(opts) -> job, cancelJob(id), installed(id), agentName(id), emit() }
  constructor(confDir, hooks) {
    this.file = path.join(confDir, 'chats.json');
    this.hooks = hooks;
    try { this.threads = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { this.threads = []; }
    // Las respuestas que estaban en marcha al reiniciar se marcan como interrumpidas
    for (const t of this.threads) for (const m of t.messages) if (m.status === 'pending') { m.status = 'error'; m.text = 'MCP Hub se reinició antes de que respondiera.'; }
    for (const t of this.threads) if (t.debate?.state === 'running') t.debate.state = 'stopped';
    this.save();
  }
  save() {
    this.threads = this.threads.slice(-100);
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.threads), { mode: 0o600 });
    fs.renameSync(this.file + '.tmp', this.file);
    this.hooks.emit?.();
  }
  available() { return AGENTS.filter((a) => this.hooks.installed(a)); }
  list() { return this.threads.map(({ messages, ...t }) => ({ ...t, count: messages.length, last: messages.at(-1)?.text?.slice(0, 120) || '', busy: messages.some((m) => m.status === 'pending') })).reverse(); }
  get(tid) { const t = this.threads.find((x) => x.id === tid); if (!t) throw new Error('No existe esa conversación'); return t; }

  create({ title, cwd, permission = 'read', models = {}, mode = 'chat', debate }) {
    const dir = path.resolve(String(cwd || os.homedir()).replace(/^~(?=$|\/)/, os.homedir()));
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`La carpeta no existe: ${dir}`);
    if (!['read', 'edit', 'full'].includes(permission)) throw new Error('Permiso no válido');
    const t = { id: id(), title: String(title || '').trim().slice(0, 80) || (mode === 'debate' ? 'Debate' : 'Conversación'), cwd: dir, permission, mode,
      models: Object.fromEntries(Object.entries(models || {}).filter(([k, v]) => AGENTS.includes(k) && v).map(([k, v]) => [k, String(v).slice(0, 80)])),
      created: Date.now(), messages: [] };
    if (mode === 'debate') {
      const d = debate || {};
      for (const k of ['a', 'b', 'judge']) if (!this.hooks.installed(d[k])) throw new Error(`Elige agentes instalados para el debate (${k === 'judge' ? 'juez' : k.toUpperCase()})`);
      if (d.a === d.b && !(d.modelA && d.modelB && d.modelA !== d.modelB)) throw new Error('Los dos participantes deben ser agentes distintos (o el mismo con modelos distintos)');
      const topic = String(d.topic || '').trim();
      if (!topic) throw new Error('Escribe el tema del debate');
      t.debate = { topic: topic.slice(0, 4000), a: d.a, b: d.b, judge: d.judge, modelA: d.modelA || null, modelB: d.modelB || null, modelJudge: d.modelJudge || null,
        rounds: Math.max(1, Math.min(Number(d.rounds) || 2, 5)), turn: 0, state: 'running' };
      t.title = String(title || '').trim().slice(0, 80) || topic.slice(0, 60);
      t.messages.push({ id: id(), role: 'user', text: `Tema del debate: ${topic}`, at: Date.now() });
    }
    this.threads.push(t);
    this.save();
    if (t.debate) this.debateNext(t);
    return t;
  }
  remove(tid) {
    const t = this.get(tid);
    for (const m of t.messages) if (m.status === 'pending' && m.job) try { this.hooks.cancelJob(m.job); } catch {}
    this.threads = this.threads.filter((x) => x !== t); this.save();
  }
  settings(tid, { permission, models, title }) {
    const t = this.get(tid);
    if (permission !== undefined) { if (!['read', 'edit', 'full'].includes(permission)) throw new Error('Permiso no válido'); t.permission = permission; }
    if (models) t.models = Object.fromEntries(Object.entries(models).filter(([k, v]) => AGENTS.includes(k) && v).map(([k, v]) => [k, String(v).slice(0, 80)]));
    if (title) t.title = String(title).slice(0, 80);
    this.save(); return t;
  }

  transcript(t, upto = t.messages.length) {
    const lines = t.messages.slice(0, upto).filter((m) => m.status !== 'error' && m.status !== 'pending').slice(-40).map((m) =>
      m.role === 'user' ? `[Usuario]: ${m.text}` : m.role === 'system' ? `[Sistema]: ${m.text}` : `[${this.hooks.agentName(m.agent)}${m.model ? ` · ${m.model}` : ''}]: ${m.text}`);
    return clip(lines.join('\n\n'), 40_000);
  }

  // ---- Chat ----
  post(tid, text) {
    const t = this.get(tid);
    if (t.mode === 'debate') throw new Error('En un debate no se escriben mensajes; puedes pararlo o empezar otro');
    text = String(text || '').trim();
    if (!text) throw new Error('El mensaje está vacío');
    const avail = this.available();
    let who = mentions(text, avail);
    if (!who.length) {
      const last = [...t.messages].reverse().find((m) => m.role === 'agent')?.agent;
      who = [last && avail.includes(last) ? last : avail[0]].filter(Boolean);
    }
    if (!who.length) throw new Error('No hay ningún agente instalado');
    const msg = { id: id(), role: 'user', text: text.slice(0, 20000), at: Date.now(), to: who };
    t.messages.push(msg);
    const upto = t.messages.length;
    for (const a of who) this.ask(t, a, t.models[a] || null, upto, (name) => `Estás en una conversación de grupo entre el usuario y varios agentes de IA (${avail.map((x) => this.hooks.agentName(x)).join(', ')}). Tú eres ${name}.
Responde al último mensaje del usuario. Puedes estar de acuerdo o no con lo que digan los demás agentes; dilo con argumentos.
Sé directo y conciso (responde en el idioma del usuario). Si necesitas mirar archivos, la carpeta de trabajo es ${t.cwd}.${t.permission === 'read' ? ' No modifiques archivos.' : ''}

Conversación hasta ahora:
${this.transcript(t, upto)}`);
    this.save();
    return t;
  }
  ask(t, agent, model, upto, promptFor, extra = {}) {
    const name = this.hooks.agentName(agent);
    const m = { id: id(), role: 'agent', agent, model, text: '', at: Date.now(), status: 'pending', ...extra };
    t.messages.push(m);
    try {
      const j = this.hooks.createJob({ agent, model, cwd: t.cwd, task: promptFor(name), kind: t.mode === 'debate' ? 'debate' : 'chat', permission: t.mode === 'debate' ? 'read' : t.permission,
        isolation: 'none', from: `${t.mode === 'debate' ? 'Debate' : 'Chat'} · ${t.title}`.slice(0, 80), meta: { chat: t.id, msg: m.id } });
      m.job = j.id;
    } catch (e) { m.status = 'error'; m.text = e.message; }
    return m;
  }
  // Llamado cuando termina un encargo del chat
  jobFinished(j) {
    const t = this.threads.find((x) => x.id === j.meta?.chat);
    const m = t?.messages.find((x) => x.id === j.meta?.msg);
    if (!m) return;
    m.status = j.status === 'done' ? 'done' : 'error';
    m.text = j.result || (j.status === 'done' ? '(sin respuesta)' : `No respondió (${j.status}).`);
    m.usage = j.usage || null; m.duration = j.duration || null;
    this.save();
    if (t.debate && t.debate.state === 'running') {
      if (m.status !== 'done') { t.debate.state = 'error'; t.messages.push({ id: id(), role: 'system', text: `El debate se detuvo: ${this.hooks.agentName(m.agent)} no pudo responder.`, at: Date.now() }); this.save(); }
      else this.debateNext(t);
    }
  }

  // ---- Debate ----
  debateNext(t) {
    const d = t.debate;
    const total = d.rounds * 2;
    const upto = t.messages.length;
    const intro = (who, other) => `Estás en un debate técnico. Tema:\n${d.topic}\n\nTú eres ${who}; tu oponente es ${other}. Puedes consultar los archivos de ${t.cwd} para argumentar (no los modifiques).`;
    if (d.turn < total) {
      const first = d.turn % 2 === 0;
      const [agent, model] = first ? [d.a, d.modelA] : [d.b, d.modelB];
      const [oAgent, oModel] = first ? [d.b, d.modelB] : [d.a, d.modelA];
      const round = Math.floor(d.turn / 2) + 1;
      d.turn++;
      const label = (a, m) => `${this.hooks.agentName(a)}${m ? ` (${m})` : ''}`;
      this.ask(t, agent, model, upto, () => `${intro(label(agent, model), label(oAgent, oModel))}
Ronda ${round} de ${d.rounds}. ${d.turn === 1 ? 'Abre el debate: expón tu postura con tus mejores argumentos.' : 'Responde a los argumentos de tu oponente: rebate lo que creas incorrecto, concede lo que tenga razón y refuerza tu postura.'}
${round === d.rounds && !first ? 'Es tu último turno: cierra con tu conclusión.' : ''} Máximo unas 300 palabras.

Debate hasta ahora:
${this.transcript(t, upto)}`, { round, side: first ? 'a' : 'b' });
    } else if (d.turn === total) {
      d.turn++;
      this.ask(t, d.judge, d.modelJudge, upto, (name) => `Eres ${name}, juez imparcial de un debate técnico. Tema:\n${d.topic}\n
Lee el debate, comprueba en ${t.cwd} lo que haga falta (no modifiques nada) y decide:
- qué argumentos de cada parte son correctos y cuáles no,
- quién tiene más razón y por qué,
- y tu recomendación final concreta.
Termina con una línea exactamente así: GANADOR: ${this.hooks.agentName(d.a)}${d.modelA ? ` (${d.modelA})` : ''} | ${this.hooks.agentName(d.b)}${d.modelB ? ` (${d.modelB})` : ''} | EMPATE

Debate:
${this.transcript(t, upto)}`, { side: 'judge' });
    } else {
      d.state = 'done';
      const verdict = [...String(t.messages.at(-1)?.text || '').matchAll(/GANADOR:\s*\**\s*([^\n*]+)/gi)].pop();
      d.winner = verdict ? verdict[1].trim().slice(0, 80) : null;
    }
    this.save();
  }
  stopDebate(tid) {
    const t = this.get(tid);
    if (!t.debate || t.debate.state !== 'running') return t;
    t.debate.state = 'stopped';
    for (const m of t.messages) if (m.status === 'pending' && m.job) try { this.hooks.cancelJob(m.job); } catch {}
    this.save(); return t;
  }
}
