'use strict';

let profileEditorReturn = 'list';

function projectProfileLabel(p) {
  const agent = S.clients.find((c) => c.id === p.client)?.name || p.client;
  const mcpCount = p.mcps?.length || 0;
  const mcpText = p.mode === 'selected' ? `${mcpCount} MCP${mcpCount === 1 ? '' : 's'}` : 'MCPs conectados';
  const skillText = p.skills?.length ? ` · ${p.skills.length} skill${p.skills.length === 1 ? '' : 's'} preferida${p.skills.length === 1 ? '' : 's'}` : '';
  const secretText = p.secrets?.length ? ` · ${p.secrets.length} credencial${p.secrets.length === 1 ? '' : 'es'} autorizada${p.secrets.length === 1 ? '' : 's'}` : '';
  return `${agent} · ${mcpText}${skillText}${secretText}`;
}

async function loadProjectProfileList() {
  try {
    const r = await api('/api/project-profiles');
    S.projectProfiles = r.profiles || [];
    S.projectProfilesError = r.error || null;
  } catch (e) { S.projectProfilesError = e.message; }
  renderProjectProfiles();
}

function renderProjectProfiles() {
  const items = S.projectProfiles || [];
  modal(`<div class="mhead"><span class="big-lock" style="width:42px;height:42px">${svg('folder')}</span><div><small>Sesiones</small><h2>Perfiles de proyecto</h2></div><button class="btn icon sm" data-close aria-label="Cerrar">${svg('x')}</button></div>
    <p class="sub" style="margin:0">Guarda cómo abrir un agente para cada proyecto. Las credenciales se guardan como referencias a la Bóveda; sus valores nunca se copian al perfil.</p>
    ${S.projectProfilesError ? `<div class="banner">${svg('warn')}<span>${esc(S.projectProfilesError)}</span></div>` : ''}
    <div id="pp-list" style="display:grid;gap:9px;max-height:54vh;overflow:auto">
      ${items.length ? items.map((p) => `<article class="card" data-pp="${p.id}" style="padding:14px">
        <div class="head">${logo(p.client, 34)}<div style="min-width:0"><b>${esc(p.name)}</b><small class="mono" style="overflow-wrap:anywhere">${esc(tilde(p.cwd))}</small></div></div>
        <div class="hint" style="margin:10px 0 0">${esc(projectProfileLabel(p))}</div>
        <div class="row-actions" style="justify-content:flex-end;margin-top:12px">
          <button class="btn sm" data-pp-open="${p.id}" ${S.clients.find((c) => c.id === p.client)?.installed ? '' : 'disabled title="Instala este agente antes de abrir el perfil"'}>Abrir</button><button class="btn sm" data-pp-edit="${p.id}">Editar</button><button class="btn sm icon" data-pp-delete="${p.id}" aria-label="Eliminar ${esc(p.name)}" title="Eliminar">${svg('trash')}</button>
        </div>
      </article>`).join('') : `<div class="empty-state" style="padding:24px">${svg('folder')}<p><b>Aún no hay perfiles</b></p><p>Crea uno para guardar agente, modelo, MCPs e instrucciones por carpeta.</p></div>`}
    </div>
    <div class="mfoot"><button class="btn" data-close>Cerrar</button><button class="btn primary" id="pp-new">${svg('plus')}Nuevo perfil</button></div>`, { sheet: true });

  $('#pp-new').onclick = () => editProjectProfile({ cwd: S.recentDirs?.[0] || S.home, client: S.clients.find((c) => c.installed)?.id || 'claude', account: 'subscription', mode: 'all', mcps: [], skills: [], instructions: '', secrets: [] });
  $$('[data-pp-open]').forEach((b) => (b.onclick = () => {
    const p = items.find((x) => x.id === b.dataset.ppOpen);
    if (p) window.launchSheet?.(p.client, { profileId: p.id });
  }));
  $$('[data-pp-edit]').forEach((b) => (b.onclick = () => {
    const p = items.find((x) => x.id === b.dataset.ppEdit);
    if (p) editProjectProfile(p);
  }));
  $$('[data-pp-delete]').forEach((b) => (b.onclick = () => deleteProjectProfile(b.dataset.ppDelete)));
}

function editProjectProfile(profile = {}, editId = profile.id) {
  const p = { ...profile, id: editId || profile.id || '' };
  const clients = S.clients || [];
  const selectedClient = clients.find((c) => c.id === p.client) || clients.find((c) => c.installed) || clients[0] || { id: 'claude', name: 'Claude Code', strict: true };
  p.client = selectedClient.id;
  const providers = Object.entries(S.providers || {}).filter(([, x]) => x.compatible?.includes(p.client));
  const hasSelectedAccount = p.account === 'default' || p.account === 'subscription' || providers.some(([id]) => p.account === `provider:${id}`);
  if (!hasSelectedAccount) p.account = 'subscription';

  modal(`<div class="mhead">${logo(p.client, 40)}<div><small>Perfil de proyecto${p.id ? ' · editar' : ''}</small><h2>${p.id ? esc(p.name || 'Editar perfil') : 'Nuevo perfil'}</h2></div><button class="btn icon sm" data-close aria-label="Cerrar">${svg('x')}</button></div>
    <div class="form" style="overflow:auto;min-height:0;padding-right:2px">
      <div class="row"><label>Nombre<input id="pp-name" class="field" maxlength="80" value="${esc(p.name || '')}" placeholder="Mi proyecto"></label>
        <label>Agente<select id="pp-client" class="field">${clients.map((c) => `<option value="${c.id}" ${c.id === p.client ? 'selected' : ''}>${esc(c.name)}${c.installed ? '' : ' · no instalado'}</option>`).join('')}</select></label></div>
      <label>Carpeta del proyecto<input id="pp-cwd" class="field mono" value="${esc(tilde(p.cwd || S.recentDirs?.[0] || S.home))}" placeholder="~/Projects/mi-app"></label>
      <div class="row"><label>Cuenta<select id="pp-account" class="field"><option value="subscription" ${p.account === 'subscription' ? 'selected' : ''}>Suscripción</option><option value="default" ${p.account === 'default' ? 'selected' : ''}>Configuración del agente</option>${providers.map(([id, x]) => `<option value="provider:${id}" ${p.account === `provider:${id}` ? 'selected' : ''}>API · ${esc(x.name)}</option>`).join('')}</select></label>
        <label id="pp-model-wrap">Modelo<input id="pp-model" class="field mono" maxlength="160" value="${esc(p.model || '')}" placeholder="por defecto del proveedor"></label></div>
      <label class="check" style="align-self:flex-start"><input type="checkbox" id="pp-selected" ${p.mode === 'selected' ? 'checked' : ''} ${selectedClient.strict ? '' : 'disabled'}>Usar solo los MCP seleccionados${tick}</label>
      ${selectedClient.strict ? `<div class="checks" id="pp-mcps">${Object.keys(S.servers || {}).sort().map((n) => `<label class="check"><input type="checkbox" value="${esc(n)}" ${(p.mcps || []).includes(n) ? 'checked' : ''}>${logo(serverKey(n, S.servers[n]), 16, { plain: true })}${esc(n)}${tick}</label>`).join('') || '<span class="hint">No hay servidores en MCP Hub.</span>'}</div>` : `<span class="hint">Este agente no puede limitar los MCPs por sesión; usará los MCPs conectados.</span>`}
      <label>Skills preferidas <span class="hint">Nombres separados por coma. Deben estar instaladas para el agente; MCP Hub las menciona al inicio, pero no oculta otras skills globales.</span><input id="pp-skills" class="field" value="${esc((p.skills || []).join(', '))}" placeholder="testing, revisión de seguridad"></label>
      <label>Instrucciones del proyecto <span class="hint">Se envían al agente como primer mensaje al abrir una sesión con este perfil.</span><textarea id="pp-instructions" class="field" rows="4" maxlength="8000" placeholder="Convenciones, archivos importantes, criterios de aceptación…">${esc(p.instructions || '')}</textarea></label>
      <div class="flabel">Credenciales autorizadas <span class="hint">Solo se pasan al agente como variables de entorno. El secreto queda cifrado en la Bóveda y nunca se incluye en el perfil ni en el mensaje.</span>
        ${S.vault?.unlocked ? (S.vault.env?.length ? `<div class="checks" id="pp-secrets">${S.vault.env.map((x) => `<label class="check"><input type="checkbox" value="${x.id}" ${(p.secrets || []).includes(x.id) ? 'checked' : ''}>${logo(itemKey(x), 16, { plain: true })}<span>${esc(x.name)}</span><span class="mono hint">${esc(x.envVar)}</span>${tick}</label>`).join('')}</div>${(p.secrets || []).some((id) => !S.vault.env.some((x) => x.id === id)) ? '<span class="hint warn">Hay referencias que ya no están en la Bóveda; se quitarán al guardar.</span>' : ''}` : '<span class="hint">No hay credenciales con variable de entorno en la Bóveda.</span>')
          : `<span class="hint">La Bóveda está bloqueada. ${p.secrets?.length ? `${p.secrets.length} referencia(s) existente(s) se conservarán al guardar.` : 'Desbloquéala para autorizar credenciales.'}</span>`}
      </div>
      <p class="hint">El perfil se guarda en <code>~/.config/mcp-hub/project-profiles.json</code> con permisos privados. No guarda claves de API.</p>
    </div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="pp-save">${svg('check')}Guardar perfil</button></div>`, { sheet: true });

  const syncAccount = () => { $('#pp-model-wrap').style.display = $('#pp-account').value.startsWith('provider:') ? '' : 'none'; };
  $('#pp-account').onchange = syncAccount; syncAccount();
  $('#pp-client').onchange = () => editProjectProfile({ ...readProfileForm(), client: $('#pp-client').value }, p.id);
  const readProfileForm = () => ({
    id: p.id || undefined, name: $('#pp-name').value.trim(), cwd: $('#pp-cwd').value.trim(), client: $('#pp-client').value,
    account: $('#pp-account').value, model: $('#pp-model').value.trim(), mode: $('#pp-selected').checked ? 'selected' : 'all',
    mcps: $$('#pp-mcps input:checked').map((i) => i.value),
    skills: $('#pp-skills').value.split(',').map((x) => x.trim()).filter(Boolean),
    instructions: $('#pp-instructions').value,
    secrets: S.vault?.unlocked ? $$('#pp-secrets input:checked').map((i) => i.value) : (p.secrets || []),
  });
  $('#pp-save').onclick = async () => {
    const b = $('#pp-save'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Guardando…';
    try {
      const r = await api('/api/project-profiles/save', { profile: readProfileForm() });
      S.projectProfiles = [...(S.projectProfiles || []).filter((x) => x.id !== r.profile.id), r.profile];
      toast('Perfil de proyecto guardado'); closeModal();
      if (profileEditorReturn === 'launch') window.launchSheet?.(r.profile.client, { profileId: r.profile.id });
      else loadProjectProfileList();
    } catch (e) { toast(e.message, true); b.disabled = false; b.innerHTML = svg('check') + 'Guardar perfil'; }
  };
}

async function deleteProjectProfile(id) {
  const p = S.projectProfiles.find((x) => x.id === id);
  if (!p) return;
  modal(`<div class="mhead">${logo(p.client, 40)}<div><small>Eliminar perfil</small><h2>${esc(p.name)}</h2></div></div>
    <p class="sub" style="margin-top:14px">Se borrará el perfil de MCP Hub. La carpeta del proyecto y sus credenciales de la Bóveda no se modificarán.</p>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn danger" id="pp-delete-ok">${svg('trash')}Eliminar perfil</button></div>`);
  $('#pp-delete-ok').onclick = async () => {
    const b = $('#pp-delete-ok'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Eliminando…';
    try { await api('/api/project-profiles/delete', { id }); S.projectProfiles = S.projectProfiles.filter((x) => x.id !== id); toast('Perfil eliminado'); loadProjectProfileList(); }
    catch (e) { toast(e.message, true); b.disabled = false; }
  };
}

window.openProjectProfiles = async () => {
  profileEditorReturn = 'list';
  try { await loadProjectProfileList(); } catch (e) { toast(e.message || 'No se pudieron abrir los perfiles', true); }
};
window.openProjectProfileEditor = (profile, id) => { profileEditorReturn = 'launch'; editProjectProfile(profile, id); };
$('#btn-project-profiles').onclick = () => window.openProjectProfiles();
