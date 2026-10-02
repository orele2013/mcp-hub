// Catálogo de servidores MCP conocidos. Los {{CAMPOS}} se rellenan al instalar.
// field.type: 'text' | 'secret' | 'path' ; field.list: se separa por comas en varios argumentos.
export const CATALOG = [
  // --- Oficiales / referencia
  { id: 'filesystem', name: 'Filesystem', cat: 'Sistema', desc: 'Leer y escribir archivos en carpetas permitidas.',
    spec: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '{{DIRS}}'] },
    fields: [{ key: 'DIRS', label: 'Carpetas permitidas (separadas por coma)', type: 'path', list: true, default: '~' }] },
  { id: 'memory', name: 'Memory', cat: 'Sistema', desc: 'Memoria persistente como grafo de conocimiento.',
    spec: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] } },
  { id: 'sequential-thinking', name: 'Sequential Thinking', cat: 'Razonamiento', desc: 'Razonamiento paso a paso estructurado.',
    spec: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] } },
  { id: 'fetch', name: 'Fetch', cat: 'Web', desc: 'Descarga páginas web y las convierte a markdown.',
    spec: { transport: 'stdio', command: 'uvx', args: ['mcp-server-fetch'] } },
  { id: 'git', name: 'Git', cat: 'Desarrollo', desc: 'Leer, buscar y manipular repositorios Git.',
    spec: { transport: 'stdio', command: 'uvx', args: ['mcp-server-git'] } },
  { id: 'time', name: 'Time', cat: 'Sistema', desc: 'Hora actual y conversión de zonas horarias.',
    spec: { transport: 'stdio', command: 'uvx', args: ['mcp-server-time'] } },
  { id: 'sqlite', name: 'SQLite', cat: 'Datos', desc: 'Consultas sobre una base de datos SQLite.',
    spec: { transport: 'stdio', command: 'uvx', args: ['mcp-server-sqlite', '--db-path', '{{DB}}'] },
    fields: [{ key: 'DB', label: 'Ruta del archivo .db', type: 'path' }] },
  { id: 'postgres', name: 'PostgreSQL', cat: 'Datos', desc: 'Consultas de solo lectura sobre PostgreSQL.',
    spec: { transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres', '{{URL}}'] },
    fields: [{ key: 'URL', label: 'Cadena de conexión', type: 'secret', placeholder: 'postgresql://user:pass@localhost/db' }] },

  // --- Navegador / web
  { id: 'playwright', name: 'Playwright', cat: 'Navegador', desc: 'Controla un navegador: navegar, clicar, capturas.',
    spec: { transport: 'stdio', command: 'npx', args: ['-y', '@playwright/mcp@latest'] } },
  { id: 'chrome-devtools', name: 'Chrome DevTools', cat: 'Navegador', desc: 'Depura Chrome: consola, red, rendimiento.',
    spec: { transport: 'stdio', command: 'npx', args: ['-y', 'chrome-devtools-mcp@latest'] } },
  { id: 'brave-search', name: 'Brave Search', cat: 'Web', desc: 'Búsqueda web con la API de Brave.',
    spec: { transport: 'stdio', command: 'npx', args: ['-y', '@brave/brave-search-mcp-server'], env: { BRAVE_API_KEY: '{{KEY}}' } },
    fields: [{ key: 'KEY', label: 'BRAVE_API_KEY', type: 'secret' }] },
  { id: 'firecrawl', name: 'Firecrawl', cat: 'Web', desc: 'Scraping y crawling de sitios web.',
    spec: { transport: 'stdio', command: 'npx', args: ['-y', 'firecrawl-mcp'], env: { FIRECRAWL_API_KEY: '{{KEY}}' } },
    fields: [{ key: 'KEY', label: 'FIRECRAWL_API_KEY', type: 'secret' }] },
  { id: 'exa', name: 'Exa', cat: 'Web', desc: 'Búsqueda web y de código con Exa.',
    spec: { transport: 'http', url: 'https://mcp.exa.ai/mcp' } },

  // --- Documentación
  { id: 'context7', name: 'Context7', cat: 'Documentación', desc: 'Documentación actualizada de librerías.',
    spec: { transport: 'stdio', command: 'npx', args: ['-y', '@upstash/context7-mcp'] } },
  { id: 'deepwiki', name: 'DeepWiki', cat: 'Documentación', desc: 'Pregunta sobre cualquier repo público de GitHub.',
    spec: { transport: 'http', url: 'https://mcp.deepwiki.com/mcp' } },
  { id: 'cloudflare-docs', name: 'Cloudflare Docs', cat: 'Documentación', desc: 'Documentación de Cloudflare.',
    spec: { transport: 'http', url: 'https://docs.mcp.cloudflare.com/mcp' } },
  { id: 'huggingface', name: 'Hugging Face', cat: 'IA', desc: 'Modelos, datasets y Spaces de Hugging Face.',
    spec: { transport: 'http', url: 'https://huggingface.co/mcp' } },

  // --- Servicios (OAuth o token)
  { id: 'github', name: 'GitHub', cat: 'Desarrollo', desc: 'Issues, PRs, repos y Actions de GitHub.',
    spec: { transport: 'http', url: 'https://api.githubcopilot.com/mcp/', headers: { Authorization: 'Bearer {{TOKEN}}' } },
    fields: [{ key: 'TOKEN', label: 'GitHub Personal Access Token', type: 'secret' }] },
  { id: 'sentry', name: 'Sentry', cat: 'Desarrollo', desc: 'Errores y problemas de Sentry (OAuth).',
    spec: { transport: 'http', url: 'https://mcp.sentry.dev/mcp' } },
  { id: 'linear', name: 'Linear', cat: 'Productividad', desc: 'Issues y proyectos de Linear (OAuth).',
    spec: { transport: 'http', url: 'https://mcp.linear.app/mcp' } },
  { id: 'notion', name: 'Notion', cat: 'Productividad', desc: 'Páginas y bases de datos de Notion (OAuth).',
    spec: { transport: 'http', url: 'https://mcp.notion.com/mcp' } },
  { id: 'vercel', name: 'Vercel', cat: 'Desarrollo', desc: 'Proyectos y despliegues de Vercel (OAuth).',
    spec: { transport: 'http', url: 'https://mcp.vercel.com' } },
  { id: 'stripe', name: 'Stripe', cat: 'Pagos', desc: 'API de Stripe.',
    spec: { transport: 'http', url: 'https://mcp.stripe.com', headers: { Authorization: 'Bearer {{KEY}}' } },
    fields: [{ key: 'KEY', label: 'Stripe secret/restricted key', type: 'secret' }] },
  { id: 'supabase', name: 'Supabase', cat: 'Datos', desc: 'Gestiona proyectos y bases de datos Supabase.',
    spec: { transport: 'stdio', command: 'npx', args: ['-y', '@supabase/mcp-server-supabase@latest'], env: { SUPABASE_ACCESS_TOKEN: '{{TOKEN}}' } },
    fields: [{ key: 'TOKEN', label: 'SUPABASE_ACCESS_TOKEN', type: 'secret' }] },
  { id: 'n8n', name: 'n8n', cat: 'Automatización', desc: 'Workflows de n8n expuestos como herramientas.',
    spec: { transport: 'http', url: '{{URL}}' },
    fields: [{ key: 'URL', label: 'URL del MCP server de n8n', type: 'text', placeholder: 'https://xxx.app.n8n.cloud/mcp-server/http' }] },
  { id: 'figma', name: 'Figma (Dev Mode)', cat: 'Diseño', desc: 'Servidor local de Figma Desktop (Dev Mode).',
    spec: { transport: 'http', url: 'http://127.0.0.1:3845/mcp' } },

  // --- Creatividad / escritorio
  { id: 'blender', name: 'Blender', cat: 'Diseño', desc: 'Controla Blender (requiere el addon blender-mcp).',
    spec: { transport: 'stdio', command: 'uvx', args: ['blender-mcp'] } },
  { id: 'desktop-commander', name: 'Desktop Commander', cat: 'Sistema', desc: 'Terminal, procesos y edición de archivos.',
    spec: { transport: 'stdio', command: 'npx', args: ['-y', '@wonderwhy-er/desktop-commander@latest'] } },
];

// Rellena {{CAMPOS}} en un spec
export function fillSpec(spec, values = {}, fields = []) {
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
  const sub = (s) => String(s).replace(/\{\{(\w+)\}\}/g, (_, k) => values[k] ?? '');
  const out = JSON.parse(JSON.stringify(spec));
  if (out.args) {
    out.args = out.args.flatMap((a) => {
      const m = /^\{\{(\w+)\}\}$/.exec(a);
      if (m && byKey[m[1]]?.list) return String(values[m[1]] || '').split(',').map((x) => x.trim()).filter(Boolean);
      return [sub(a)];
    });
  }
  for (const k of ['env', 'headers']) if (out[k]) for (const h in out[k]) out[k][h] = sub(out[k][h]);
  if (out.url) out.url = sub(out.url);
  return out;
}
