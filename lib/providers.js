// Proveedores de IA por API y cómo se inyectan en cada agente al lanzarlo.
// Un proveedor: { name, openaiUrl?, anthropicUrl?, apiKey, models: [], wireApi?: 'chat'|'responses' }
//  - openaiUrl    -> endpoint compatible con OpenAI (Codex, OpenCode)
//  - anthropicUrl -> endpoint compatible con Anthropic (Claude Code, OpenCode)

export const PROVIDER_PRESETS = [
  { id: 'openrouter', name: 'OpenRouter', openaiUrl: 'https://openrouter.ai/api/v1', anthropicUrl: 'https://openrouter.ai/api', keyUrl: 'https://openrouter.ai/keys' },
  { id: 'deepseek', name: 'DeepSeek', openaiUrl: 'https://api.deepseek.com/v1', anthropicUrl: 'https://api.deepseek.com/anthropic', models: ['deepseek-chat', 'deepseek-reasoner'], keyUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'moonshot', name: 'Kimi (Moonshot)', openaiUrl: 'https://api.moonshot.ai/v1', anthropicUrl: 'https://api.moonshot.ai/anthropic', keyUrl: 'https://platform.moonshot.ai' },
  { id: 'zai', name: 'Z.ai (GLM)', openaiUrl: 'https://api.z.ai/api/paas/v4', anthropicUrl: 'https://api.z.ai/api/anthropic', keyUrl: 'https://z.ai/manage-apikey/apikey-list' },
  { id: 'openai', name: 'OpenAI API', openaiUrl: 'https://api.openai.com/v1', wireApi: 'responses', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', name: 'Anthropic API', anthropicUrl: 'https://api.anthropic.com', keyUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'google', name: 'Google Gemini API', openaiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'groq', name: 'Groq', openaiUrl: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys' },
  { id: 'mistral', name: 'Mistral', openaiUrl: 'https://api.mistral.ai/v1', keyUrl: 'https://console.mistral.ai/api-keys' },
  { id: 'xai', name: 'xAI (Grok)', openaiUrl: 'https://api.x.ai/v1', keyUrl: 'https://console.x.ai' },
  { id: 'together', name: 'Together AI', openaiUrl: 'https://api.together.xyz/v1', keyUrl: 'https://api.together.xyz/settings/api-keys' },
  { id: 'ollama', name: 'Ollama (local)', openaiUrl: 'http://localhost:11434/v1', anthropicUrl: 'http://localhost:11434', noKey: true },
  { id: 'lmstudio', name: 'LM Studio (local)', openaiUrl: 'http://localhost:1234/v1', noKey: true },
  { id: 'custom', name: 'Personalizado', custom: true },
];

// Qué agentes pueden usar un proveedor
export function compatible(clientId, p) {
  if (clientId === 'claude') return !!p.anthropicUrl;
  if (clientId === 'codex') return !!p.openaiUrl;
  if (clientId === 'opencode') return !!(p.openaiUrl || p.anthropicUrl);
  return false;
}

const trim = (u) => String(u || '').replace(/\/+$/, '');

// Devuelve { args, env, unset } para lanzar `clientId` con el proveedor `p` y el modelo `model`
export function providerLaunch(clientId, id, p, model, ctx) {
  const key = p.apiKey || 'no-key';
  if (clientId === 'claude') {
    const official = /api\.anthropic\.com/.test(p.anthropicUrl);
    const env = { ANTHROPIC_BASE_URL: trim(p.anthropicUrl) };
    if (official) env.ANTHROPIC_API_KEY = key; else env.ANTHROPIC_AUTH_TOKEN = key;
    if (model) Object.assign(env, { ANTHROPIC_MODEL: model, ANTHROPIC_DEFAULT_OPUS_MODEL: model,
      ANTHROPIC_DEFAULT_SONNET_MODEL: model, ANTHROPIC_DEFAULT_HAIKU_MODEL: model, CLAUDE_CODE_SUBAGENT_MODEL: model });
    return { args: [], env, unset: official ? ['ANTHROPIC_AUTH_TOKEN'] : ['ANTHROPIC_API_KEY'] };
  }
  if (clientId === 'codex') {
    const wire = p.wireApi || 'chat';
    const tbl = `{name=${JSON.stringify(p.name)}, base_url=${JSON.stringify(trim(p.openaiUrl))}, env_key="MCP_HUB_PROVIDER_KEY", wire_api="${wire}"}`;
    const args = ['-c', `model_providers.mcphub=${tbl}`, '-c', 'model_provider="mcphub"'];
    if (model) args.push('-m', model);
    return { args, env: { MCP_HUB_PROVIDER_KEY: key }, unset: [] };
  }
  if (clientId === 'opencode') {
    const pid = `hub-${id}`;
    const useOpenai = !!p.openaiUrl;
    const models = Object.fromEntries([...new Set([...(p.models || []), ...(model ? [model] : [])])].map((m) => [m, { name: m }]));
    ctx.ocConfig.provider = {
      [pid]: {
        npm: useOpenai ? '@ai-sdk/openai-compatible' : '@ai-sdk/anthropic',
        name: `${p.name} (MCP Hub)`,
        options: { baseURL: useOpenai ? trim(p.openaiUrl) : trim(p.anthropicUrl) + '/v1', apiKey: key },
        models,
      },
    };
    return { args: model ? ['--model', `${pid}/${model}`] : [], env: {}, unset: [] };
  }
  throw new Error('Este agente no admite proveedores personalizados');
}

// Lista los modelos disponibles del proveedor (sirve también como prueba de la API key)
export async function listModels(p) {
  const ctrl = AbortSignal.timeout(15000);
  if (p.openaiUrl) {
    const r = await fetch(trim(p.openaiUrl) + '/models', { signal: ctrl, headers: p.apiKey ? { authorization: `Bearer ${p.apiKey}` } : {} });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    return (j.data || j.models || []).map((m) => m.id || m.name).filter(Boolean).sort();
  }
  const r = await fetch(trim(p.anthropicUrl) + '/v1/models?limit=100', { signal: ctrl,
    headers: { 'x-api-key': p.apiKey || '', authorization: `Bearer ${p.apiKey || ''}`, 'anthropic-version': '2023-06-01' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return ((await r.json()).data || []).map((m) => m.id).sort();
}
