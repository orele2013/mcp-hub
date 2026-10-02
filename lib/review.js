// Revisión de seguridad de la configuración de un servidor MCP antes de instalarlo o guardarlo.
// Es un análisis estático de la configuración: no inspecciona el código del paquete ni garantiza que sea seguro.
import os from 'node:os';
import path from 'node:path';

const RUNNERS = new Set(['npx', 'uvx', 'uv', 'node', 'python', 'python3', 'deno', 'bunx', 'bun', 'docker', 'podman', 'pipx', 'go', 'java', 'dotnet', 'wine']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'fish', 'dash', 'cmd', 'powershell', 'pwsh']);
const SECRET_NAME = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD|CREDENTIAL|AUTH|COOKIE|SESSION)/i;
const HOME = os.homedir();

export function reviewSpec(spec = {}) {
  const f = [];
  const add = (level, text) => f.push({ level, text });
  if (spec.transport === 'stdio') {
    const cmd = String(spec.command || '');
    const base = path.basename(cmd);
    const args = (spec.args || []).map(String);
    const all = [cmd, ...args].join(' ');
    if (!cmd) add('error', 'No hay comando.');
    if (base === 'sudo' || args.includes('sudo')) add('error', 'Se ejecuta con sudo: el servidor tendría permisos de administrador.');
    if (SHELLS.has(base)) add(args.some((a) => a === '-c' || a === '/c') ? 'error' : 'warn', `Ejecuta una shell (${base}): puede hacer cualquier cosa; revisa el comando completo.`);
    if (/(curl|wget)[^|]*\|\s*(sh|bash|zsh|python)/.test(all)) add('error', 'Descarga y ejecuta un script de internet (curl | sh): muy arriesgado.');
    if (!RUNNERS.has(base) && !SHELLS.has(base) && base) {
      add(path.isAbsolute(cmd) ? 'info' : 'warn', `Comando poco común: “${cmd}”. Asegúrate de que sabes qué es y de dónde viene.`);
    }
    if (base === 'npx' || base === 'bunx') {
      const pkg = args.find((a) => !a.startsWith('-'));
      if (pkg) {
        const versioned = /^(@[^/]+\/)?[^@]+@\d/.test(pkg);
        if (!versioned) add('warn', `Ejecuta “${pkg}” sin versión fija: cada arranque descarga la última publicada. Si el paquete se ve comprometido, te afecta. Fija una versión (p. ej. ${pkg.replace(/@latest$/, '')}@1.2.3).`);
        if (/^[^@][^/]*$/.test(pkg) && !/^@modelcontextprotocol\//.test(pkg)) add('info', `“${pkg}” no tiene ámbito (@organización/…): comprueba que es el paquete oficial y no un nombre parecido.`);
      }
      if (args.includes('-y') || args.includes('--yes')) add('info', 'Instala sin preguntar (-y): normal en MCPs, pero no verás qué se instala.');
    }
    if (base === 'uvx' || (base === 'uv' && args.includes('run'))) {
      const pkg = args.find((a) => !a.startsWith('-') && a !== 'run' && a !== 'tool');
      if (pkg && !/[=@]=?\d/.test(pkg) && base === 'uvx') add('warn', `Ejecuta “${pkg}” sin versión fija (uvx descarga la última). Fija una versión con ${pkg}==1.2.3.`);
    }
    if (base === 'docker' || base === 'podman') {
      if (args.includes('--privileged')) add('error', 'Contenedor con --privileged: acceso casi total al sistema.');
      if (args.some((a) => /docker\.sock/.test(a))) add('error', 'Monta el socket de Docker: equivale a ser root en el ordenador.');
      if (args.some((a) => /^(-v|--volume)$/.test(a)) && args.some((a) => /^\/:|^\/:\/|^\/\s*:/.test(a))) add('error', 'Monta todo el disco (/) dentro del contenedor.');
      if (args.includes('--network') && args.includes('host') || args.includes('--net=host') || args.includes('--network=host')) add('warn', 'Usa la red del ordenador (--network host).');
      if (!args.includes('--rm')) add('info', 'Sin --rm: dejará contenedores parados tras cada uso.');
    }
    // Rutas muy amplias (servidores de archivos)
    for (const a of args) {
      const p = a.replace(/^~(?=$|\/)/, HOME);
      if (p === '/' ) add('error', 'Da acceso a todo el disco (/).');
      else if (p === HOME || p === HOME + '/') add('warn', 'Da acceso a toda tu carpeta personal: incluye claves SSH, configuraciones y credenciales. Limítalo a las carpetas que necesites.');
      else if (/\/\.(ssh|gnupg|aws|config)(\/|$)/.test(p)) add('error', `Da acceso a una carpeta con credenciales (${a}).`);
    }
    // Secretos en el entorno
    for (const [k, v] of Object.entries(spec.env || {})) {
      if (SECRET_NAME.test(k) && v && !/^\$\{?[A-Z_]+\}?$/.test(String(v))) add('warn', `La variable ${k} parece un secreto y se guardará en texto plano en la configuración de cada agente. Mejor guárdala en la Bóveda y pásala como variable al abrir el agente.`);
    }
  } else {
    let u; try { u = new URL(spec.url); } catch { add('error', 'URL no válida.'); }
    if (u) {
      const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname);
      if (u.protocol === 'http:' && !local) add('error', 'Usa http sin cifrar con un servidor remoto: cualquier cosa (incluidos tokens) viaja en claro.');
      if (u.username || u.password) add('error', 'La URL lleva usuario/contraseña: quedará en texto plano en las configuraciones.');
      if ([...u.searchParams.keys()].some((k) => SECRET_NAME.test(k))) add('warn', 'La URL lleva un token en los parámetros: quedará en texto plano y puede acabar en registros.');
      if (spec.transport === 'sse') add('info', 'SSE es el transporte antiguo; algunos clientes lo están retirando.');
    }
    for (const [k, v] of Object.entries(spec.headers || {})) {
      if ((/^authorization$/i.test(k) || SECRET_NAME.test(k)) && v) add('warn', `La cabecera ${k} lleva una credencial que se guardará en texto plano en la configuración de cada agente.`);
    }
  }
  if (!f.some((x) => x.level !== 'info')) add('ok', 'No se han encontrado problemas en la configuración. (Esto no revisa el código del servidor.)');
  return f;
}
