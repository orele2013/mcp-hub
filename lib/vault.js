// Bóveda cifrada: API keys, contraseñas, cuentas y bases de datos.
// Se cifra entera con AES-256-GCM; la clave sale de la contraseña maestra (scrypt).
// La clave solo vive en memoria mientras la bóveda está desbloqueada, salvo que el
// usuario elija "desbloquear automáticamente en este equipo" (vault.key, permisos 600).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class Vault {
  constructor(dir) {
    this.file = path.join(dir, 'vault.json');
    this.keyFile = path.join(dir, 'vault.key');
    this.key = null;
    this.items = null;
    this.log = [];
    try {
      const k = Buffer.from(fs.readFileSync(this.keyFile, 'utf8').trim(), 'hex');
      if (k.length === 32 && this.exists()) this.open(k);
    } catch {}
  }

  exists() { return fs.existsSync(this.file); }
  get unlocked() { return !!this.key; }
  get remembered() { return fs.existsSync(this.keyFile); }

  #derive(password, salt) { return crypto.scryptSync(password, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }); }
  #encrypt(obj) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([c.update(JSON.stringify(obj)), c.final()]);
    return { iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') };
  }
  #decrypt(key, box) {
    const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(box.iv, 'base64'));
    d.setAuthTag(Buffer.from(box.tag, 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(box.data, 'base64')), d.final()]).toString());
  }
  #persist() {
    const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    raw.box = this.#encrypt({ items: this.items, log: this.log.slice(-200) });
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(raw), { mode: 0o600 });
    fs.renameSync(this.file + '.tmp', this.file);
  }
  #remember(on) {
    if (on) fs.writeFileSync(this.keyFile, this.key.toString('hex'), { mode: 0o600 });
    else fs.rmSync(this.keyFile, { force: true });
  }

  open(key) {
    const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    const content = this.#decrypt(key, raw.box); // lanza si la clave es incorrecta
    this.key = key; this.items = content.items || {}; this.log = content.log || [];
  }
  setup(password, remember) {
    if (this.exists()) throw new Error('La bóveda ya existe');
    if (!password || password.length < 8) throw new Error('La contraseña maestra debe tener al menos 8 caracteres');
    const salt = crypto.randomBytes(16);
    this.key = this.#derive(password, salt);
    this.items = {}; this.log = [];
    fs.writeFileSync(this.file, JSON.stringify({ v: 1, kdf: 'scrypt', salt: salt.toString('base64'), box: this.#encrypt({ items: {}, log: [] }) }), { mode: 0o600 });
    this.#remember(remember);
  }
  unlock(password, remember) {
    const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    const key = this.#derive(password, Buffer.from(raw.salt, 'base64'));
    try { this.open(key); } catch { throw new Error('Contraseña maestra incorrecta'); }
    this.#remember(remember);
  }
  lock() { this.key = null; this.items = null; this.#remember(false); }
  #need() { if (!this.key) throw new Error('La bóveda está bloqueada. Desbloquéala en MCP Hub.'); }

  // Lista sin secretos
  list() {
    this.#need();
    return Object.entries(this.items).map(([id, it]) => {
      const { secret, ...rest } = it;
      return { id, ...rest, hasSecret: !!secret, secretHint: secret ? '••••' + String(secret).slice(-3) : '' };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }
  get(id) { this.#need(); const it = this.items[id]; if (!it) throw new Error('No existe'); return { id, ...it }; }
  save(id, item) {
    this.#need();
    const prev = id && this.items[id];
    const newId = id || crypto.randomUUID().slice(0, 8);
    const secret = item.secret === undefined ? prev?.secret : item.secret;
    this.items[newId] = {
      name: String(item.name || '').trim() || 'Sin nombre', type: item.type || 'apikey', service: item.service || '',
      url: item.url || '', username: item.username || '', secret: secret || '', envVar: (item.envVar || '').trim(),
      host: item.host || '', port: item.port || '', database: item.database || '', notes: item.notes || '',
      agentAccess: !!item.agentAccess, updated: Date.now(), created: prev?.created || Date.now(),
    };
    this.#persist();
    return newId;
  }
  remove(id) { this.#need(); delete this.items[id]; this.#persist(); }
  record(entry) {
    if (!this.key) return;
    this.log.push({ at: Date.now(), ...entry });
    this.#persist();
  }
  changePassword(oldPw, newPw) {
    this.#need();
    const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    if (!this.#derive(oldPw, Buffer.from(raw.salt, 'base64')).equals(this.key)) throw new Error('Contraseña actual incorrecta');
    if (!newPw || newPw.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
    const salt = crypto.randomBytes(16);
    this.key = this.#derive(newPw, salt);
    raw.salt = salt.toString('base64');
    fs.writeFileSync(this.file, JSON.stringify(raw), { mode: 0o600 });
    this.#persist();
    if (this.remembered) this.#remember(true);
  }
}

// Cadena de conexión para las bases de datos
export function connectionString(it) {
  if (it.type !== 'database') return undefined;
  const scheme = (it.service || 'postgresql').toLowerCase().replace(/\s+/g, '');
  const auth = it.username ? `${encodeURIComponent(it.username)}${it.secret ? ':' + encodeURIComponent(it.secret) : ''}@` : '';
  return `${scheme}://${auth}${it.host || 'localhost'}${it.port ? ':' + it.port : ''}${it.database ? '/' + it.database : ''}`;
}
