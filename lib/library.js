// Biblioteca de encargos: roles reutilizables (agente, modelo, permisos, aislamiento, límites e instrucciones)
// y plantillas de encargos con campos {{editables}}. Se guarda en ~/.config/mcp-hub/library.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BUILTIN_ROLES = [
  { id: 'revisor', name: 'Revisor de código', desc: 'Revisa sin tocar nada y devuelve hallazgos por gravedad.', permission: 'read', isolation: 'none',
    instructions: 'Actúa como revisor de código senior. NO modifiques archivos. Revisa con atención la corrección, los casos límite, la seguridad, el rendimiento y la claridad. Devuelve los hallazgos ordenados por gravedad, cada uno con archivo:línea, qué pasa, por qué importa y una propuesta concreta. Si no encuentras problemas, dilo explícitamente.' },
  { id: 'investigador', name: 'Investigador', desc: 'Investiga y responde con fuentes; no edita.', permission: 'read', isolation: 'none',
    instructions: 'Actúa como investigador. No modifiques archivos. Busca información fiable (documentación oficial, código del proyecto, fuentes primarias), contrasta y responde de forma concisa con las fuentes citadas (URL o archivo:línea). Distingue lo que has comprobado de lo que supones.' },
  { id: 'implementador', name: 'Implementador', desc: 'Implementa en un entorno aislado; tú revisas el diff.', permission: 'edit', isolation: 'worktree',
    instructions: 'Actúa como ingeniero que implementa la tarea de principio a fin, siguiendo las convenciones del proyecto. Mantén el cambio mínimo y enfocado. Al terminar, resume qué archivos cambiaste y por qué, y qué no has podido comprobar.' },
  { id: 'tester', name: 'Escritor de tests', desc: 'Añade tests en un entorno aislado.', permission: 'edit', isolation: 'worktree',
    instructions: 'Actúa como ingeniero de calidad. Escribe tests útiles (casos normales, límites y errores) con el framework que ya use el proyecto. No cambies el código de producción salvo que un test revele un fallo claro; en ese caso explícalo. Termina indicando cómo ejecutar los tests.' },
  { id: 'disenador', name: 'Diseñador de interfaz', desc: 'Mejora la UI respetando el sistema de diseño.', permission: 'edit', isolation: 'worktree',
    instructions: 'Actúa como diseñador de producto y front-end. Mejora la interfaz respetando el sistema de diseño y los componentes existentes: jerarquía clara, espaciado consistente, buen contraste, estados de carga/vacío/error y adaptación a móvil. Explica brevemente las decisiones.' },
];
const BUILTIN_TEMPLATES = [
  { id: 'revisar-cambios', name: 'Revisar cambios', role: 'revisor', text: 'Revisa los cambios de {{qué revisar (rama, commit o "cambios sin confirmar")}} en este repositorio. Presta especial atención a: {{aspectos a vigilar}}.' },
  { id: 'corregir-error', name: 'Corregir un error', role: 'implementador', text: 'Corrige este error:\n\n{{descripción del error}}\n\nCómo reproducirlo: {{pasos}}\n\nComportamiento esperado: {{qué debería pasar}}' },
  { id: 'tests-para', name: 'Escribir tests', role: 'tester', text: 'Escribe tests para {{archivo, módulo o función}}. Cubre especialmente: {{casos importantes}}.' },
  { id: 'investigar', name: 'Investigar un tema', role: 'investigador', text: 'Investiga {{tema o pregunta}} para {{para qué lo necesito}}. Devuelve un resumen con las opciones, pros y contras y tu recomendación.' },
  { id: 'segunda-opinion', name: 'Segunda opinión', role: 'revisor', text: 'Dame una segunda opinión sobre este enfoque: {{enfoque o decisión}}. Contexto: {{contexto}}. Señala riesgos y alternativas.' },
];

export class Library {
  constructor(confDir) {
    this.file = path.join(confDir, 'library.json');
    let d = null;
    try { d = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch {}
    this.roles = d?.roles || structuredClone(BUILTIN_ROLES);
    this.templates = d?.templates || structuredClone(BUILTIN_TEMPLATES);
    this.recipes = d?.recipes || [];
    if (!d) this.save();
  }
  save() { fs.writeFileSync(this.file, JSON.stringify({ roles: this.roles, templates: this.templates, recipes: this.recipes }, null, 2), { mode: 0o600 }); }
  role(idOrName) {
    if (!idOrName) return null;
    const k = String(idOrName).toLowerCase();
    return this.roles.find((r) => r.id === k || r.name.toLowerCase() === k) || null;
  }
  saveRole(r) {
    const name = String(r.name || '').trim();
    if (!name) throw new Error('Ponle un nombre al rol');
    const clean = { id: r.id || slug(name), name, desc: String(r.desc || '').slice(0, 200), instructions: String(r.instructions || '').slice(0, 8000),
      agent: r.agent || null, model: r.model || null, permission: r.permission || null, isolation: r.isolation || null,
      timeoutMin: r.timeoutMin ? Number(r.timeoutMin) : null, maxTurns: r.maxTurns ? Number(r.maxTurns) : null };
    const i = this.roles.findIndex((x) => x.id === clean.id);
    if (i >= 0) this.roles[i] = clean; else { if (this.roles.some((x) => x.id === clean.id)) clean.id += '-' + crypto.randomBytes(2).toString('hex'); this.roles.push(clean); }
    this.save();
    return clean;
  }
  deleteRole(id) { this.roles = this.roles.filter((r) => r.id !== id); this.save(); }
  saveTemplate(t) {
    const name = String(t.name || '').trim(), text = String(t.text || '').trim();
    if (!name || !text) throw new Error('La plantilla necesita nombre y texto');
    const clean = { id: t.id || slug(name), name, text: text.slice(0, 12000), role: t.role || null };
    const i = this.templates.findIndex((x) => x.id === clean.id);
    if (i >= 0) this.templates[i] = clean; else this.templates.push(clean);
    this.save();
    return clean;
  }
  // ---- Recetas: lo que hizo un agente en un encargo, guardado para repetirlo en otro proyecto ----
  saveRecipe(job, name) {
    if (!job.steps?.length && !job.result) throw new Error('Este encargo no tiene pasos grabados (los encargos anteriores a esta función no los guardaban)');
    // Pasos sin repeticiones consecutivas y sin lecturas triviales, para que la receta sea legible
    const steps = [];
    for (const st of job.steps || []) {
      const last = steps.at(-1);
      if (last && last.tool === st.tool && last.detail === st.detail) continue;
      if (['TodoWrite', 'ExitPlanMode'].includes(st.tool)) continue;
      steps.push(st);
    }
    const r = { id: crypto.randomBytes(3).toString('hex'), name: String(name || '').trim().slice(0, 80) || job.task.replace(/\s+/g, ' ').slice(0, 60),
      task: job.task, steps: steps.slice(0, 200), summary: String(job.result || '').slice(0, 6000), agent: job.agent, model: job.model || null,
      permission: job.permission, isolation: job.isolation, fromJob: job.id, fromCwd: job.cwd, created: Date.now(), runs: 0 };
    this.recipes.push(r);
    this.save();
    return r;
  }
  deleteRecipe(id) { this.recipes = this.recipes.filter((r) => r.id !== id); this.save(); }
  // Texto del encargo para repetir una receta en otra carpeta
  recipeTask(id, notes = '') {
    const r = this.recipes.find((x) => x.id === id);
    if (!r) throw new Error('No existe esa receta');
    r.runs = (r.runs || 0) + 1; this.save();
    const steps = r.steps.map((s, i) => `${i + 1}. ${s.tool}${s.detail ? `: ${s.detail}` : ''}`).join('\n');
    return { recipe: r, task: `Repite en ESTE proyecto un procedimiento que ya se hizo en otro (${r.fromCwd}). Adáptalo a este proyecto: los nombres de archivos, rutas y comandos pueden ser distintos; no copies a ciegas.

Tarea original:
${r.task}
${steps ? `\nPasos que se dieron entonces (herramienta: detalle):\n${steps}\n` : ''}
Resumen de lo que se hizo:
${r.summary || '(sin resumen)'}
${notes ? `\nIndicaciones para esta vez: ${notes}` : ''}

Al terminar, resume qué hiciste y en qué te apartaste del procedimiento original y por qué.` };
  }
  deleteTemplate(id) { this.templates = this.templates.filter((t) => t.id !== id); this.save(); }
  // Aplica un rol a las opciones de un encargo: sus valores por defecto (sin pisar lo indicado) y sus instrucciones delante de la tarea
  applyRole(opts) {
    const r = this.role(opts.role);
    if (opts.role && !r) throw new Error(`No existe el rol "${opts.role}". Roles: ${this.roles.map((x) => x.id).join(', ')}`);
    if (!r) return opts;
    return { ...opts, agent: opts.agent || r.agent, model: opts.model || r.model, permission: opts.permission || r.permission || undefined,
      isolation: opts.isolation || r.isolation || undefined, timeoutMin: opts.timeoutMin ?? r.timeoutMin ?? undefined, maxTurns: opts.maxTurns ?? r.maxTurns ?? undefined,
      task: r.instructions ? `${r.instructions}\n\n---\n\nEncargo:\n${opts.task}` : opts.task, roleName: r.name };
  }
}
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || crypto.randomBytes(3).toString('hex');
