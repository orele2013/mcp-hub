'use strict';
// Integraciones: calendario (iCal), GitHub (gh), Home Assistant y el MCP "mcp-hub-extras" para los agentes.
const IG = { cal: null, gh: null, ha: null, haFound: null };
async function loadIntegrations() {
  const [cal, gh, ha] = await Promise.allSettled([api('/api/calendar?days=7'), api('/api/github/status'), api('/api/ha')]);
  IG.cal = cal.value || { sources: [], events: [], error: cal.reason?.message };
  IG.gh = gh.value || { ok: false, text: gh.reason?.message };
  IG.ha = ha.value || null;
  renderIntegrations();
}
VIEW_LOADERS.integrations = loadIntegrations;
document.addEventListener('hub:ha', () => { if (currentView === 'integrations') { clearTimeout(IG.t); IG.t = setTimeout(async () => { IG.ha = await api('/api/ha').catch(() => IG.ha); renderIntegrations(); }, 300); } });

const dayName = (t) => new Date(t).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
function calHtml() {
  const c = IG.cal;
  const byDay = {};
  for (const e of c.events || []) (byDay[new Date(e.start).toDateString()] ||= []).push(e);
  return `<div class="card integ"><div class="head">${svg('clock')}<div><b>Calendario</b><small>Tus agentes consultan tu agenda y las tareas programadas pueden esperar a que termines</small></div></div>
    ${c.busyNow ? `<p class="pill warn">Ocupado ahora: ${esc(c.busyNow.title)} (hasta ${new Date(c.busyNow.end).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })})</p>` : ''}
    ${(c.sources || []).map((s) => `<div class="urow"><span>${esc(s.name)} <span class="hint mono">${esc(s.url)}</span>${s.error ? ` <span class="errtxt">${esc(s.error)}</span>` : s.count != null ? ` <span class="hint">· ${s.count} eventos</span>` : ''}</span><button class="btn sm danger" data-cal-del="${s.id}">Quitar</button></div>`).join('')}
    <details ${c.sources?.length ? '' : 'open'}><summary class="hint">Añadir un calendario</summary><div class="form">
      <p class="hint">En Google Calendar: ⚙ Configuración → elige tu calendario → <b>Integrar el calendario</b> → copia la <b>Dirección secreta en formato iCal</b>. (Outlook, iCloud y otros también dan una dirección .ics.) Es secreta: se guarda con permisos 600 y no se muestra entera.</p>
      <div class="row"><input id="cal-name" class="field" placeholder="Nombre (Personal, Trabajo…)" style="max-width:200px"><input id="cal-url" class="field mono" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"><button class="btn primary" id="cal-add">Añadir</button></div></div></details>
    ${c.sources?.length ? `<label class="check" style="margin:6px 0"><input type="checkbox" id="cal-allday" ${c.allDayBusy ? 'checked' : ''}>Los eventos de todo el día cuentan como ocupado${tick}</label>
      <div class="flabel">Próximos 7 días</div>${Object.keys(byDay).length ? Object.entries(byDay).map(([d, evs]) => `<div class="cal-day"><b>${dayName(evs[0].start)}</b>${evs.map((e) => `<div class="cal-ev ${e.free ? 'free' : ''}"><span class="mono">${e.allDay ? 'todo el día' : `${new Date(e.start).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}–${new Date(e.end).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}</span> ${esc(e.title)}${e.location ? ` <span class="hint">· ${esc(e.location)}</span>` : ''}</div>`).join('')}</div>`).join('') : '<p class="hint">Sin eventos.</p>'}` : ''}
  </div>`;
}
function ghHtml() {
  return `<div class="card integ"><div class="head">${logo('github', 32)}<div><b>GitHub</b><small>Issues que se convierten en encargos o tarjetas, y PRs con la revisión independiente adjunta</small></div></div>
    <p class="${IG.gh.ok ? 'hint' : 'errtxt'}">${esc(IG.gh.text)}</p>
    ${IG.gh.ok ? `<div class="jactions"><button class="btn" id="gh-issues">Ver issues de un repositorio</button></div>
      <p class="hint">Usa tu sesión de la CLI <code>gh</code> (MCP Hub no guarda tokens). Crear un PR sube la rama del encargo a GitHub: solo ocurre cuando pulsas “Crear PR” en un encargo aislado o en una tarjeta.</p>` : ''}
  </div>`;
}
function haHtml() {
  const h = IG.ha; if (!h) return '';
  const f = IG.haFound;
  const opt = (list, sel, none = '— Ninguno —') => `<option value="">${none}</option>${(list || []).map((x) => `<option value="${esc(x.id || x)}" ${(x.id || x) === sel ? 'selected' : ''}>${esc(x.name || x)}${x.state ? ` (${esc(x.state)})` : ''}</option>`).join('')}${sel && !(list || []).some((x) => (x.id || x) === sel) ? `<option value="${esc(sel)}" selected>${esc(sel)}</option>` : ''}`;
  const TY = { approvals: 'Aprobaciones', monitors: 'Monitores', shadow: 'Agente sombra', jobs: 'Encargos', security: 'Seguridad', schedules: 'Tareas programadas', design: 'Diseño', sessions: 'Sesiones' };
  return `<div class="card integ"><div class="head">${svg('bolt')}<div><b>Home Assistant</b><small>Avisos en el móvil, una luz o un altavoz; y pausa la cola de encargos cuando sales de casa</small></div>
      <span class="grow"></span>${h.enabled ? `<span class="pill ${h.state.error ? 'err' : 'ok'}">${h.state.error ? 'Error' : 'Activo'}</span>` : '<span class="pill">Desactivado</span>'}</div>
    ${h.state.error ? `<p class="errtxt">${esc(h.state.error)}</p>` : ''}${h.state.away ? '<p class="pill warn">Fuera de casa: los encargos nuevos esperan en la cola</p>' : ''}
    <div class="form">
      <div class="row"><label>URL<input id="ha-url" class="field mono" value="${esc(h.url)}" placeholder="http://homeassistant.local:8123"></label>
        <label>Token de acceso de larga duración<input id="ha-token" class="field mono" type="password" value="${esc(h.token)}" placeholder="Perfil → Seguridad → Crear token"></label></div>
      <div class="jactions"><button class="btn sm" id="ha-test">Probar conexión</button><button class="btn sm" id="ha-disc">Buscar entidades</button></div>
      <div class="row"><label>Notificación (servicio notify.*)<select id="ha-notify" class="field">${opt(f?.notify?.map((x) => ({ id: x, name: x })), h.notifyService)}</select></label>
        <label>Luz que parpadea<select id="ha-light" class="field">${opt(f?.lights, h.light.entity)}</select></label></div>
      <div class="row"><label>Voz: motor TTS<select id="ha-tts" class="field">${opt(f?.tts, h.tts.entity)}</select></label><label>Altavoz<select id="ha-player" class="field">${opt(f?.players, h.tts.player)}</select></label></div>
      <div class="flabel">Qué avisos se envían a Home Assistant <span class="hint">(se respetan las horas de silencio de Mensajería)</span></div>
      <div class="checks">${h.typeList.map((t) => `<label class="check"><input type="checkbox" data-hat="${t}" ${h.types[t] ? 'checked' : ''}>${TY[t] || t}${tick}</label>`).join('')}</div>
      <div class="row"><label>Presencia (persona o dispositivo)<select id="ha-person" class="field">${opt(f?.people, h.presence.entity)}</select></label></div>
      <label class="check" style="align-self:flex-start"><input type="checkbox" id="ha-away" ${h.presence.pauseAway ? 'checked' : ''}>Al salir de casa, pausar la cola de encargos (los que están en marcha siguen)${tick}</label>
      <label class="check" style="align-self:flex-start"><input type="checkbox" id="ha-en" ${h.enabled ? 'checked' : ''}>Activar la integración${tick}</label>
      ${h.state.lastPresence ? `<span class="hint">Presencia ahora: ${esc(h.state.lastPresence)}</span>` : ''}
    </div>
    <div class="jactions"><button class="btn primary" id="ha-save">Guardar</button><button class="btn" id="ha-send">Enviar aviso de prueba</button></div>
  </div>`;
}
function extrasHtml() {
  const reg = S.servers['mcp-hub-extras'];
  return `<div class="card integ"><div class="head">${logo('agents', 32)}<div><b>MCP para tus agentes</b><small><code>mcp-hub-extras</code>: agenda, tablero, mapa del proyecto y monitores</small></div><span class="grow"></span>${reg ? '<span class="pill ok">Conectado</span>' : ''}</div>
    <p class="hint">Herramientas: <code>calendar_events</code>, <code>calendar_free_slots</code>, <code>calendar_busy_now</code>, <code>board_list</code>, <code>board_add</code>, <code>project_map</code> y <code>monitors_status</code>. Los agentes ven tus eventos, nunca la URL secreta del calendario.</p>
    <div class="jactions"><button class="btn ${reg ? '' : 'primary'}" id="ex-reg">${reg ? 'Cambiar agentes' : 'Conectar a mis agentes'}</button></div></div>`;
}
function renderIntegrations() {
  $('#integrations-body').innerHTML = `<header class="page-head"><div><h1>Integraciones</h1><p class="sub">Conecta MCP Hub con tu calendario, GitHub y tu casa.</p></div></header>
    <div class="integ-grid">${calHtml()}${ghHtml()}${haHtml()}${extrasHtml()}</div>`;
  const reload = () => loadIntegrations();
  $('#cal-add')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { const r = await api('/api/calendar/add', { name: $('#cal-name').value, url: $('#cal-url').value }); toast(`Calendario añadido (${r.count} eventos)`); reload(); }
    catch (err) { toast(err.message, true); e.target.disabled = false; }
  });
  $$('[data-cal-del]').forEach((b) => (b.onclick = async () => { await api('/api/calendar/remove', { id: b.dataset.calDel }); reload(); }));
  $('#cal-allday')?.addEventListener('change', async (e) => { await api('/api/calendar/options', { allDayBusy: e.target.checked }); reload(); });
  $('#gh-issues')?.addEventListener('click', () => githubIssues());
  const haBody = () => ({ url: $('#ha-url').value, token: $('#ha-token').value, notifyService: $('#ha-notify').value, light: { entity: $('#ha-light').value },
    tts: { entity: $('#ha-tts').value, player: $('#ha-player').value }, types: Object.fromEntries($$('[data-hat]').map((i) => [i.dataset.hat, i.checked])),
    presence: { entity: $('#ha-person').value, pauseAway: $('#ha-away').checked }, enabled: $('#ha-en').checked });
  $('#ha-save')?.addEventListener('click', async () => { try { IG.ha = await api('/api/ha/config', haBody()); toast('Home Assistant guardado'); renderIntegrations(); } catch (e) { toast(e.message, true); } });
  $('#ha-test')?.addEventListener('click', async () => { try { await api('/api/ha/config', { ...haBody(), enabled: IG.ha.enabled }); toast((await api('/api/ha/test')).message); } catch (e) { toast(e.message, true); } });
  $('#ha-disc')?.addEventListener('click', async () => { try { await api('/api/ha/config', { ...haBody(), enabled: IG.ha.enabled }); IG.haFound = await api('/api/ha/discover'); IG.ha = await api('/api/ha'); renderIntegrations(); toast('Entidades cargadas'); } catch (e) { toast(e.message, true); } });
  $('#ha-send')?.addEventListener('click', async () => { try { const r = await api('/api/ha/send-test'); toast(`Enviado: ${r.done.join(', ')}`); } catch (e) { toast(e.message, true); } });
  $('#ex-reg').onclick = () => {
    const cur = S.servers['mcp-hub-extras']?.targets;
    modal(`<div class="mhead">${logo('agents', 44)}<div><small>Servidor MCP</small><h2>mcp-hub-extras</h2></div></div>
      <p class="sub" style="margin-top:12px">Añade las herramientas de agenda, tablero, mapa del proyecto y monitores a los agentes que elijas.</p>
      <div class="form"><div class="flabel">Agentes${targetsChecks(cur || null)}</div></div>
      <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="exr-ok">Conectar</button></div>`);
    $('#exr-ok').onclick = async () => { try { reportErrors((await api('/api/extras/register', { targets: readTargets() })).errors) && toast('Conectado'); closeModal(); await refresh(); renderIntegrations(); } catch (e) { toast(e.message, true); } };
  };
}
