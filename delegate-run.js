#!/usr/bin/env node
// Ejecuta un encargo de un agente a otro en modo no interactivo, con el perfil de permisos elegido,
// muestra el progreso en la pestaña de MCP Hub y guarda la respuesta final (y el uso que informe el agente).
// Mientras trabaja escribe <resultFile>.state con el id de sesión del agente, para poder reanudar si se interrumpe.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { spawnCommand } from './lib/platform.js';

const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { agent, task, cwd, model, resultFile, from, permission = 'full', maxTurns, budgetUsd, resumeSid, approvals } = job;
const stateFile = job.stateFile || resultFile + '.state';
const lastFile = resultFile + '.last';
const m = (flag) => (model ? [flag, model] : []);
const prompt = resumeSid ? `Continúa la tarea donde la dejaste (se interrumpió). Recordatorio del encargo:\n\n${task}` : task;

// Perfiles de permisos → flags de cada agente
function claudeArgs() {
  const a = ['-p', prompt, '--output-format', 'stream-json', '--verbose', ...m('--model')];
  if (permission === 'full') a.push('--dangerously-skip-permissions');
  else if (permission === 'edit') a.push('--permission-mode', 'acceptEdits', '--permission-prompts', 'none');
  else if (permission === 'read') a.push('--permission-mode', 'plan', '--permission-prompts', 'none');
  else if (permission === 'ask' && approvals) {
    // Cada acción que necesite permiso se pregunta al usuario en MCP Hub (bandeja de aprobaciones)
    const cfg = path.join(path.dirname(resultFile), `job-${job.id}.mcp.json`);
    fs.writeFileSync(cfg, JSON.stringify({ mcpServers: { mcphub_approvals: { command: process.execPath, args: [approvals.script], env: { MCP_HUB_JOB: job.id, MCP_HUB_PORT: String(approvals.port), ...(process.versions.electron ? { ELECTRON_RUN_AS_NODE: '1' } : {}) } } } }), { mode: 0o600 });
    a.push('--permission-mode', 'acceptEdits', '--mcp-config', cfg, '--permission-prompt-tool', 'mcp__mcphub_approvals__approve');
  }
  if (maxTurns) a.push('--max-turns', String(maxTurns));
  if (budgetUsd) a.push('--max-budget-usd', String(budgetUsd));
  if (resumeSid) a.push('--resume', resumeSid);
  return a;
}
function codexArgs() {
  const sandbox = permission === 'full' ? ['--dangerously-bypass-approvals-and-sandbox']
    : ['-s', permission === 'read' ? 'read-only' : 'workspace-write', '-c', 'approval_policy="never"'];
  const flags = ['--json', ...sandbox, '--skip-git-repo-check', '-o', lastFile, ...m('-m')];
  return resumeSid ? ['exec', 'resume', ...flags, '--', resumeSid, prompt] : ['exec', ...flags, '-C', cwd, '--', prompt];
}
const OC_PERMS = { full: { edit: 'allow', bash: 'allow', webfetch: 'allow' }, edit: { edit: 'allow', bash: 'deny', webfetch: 'allow' },
  ask: { edit: 'allow', bash: 'deny', webfetch: 'allow' }, read: { edit: 'deny', bash: 'deny', webfetch: 'allow' } };
const CMDS = {
  claude: { bin: 'claude', args: claudeArgs, json: true },
  codex: { bin: 'codex', args: codexArgs, json: true },
  opencode: { bin: 'opencode', args: () => ['run', ...m('-m'), ...(resumeSid ? ['--session', resumeSid] : []), prompt],
    env: { OPENCODE_CONFIG_CONTENT: JSON.stringify({ permission: OC_PERMS[permission] || OC_PERMS.full }) } },
  gemini: { bin: 'gemini', args: () => ['-p', prompt, '--skip-trust', ...m('-m'),
    ...(permission === 'full' ? ['--yolo'] : ['--approval-mode', permission === 'read' ? 'plan' : 'auto_edit']), ...(resumeSid ? ['--resume', 'latest'] : [])] },
  cursor: { bin: 'cursor-agent', args: () => ['-p', prompt, '--trust', '--output-format', 'text', ...(permission === 'full' ? ['--force'] : []), ...m('--model'),
    ...(resumeSid ? ['--resume', resumeSid] : [])] },
};
const c = CMDS[agent];
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const write = (s) => process.stdout.write(s.replace(/\r?\n/g, '\r\n'));
const state = { sid: resumeSid || null, usage: {} };
// Pasos que da el agente (herramientas, comandos y archivos), para poder guardarlos como receta y repetirlos en otro proyecto
const steps = [];
// Las rutas se guardan relativas a la carpeta del encargo, para que la receta sirva en otro proyecto
const step = (tool, detail) => { if (steps.length < 400) steps.push({ tool: String(tool).slice(0, 60), detail: String(detail || '').split(cwd.replace(/\/$/, '') + '/').join('').replace(/\s+/g, ' ').slice(0, 300) }); };
const saveState = () => { try { fs.writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 }); } catch {} };
const finish = (exitCode, result) => {
  fs.writeFileSync(resultFile, JSON.stringify({ exitCode, result, sid: state.sid, usage: state.usage, steps }), { mode: 0o600 });
  write(`\n${dim(`── encargo terminado · código ${exitCode}`)}\n`);
  process.exit(exitCode);
};
if (!c) finish(2, `Agente desconocido: ${agent}`);

const PERM_LABEL = { read: 'solo lectura', edit: 'puede editar archivos', ask: 'pide aprobación', full: 'sin límites' };
write(`\x1b[1m↳ Encargo de ${from || 'un agente'}\x1b[0m ${dim(`· ${PERM_LABEL[permission] || permission}${resumeSid ? ' · reanudado' : ''}`)}\n${dim(task.length > 600 ? task.slice(0, 600) + '…' : task)}\n${dim('─'.repeat(40))}\n\n`);

const child = spawnCommand(c.bin, c.args(), { cwd, env: { ...process.env, ...c.env, MCP_TOOL_TIMEOUT: '3600000' }, stdio: ['ignore', 'pipe', 'pipe'] });
let plain = '', errText = '', final = null, pending = '';
const texts = [];
child.stderr.on('data', (d) => { errText = (errText + d).slice(-20000); if (agent !== 'codex') write(d.toString()); });
child.stdout.on('data', (d) => {
  if (!c.json) { plain += d; if (plain.length > 400_000) plain = plain.slice(-200_000); return write(d.toString()); }
  pending += d;
  const lines = pending.split('\n'); pending = lines.pop();
  for (const line of lines) {
    let ev; try { ev = JSON.parse(line); } catch { continue; }
    const sid = ev.session_id || ev.thread_id;
    if (sid && sid !== state.sid) { state.sid = sid; saveState(); }
    if (ev.type === 'assistant') {
      for (const b of ev.message?.content || []) {
        if (b.type === 'text' && b.text.trim()) { texts.push(b.text.trim()); write(b.text.trim() + '\n\n'); }
        if (b.type === 'tool_use') {
          const i = b.input || {};
          write(dim(`⚙ ${b.name} ${String(i.command || i.file_path || i.pattern || i.url || i.description || '').slice(0, 140)}`) + '\n');
          step(b.name, i.command || i.file_path || i.pattern || i.url || i.query || i.description || '');
        }
      }
    } else if (ev.type === 'result') {
      final = ev.result ?? null;
      Object.assign(state.usage, { costUsd: ev.total_cost_usd, turns: ev.num_turns, inputTokens: ev.usage?.input_tokens, outputTokens: ev.usage?.output_tokens });
      if (ev.is_error || String(ev.subtype || '').startsWith('error')) write(`\x1b[31m${final || ev.subtype || 'Error'}\x1b[0m\n`);
      saveState();
    } else if (ev.type === 'item.completed' && ev.item) {
      const it = ev.item;
      if (it.type === 'agent_message' && it.text) { texts.push(it.text); write(it.text + '\n\n'); }
      else if (it.type === 'command_execution') { const cmd = String(it.command || '').replace(/^\/usr\/bin\/bash -lc /, ''); write(dim(`$ ${cmd.slice(0, 160)}`) + '\n'); step('Bash', cmd); }
      else if (it.type === 'file_change') { write(dim(`✎ ${(it.changes || []).map((x) => path.basename(x.path)).join(', ')}`) + '\n'); for (const x of it.changes || []) step('Edit', path.relative(cwd, x.path || '')); }
    } else if (ev.type === 'turn.completed' && ev.usage) {
      state.usage.inputTokens = (state.usage.inputTokens || 0) + (ev.usage.input_tokens || 0);
      state.usage.outputTokens = (state.usage.outputTokens || 0) + (ev.usage.output_tokens || 0);
      state.usage.turns = (state.usage.turns || 0) + 1;
      saveState();
    } else if (ev.type === 'turn.failed' || ev.type === 'error') {
      write(`\x1b[31m${ev.error?.message || ev.message || 'Error'}\x1b[0m\n`);
    }
  }
});
child.on('error', (e) => finish(127, `No se pudo ejecutar ${c.bin}: ${e.message}`));
const stop = () => { try { child.kill('SIGTERM'); } catch {} };
process.on('SIGTERM', stop); process.on('SIGHUP', stop);
child.on('close', (code) => {
  let result = final;
  if (result == null) { try { result = fs.readFileSync(lastFile, 'utf8'); } catch {} }
  if (result == null || !String(result).trim()) result = texts.at(-1) || null;
  // A veces el último mensaje solo remite a uno anterior ("ya respondí arriba"): si es corto, se guarda también lo que dijo antes
  else if (String(result).trim().length < 300 && texts.length > 1 && /arriba|anterior|ya (te )?(lo )?(he )?respond|como (ya )?(he )?dicho|above|already (answered|responded)|see my previous/i.test(String(result))) {
    const prev = texts.filter((t) => t.trim() !== String(result).trim()).join('\n\n');
    if (prev) result = `${prev.slice(-12000)}\n\n${String(result).trim()}`;
  }
  if (result == null || !String(result).trim()) {
    const clean = (t) => t.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '').trim();
    result = clean(plain).slice(-12000) || (code ? clean(errText).slice(-3000) : '');
  }
  fs.rmSync(lastFile, { force: true });
  finish(code ?? 1, String(result || '(sin respuesta)').trim());
});
