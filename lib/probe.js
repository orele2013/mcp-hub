// Arranca/contacta un servidor MCP y lista sus herramientas para comprobar que funciona.
import { spawn } from 'node:child_process';

const INIT = {
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mcp-hub', version: '1.0.0' } },
};

export function probe(spec, timeoutMs = 90000) {
  return spec.transport === 'stdio' ? probeStdio(spec, timeoutMs) : probeHttp(spec, timeoutMs);
}

function probeStdio(spec, timeoutMs) {
  return new Promise((resolve) => {
    let child, stderr = '', buf = '', done = false, serverInfo = null;
    const finish = (r) => {
      if (done) return; done = true; clearTimeout(timer);
      try { child.kill('SIGTERM'); } catch {}
      resolve({ ...r, stderr: stderr.slice(-2000) });
    };
    const timer = setTimeout(() => finish({ ok: false, error: `Sin respuesta tras ${timeoutMs / 1000}s` }), timeoutMs);
    try {
      child = spawn(spec.command, spec.args || [], { env: { ...process.env, ...(spec.env || {}) }, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) { return finish({ ok: false, error: e.message }); }
    const send = (m) => child.stdin.write(JSON.stringify(m) + '\n');
    child.on('error', (e) => finish({ ok: false, error: e.code === 'ENOENT' ? `Comando no encontrado: ${spec.command}` : e.message }));
    child.on('exit', (code) => finish({ ok: false, error: `El proceso terminó (código ${code})` }));
    child.stderr.on('data', (d) => { stderr += d; });
    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let msg; try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id === 1) {
          if (msg.error) return finish({ ok: false, error: msg.error.message });
          serverInfo = msg.result?.serverInfo;
          send({ jsonrpc: '2.0', method: 'notifications/initialized' });
          send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
        } else if (msg.id === 2) {
          if (msg.error) return finish({ ok: true, serverInfo, tools: [], note: msg.error.message });
          finish({ ok: true, serverInfo, tools: (msg.result?.tools || []).map((t) => ({ name: t.name, description: t.description })) });
        }
      }
    });
    send(INIT);
  });
}

async function probeHttp(spec, timeoutMs) {
  if (spec.transport === 'sse') return { ok: false, error: 'La prueba de servidores SSE (legacy) no está soportada; prueba desde el agente.' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let session = null;
  const post = async (body) => {
    const res = await fetch(spec.url, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-06-18', ...(session ? { 'mcp-session-id': session } : {}), ...(spec.headers || {}) },
      body: JSON.stringify(body),
    });
    session = res.headers.get('mcp-session-id') || session;
    if (res.status === 401 || res.status === 403) {
      const err = new Error(`HTTP ${res.status}: requiere autenticación (OAuth o token). Los agentes te pedirán iniciar sesión al usarlo.`);
      err.auth = true; throw err;
    }
    if (!res.ok && res.status !== 202) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    if (body.id === undefined) return null;
    const txt = await res.text();
    if ((res.headers.get('content-type') || '').includes('text/event-stream')) {
      for (const chunk of txt.split(/\n\n/)) {
        const data = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
        if (!data) continue;
        try { const m = JSON.parse(data); if (m.id === body.id) return m; } catch {}
      }
      throw new Error('Respuesta SSE sin resultado');
    }
    return JSON.parse(txt);
  };
  try {
    const init = await post(INIT);
    if (init.error) throw new Error(init.error.message);
    await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    const tl = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    return { ok: true, serverInfo: init.result?.serverInfo, tools: (tl.result?.tools || []).map((t) => ({ name: t.name, description: t.description })) };
  } catch (e) {
    return { ok: false, auth: !!e.auth, error: e.name === 'AbortError' ? 'Tiempo de espera agotado' : e.message };
  } finally { clearTimeout(timer); }
}
