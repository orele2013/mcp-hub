// Configuración de sesiones reutilizable por proyecto. Solo guarda referencias de
// credenciales de la bóveda; nunca copia sus secretos.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class ProjectProfiles {
  constructor(confDir) {
    this.file = path.join(confDir, 'project-profiles.json');
    this.profiles = [];
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const records = Array.isArray(data) ? data : (data && Array.isArray(data.profiles) ? data.profiles : null);
      if (!records || records.length > 100 || records.some((p) => !p || typeof p !== 'object' || Array.isArray(p) || !/^[a-f0-9]{16}$/.test(p.id || ''))) {
        this.loadError = 'El archivo de perfiles de proyecto tiene un formato no válido';
      } else this.profiles = records;
    } catch (e) {
      if (e.code !== 'ENOENT') this.loadError = `No se pudieron leer los perfiles de proyecto: ${e.message}`;
    }
  }

  list() {
    return this.profiles.map((p) => ({
      id: p.id, name: p.name, cwd: p.cwd, client: p.client, account: p.account, model: p.model,
      mode: p.mode, mcps: Array.isArray(p.mcps) ? [...p.mcps] : [], skills: Array.isArray(p.skills) ? [...p.skills] : [],
      instructions: p.instructions, secrets: Array.isArray(p.secrets) ? [...p.secrets] : [], created: p.created, updated: p.updated,
    }));
  }
  get(id) { return this.list().find((p) => p.id === id) || null; }

  save(profile) {
    if (this.loadError) throw new Error(`${this.loadError}. No se guardarán cambios para proteger el archivo existente.`);
    const prev = profile.id ? this.get(profile.id) : null;
    const id = prev?.id || crypto.randomBytes(8).toString('hex');
    const now = Date.now();
    const saved = { ...profile, id, created: prev?.created || now, updated: now };
    const next = this.profiles.filter((p) => p.id !== id);
    if (!prev && next.length >= 100) throw new Error('Has llegado al máximo de 100 perfiles de proyecto');
    next.push(saved);
    this.#persist(next);
    this.profiles = next;
    return { ...saved };
  }

  remove(id) {
    if (this.loadError) throw new Error(`${this.loadError}. No se guardarán cambios para proteger el archivo existente.`);
    const next = this.profiles.filter((p) => p.id !== id);
    if (next.length === this.profiles.length) throw new Error('No existe ese perfil de proyecto');
    this.#persist(next);
    this.profiles = next;
  }

  #persist(profiles) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, profiles }, null, 2), { mode: 0o600 });
    fs.chmodSync(tmp, 0o600);
    fs.renameSync(tmp, this.file);
    try { fs.chmodSync(this.file, 0o600); } catch {}
  }
}
