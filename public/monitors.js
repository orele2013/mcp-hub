'use strict';
// Monitores de webs y APIs: comprobaciones periódicas, avisos de caída y, si quieres, un agente que investiga la causa.
let MON = [];
async function loadMonitors() {
  try { ({ monitors: MON } = await api('/api/monitors')); } catch (e) { return toast(e.message, true); }
  $('#count-monitors').textContent = MON.filter((m) => m.state === 'down').length || '';
  $('#count-monitors').classList.toggle('badge', MON.some((m) => m.state === 'down'));
  if (currentView === 'monitors') renderMonitors();
}
VIEW_LOADERS.monitors = loadMonitors;
document.addEventListener('hub:monitors', () => { clearTimeout(window.monT); window.monT = setTimeout(loadMonitors, 300); });
setTimeout(loadMonitors, 1500);

const pct = (h) => (h.length ? Math.round((h.filter((x) => x.ok).length / h.length) * 1000) / 10 : null);
function renderMonitors() {
  $('#monitors-body').innerHTML = `<header class="page-head"><div><h1>Monitores</h1><p class="sub">Comprueba tus webs y APIs cada pocos minutos. Si una cae (2 fallos seguidos) te avisa y, si quieres, un agente investiga la causa y te propone el arreglo.</p></div>
      <div class="actions"><button class="btn primary" id="mo-new">${svg('plus')}Nuevo monitor</button></div></header>
    ${MON.length ? `<div class="mon-list">${MON.map((m) => { const last = m.history.at(-1); const up = pct(m.history);
      return `<div class="card mon ${m.state}" data-mon="${m.id}"><div class="mon-head"><span class="dot ${m.state === 'up' ? 'ok' : m.state === 'down' ? 'err' : ''}"></span><b>${esc(m.name)}</b>
        <span class="hint mono">${esc(m.url)}</span><span class="grow"></span><span class="pill ${m.state === 'up' ? 'ok' : m.state === 'down' ? 'err' : ''}">${{ up: 'Funciona', down: 'Caído', unknown: 'Sin comprobar' }[m.state]}</span></div>
        <div class="mon-meta hint">cada ${m.every} min${!m.enabled ? ' · <b>pausado</b>' : ''}${last ? ` · última: ${new Date(last.at).toLocaleTimeString('es-ES')}, ${last.ms} ms${last.status ? `, código ${last.status}` : ''}${last.error ? ` · ${esc(last.error)}` : ''}` : ''}${up != null ? ` · ${up}% de comprobaciones correctas (últimas ${m.history.length})` : ''}${m.investigate ? ` · investiga ${esc(clientName(m.investigate.agent))}` : ''}</div>
        ${sparkline(m.history.slice(-60))}
        ${m.incident ? `<p class="errtxt">Caído desde ${new Date(m.incident.since).toLocaleString('es-ES')}: ${esc(m.incident.error || '')}${m.incident.job ? ` · investigación: encargo ${esc(m.incident.job)}` : ''}${m.incident.diagnosis ? `<br>Diagnóstico: ${esc(m.incident.diagnosis)}` : ''}</p>` : ''}
        ${m.incidents?.length ? `<details><summary class="hint">Incidentes anteriores (${m.incidents.length})</summary>${m.incidents.map((i) => `<p class="hint">${new Date(i.since).toLocaleString('es-ES')} → ${new Date(i.until).toLocaleTimeString('es-ES')} (${Math.max(1, Math.round((i.until - i.since) / 60000))} min) · ${esc(i.error || '')}${i.diagnosis ? ` · ${esc(i.diagnosis)}` : ''}</p>`).join('')}</details>` : ''}
        <div class="jactions"><button class="btn sm" data-mo="check">Comprobar ahora</button><button class="btn sm" data-mo="edit">Editar</button>${m.incident?.job ? '<button class="btn sm" data-mo="job">Ver investigación</button>' : ''}<button class="btn sm danger" data-mo="del">Borrar</button></div></div>`; }).join('')}</div>`
      : '<p class="sub">Todavía no hay monitores. Añade la URL de tu web o de un endpoint de salud (por ejemplo <code>https://mi-app.com/health</code>).</p>'}`;
  $('#mo-new').onclick = () => editMonitor();
  $$('#monitors-body [data-mo]').forEach((b) => (b.onclick = async () => {
    const m = MON.find((x) => x.id === b.closest('[data-mon]').dataset.mon);
    try {
      if (b.dataset.mo === 'edit') return editMonitor(m);
      if (b.dataset.mo === 'job') { show('agents'); setTimeout(() => { dFilter = 'history'; renderDelegations(); $(`#delegations [data-id="${m.incident.job}"]`)?.scrollIntoView({ block: 'center' }); }, 600); return; }
      if (b.dataset.mo === 'del') { await api('/api/monitors/delete', { id: m.id }); return loadMonitors(); }
      b.disabled = true; const r = await api('/api/monitors/check', { id: m.id }); toast(r.ok ? `Funciona (${r.ms} ms)` : `Falla: ${r.error}`, !r.ok); loadMonitors();
    } catch (e) { toast(e.message, true); }
  }));
}
function editMonitor(m = {}) {
  const ag = (S.clients || []).filter((c) => c.installed);
  const inv = m.investigate || {};
  modal(`<div class="mhead"><div><small>Monitores</small><h2>${m.id ? 'Editar monitor' : 'Nuevo monitor'}</h2></div></div>
    <div class="form">
      <label>URL<input id="mo-url" class="field mono" value="${esc(m.url || '')}" placeholder="https://mi-app.com/health"></label>
      <div class="row"><label>Nombre<input id="mo-name" class="field" value="${esc(m.name || '')}" placeholder="Mi web"></label><label>Cada (min)<input id="mo-every" class="field" type="number" min="1" value="${m.every || 5}"></label></div>
      <div class="row"><label>Método<select id="mo-method" class="field"><option ${m.method !== 'HEAD' ? 'selected' : ''}>GET</option><option ${m.method === 'HEAD' ? 'selected' : ''}>HEAD</option></select></label>
        <label>Códigos válidos<input id="mo-status" class="field mono" value="${esc(m.expectStatus || '200-399')}"></label><label>Espera (s)<input id="mo-timeout" class="field" type="number" min="2" max="60" value="${m.timeoutSec || 10}"></label></div>
      <label>Debe contener el texto <span class="hint">opcional (solo GET)</span><input id="mo-text" class="field" value="${esc(m.expectText || '')}"></label>
      <label class="check" style="align-self:flex-start"><input type="checkbox" id="mo-en" ${m.enabled !== false ? 'checked' : ''}>Activo${tick}</label>
      <div class="flabel">Si se cae, que un agente investigue</div>
      <div class="row"><label>Agente<select id="mo-agent" class="field"><option value="">No investigar</option>${ag.map((c) => `<option value="${c.id}" ${c.id === inv.agent ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label>Permisos<select id="mo-perm" class="field"><option value="read" ${inv.permission !== 'edit' && inv.permission !== 'full' ? 'selected' : ''}>Solo diagnosticar</option><option value="edit" ${inv.permission === 'edit' ? 'selected' : ''}>Puede editar archivos</option><option value="full" ${inv.permission === 'full' ? 'selected' : ''}>Sin límites</option></select></label></div>
      <label>Carpeta del proyecto (código, configuración, logs)<input id="mo-cwd" class="field mono" value="${esc(tilde(inv.cwd || S.recentDirs?.[0] || S.home))}"></label>
      <span class="hint">Se lanza un encargo por incidente; te llega el diagnóstico por Mensajería. Si la URL lleva claves, se guardan con permisos 600 y se muestran ocultas.</span>
    </div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="mo-ok">Guardar y comprobar</button></div>`);
  $('#mo-ok').onclick = async () => {
    try {
      await api('/api/monitors/save', { id: m.id, url: $('#mo-url').value.trim(), name: $('#mo-name').value, every: $('#mo-every').value, method: $('#mo-method').value, expectStatus: $('#mo-status').value.trim(),
        timeoutSec: $('#mo-timeout').value, expectText: $('#mo-text').value, enabled: $('#mo-en').checked,
        investigate: $('#mo-agent').value ? { agent: $('#mo-agent').value, permission: $('#mo-perm').value, cwd: $('#mo-cwd').value.trim().replace(/^~(?=$|\/)/, S.home) } : null });
      closeModal(); toast('Monitor guardado'); setTimeout(loadMonitors, 1500); loadMonitors();
    } catch (e) { toast(e.message, true); }
  };
}
