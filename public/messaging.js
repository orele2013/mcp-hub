'use strict';
// Mensajería: los agentes te avisan y te preguntan por Telegram, email, Discord o Slack; tú respondes o controlas las sesiones.
Object.assign(ICONS, {
  mail: 'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM3.5 7l8.5 6 8.5-6',
  chat: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  send: 'M4 12 20 4l-4 16-4-7-8-1ZM12 13l8-9',
});
Object.assign(LOGOS, {
  messaging: { icon: 'chat' }, telegram: IMG('telegram'), discord: IMG('discord'), slack: IMG('slack'), email: { icon: 'mail' }, gmail: IMG('gmail'),
});

const CH = {
  telegram: {
    name: 'Telegram', desc: 'Un bot tuyo te escribe y le respondes desde el móvil. Lo más rápido de configurar.',
    who: (c) => c.chatName || (c.chatId ? `chat ${c.chatId}` : ''),
    steps: ['En Telegram abre <a href="https://t.me/BotFather" target="_blank">@BotFather</a>, envía <code>/newbot</code> y copia el token que te da.',
      'Pega el token aquí, abre tu bot nuevo en Telegram y pulsa <b>Iniciar</b>.', 'Pulsa <b>Detectar</b> para enlazar tu chat.'],
    fields: [['token', 'Token del bot', 'password', '123456:ABC-…'], ['chatId', 'Tu chat', 'text', 'Pulsa Detectar']],
  },
  email: {
    name: 'Email', desc: 'Avisos y preguntas a tu correo; contestas respondiendo al email.',
    who: (c) => c.to || '',
    steps: ['Usa una cuenta para enviar (mejor una secundaria) con una <b>contraseña de aplicación</b>. En Gmail: <a href="https://myaccount.google.com/apppasswords" target="_blank">myaccount.google.com/apppasswords</a> (requiere verificación en dos pasos).',
      'En “Enviar a” pon tu correo personal. Solo se aceptan respuestas que vengan de esa dirección.'],
    fields: [['address', 'Cuenta que envía', 'email', 'tucuenta@gmail.com'], ['password', 'Contraseña de aplicación', 'password', ''],
      ['to', 'Enviar a (tu correo)', 'email', 'tu@correo.com'], ['smtpHost', 'Servidor SMTP', 'text', 'smtp.gmail.com'], ['smtpPort', 'Puerto SMTP', 'text', '465'],
      ['imapHost', 'Servidor IMAP', 'text', 'imap.gmail.com'], ['imapPort', 'Puerto IMAP', 'text', '993']],
    presets: { Gmail: { smtpHost: 'smtp.gmail.com', smtpPort: '465', imapHost: 'imap.gmail.com', imapPort: '993' },
      Outlook: { smtpHost: 'smtp-mail.outlook.com', smtpPort: '587', imapHost: 'outlook.office365.com', imapPort: '993' },
      iCloud: { smtpHost: 'smtp.mail.me.com', smtpPort: '587', imapHost: 'imap.mail.me.com', imapPort: '993' } },
  },
  discord: {
    name: 'Discord', desc: 'Un bot te escribe por mensaje directo.',
    who: (c) => (c.userId ? `usuario ${c.userId}` : ''),
    steps: ['Crea una app en el <a href="https://discord.com/developers/applications" target="_blank">Developer Portal</a> → <b>Bot</b> → <b>Reset Token</b> y cópialo.',
      'Invita el bot a un servidor donde estés tú (OAuth2 → URL Generator → <code>bot</code>). Discord solo deja escribirte a bots con los que compartes servidor.',
      'Tu ID: Ajustes → Avanzado → <b>Modo desarrollador</b>, luego clic derecho en tu nombre → <b>Copiar ID de usuario</b>.'],
    fields: [['token', 'Token del bot', 'password', ''], ['userId', 'Tu ID de usuario', 'text', '123456789012345678']],
  },
  slack: {
    name: 'Slack', desc: 'Una app de Slack te escribe por mensaje directo.',
    who: (c) => (c.userId ? `miembro ${c.userId}` : ''),
    steps: ['Crea una app en <a href="https://api.slack.com/apps" target="_blank">api.slack.com/apps</a>. En <b>OAuth &amp; Permissions</b> añade los permisos <code>chat:write</code>, <code>im:write</code> e <code>im:history</code>, e instálala en tu workspace.',
      'En <b>App Home</b> activa la pestaña <b>Messages</b> y “Allow users to send…”.', 'Copia el <b>Bot User OAuth Token</b> (<code>xoxb-…</code>) y tu ID de miembro (tu perfil → ⋮ → <b>Copiar ID de miembro</b>).'],
    fields: [['token', 'Bot token', 'password', 'xoxb-…'], ['userId', 'Tu ID de miembro', 'text', 'U0123ABCD']],
  },
};
const chLogo = (id, c, size) => logo(id === 'email' && /gmail/.test(c?.smtpHost || '') ? 'gmail' : id, size);

let M = { channels: {}, log: [], pending: [], inbox: [] };
async function loadMessaging() {
  try { M = await api('/api/messaging'); } catch (e) { return toast(e.message, true); }
  const n = Object.values(M.channels).filter((c) => c.enabled).length;
  $('#count-messaging').textContent = M.pending.length || n || '';
  $('#count-messaging').classList.toggle('badge', !!M.pending.length);
  if (currentView === 'messaging') renderMessaging();
}

function statusPill(c) {
  const st = c.status?.state;
  if (!c.enabled) return '<span class="pill">Apagado</span>';
  if (st === 'on') return `<span class="pill ok">${svg('check')}Activo</span>`;
  if (st === 'error') return `<span class="pill err" title="${esc(c.status.error)}">${svg('warn')}Error</span>`;
  return '<span class="pill warn">Conectando…</span>';
}

function renderMessaging() {
  const box = $('#messaging-body');
  const on = Object.entries(M.channels).filter(([, c]) => c.enabled).map(([id]) => id);
  const sessions = (S.sessions || []).filter((s) => !s.exited);
  const when = (t) => new Date(t).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  box.innerHTML = `
    <header class="page-head">
      <div><h1>Mensajería</h1><p class="sub">Tus agentes te avisan y te preguntan por Telegram, email, Discord o Slack. Tú respondes, o les escribes y ves sus sesiones desde el móvil.</p></div>
      <div class="actions"><button class="btn ${M.registered ? '' : 'primary'}" id="m-register">${logo('messaging', 18, { plain: true })}${M.registered ? 'Agentes conectados' : 'Conectar a agentes'}</button></div>
    </header>
    ${M.registered ? '' : `<div class="callout">${logo('messaging', 36)}<span class="txt"><b>Conecta la Mensajería a tus agentes.</b> Se añade el servidor MCP <code>mcp-hub-messaging</code> con <code>send_message</code> (avisarte), <code>ask_user</code> (preguntarte y esperar tu respuesta) y <code>read_messages</code> (leer lo que les escribas).</span><button class="btn primary sm" id="m-register2">Conectar</button></div>`}
    <h2 class="section-title">Canales</h2>
    <div class="grid msg">${Object.entries(CH).map(([id, d]) => {
      const c = M.channels[id] || {};
      const who = d.who(c);
      return `<article class="card channel ${c.enabled ? 'on' : ''}" data-ch="${id}">
        <div class="head">${chLogo(id, c, 44)}<div><b>${d.name}${M.primary === id && c.enabled ? ' <span class="tag">Principal</span>' : ''}</b><small>${esc(who || 'Sin configurar')}</small></div>${statusPill(c)}</div>
        <p>${c.status?.state === 'error' && c.enabled ? `<span class="errtxt">${esc(c.status.error)}</span>` : d.desc}</p>
        <div class="foot"><div class="btns">
          <button class="btn sm" data-m="config">${svg('edit')}Configurar</button>
          ${c.enabled ? `<button class="btn sm" data-m="test">${svg('send')}Probar</button>` : ''}
          ${c.enabled && M.primary !== id ? `<button class="btn sm" data-m="primary">Hacer principal</button>` : ''}
        </div>
        <button class="sw" aria-pressed="${!!c.enabled}" aria-label="Activar ${d.name}" data-m="toggle"><span class="track"><span class="knob"></span></span></button></div>
      </article>`;
    }).join('')}</div>

    <h2 class="section-title">Cómo se usa</h2>
    <div class="grid msg-opts">
      <div class="card"><b>Tus mensajes van a</b>
        <select class="field" id="m-target"><option value="">Bandeja de los agentes (read_messages)</option>
          ${sessions.map((s, i) => `<option value="${s.id}" ${M.target === s.id ? 'selected' : ''}>${i + 1}. ${esc(s.title)}</option>`).join('')}</select>
        <span class="hint">Si eliges una sesión, lo que escribas se teclea en ella. También puedes cambiarlo desde el chat con <code>/usar n</code>.</span></div>
      <div class="card"><b>Qué te aviso</b>${M.quietNow ? ' <span class="pill">Horas de silencio ahora</span>' : ''}
        <div class="checks">${[['sessions', 'Sesiones terminadas'], ['jobs', 'Encargos (largos o con cambios por revisar)'], ['approvals', 'Aprobaciones pendientes'], ['schedules', 'Errores de tareas programadas'], ['design', 'Diseños largos terminados'], ['security', 'Seguridad (dispositivos nuevos, intentos de acceso)'], ['monitors', 'Monitores (caídas y recuperaciones)'], ['shadow', 'Avisos del agente sombra']]
          .map(([k, l]) => `<label class="check"><input type="checkbox" data-rule="${k}" ${M.rules?.types?.[k] !== false ? 'checked' : ''}>${l}${tick}</label>`).join('')}</div>
        <div class="row qrow"><label class="check"><input type="checkbox" id="m-quiet" ${M.rules?.quiet?.enabled ? 'checked' : ''}>Horas de silencio${tick}</label>
          <input type="time" class="field sm" id="m-qfrom" value="${esc(M.rules?.quiet?.from || '23:00')}" aria-label="Desde"><span>a</span><input type="time" class="field sm" id="m-qto" value="${esc(M.rules?.quiet?.to || '08:00')}" aria-label="Hasta"></div>
        <label class="check"><input type="checkbox" id="m-urgent" ${M.rules?.urgentInQuiet !== false ? 'checked' : ''}>Las aprobaciones y los avisos de seguridad llegan también en horas de silencio${tick}</label>
      </div>
      <div class="card"><b>Comandos</b>
        <span class="hint">Comandos en el chat: <code>/sesiones</code>, <code>/ver n</code>, <code>/usar n</code>, <code>/s n texto</code>, <code>/preguntas</code>, <code>/encargos</code>, <code>/aprobar id</code>, <code>/denegar id</code>, <code>/soltar</code>, <code>/ayuda</code>.</span></div>
    </div>

    ${M.pending.length ? `<h2 class="section-title">Preguntas sin responder</h2><div class="log qlist">${M.pending.map((q) => `<div><span class="when">${when(q.at)}</span><span>${esc(q.label)} · #${q.id}</span><span>${esc(q.question)}</span></div>`).join('')}</div>` : ''}

    <h2 class="section-title">Conversación</h2>
    ${on.length ? `<div class="composer"><input class="field" id="m-text" placeholder="Escribir un mensaje de prueba a ${esc(CH[M.primary]?.name || '')}…"><button class="btn" id="m-send">${svg('send')}Enviar</button></div>` : ''}
    ${M.log.length ? `<div class="log chatlog">${M.log.map((l) => `<div class="${l.dir}"><span class="when">${when(l.at)}</span><span>${logo(l.channel, 16, { plain: true })} ${esc(l.dir === 'in' ? '→ ' + (l.from || 'tú') : l.from || 'MCP Hub')}</span><span>${esc(l.text)}</span></div>`).join('')}</div>`
      : `<div class="empty-state">${logo('messaging', 48)}<p><b>Aún no hay mensajes</b></p><p>Activa un canal y pulsa <b>Probar</b>.</p></div>`}`;

  $('#m-register').onclick = registerMessaging;
  $('#m-register2')?.addEventListener('click', registerMessaging);
  $('#m-target').onchange = async (e) => { M = await api('/api/messaging/target', { id: e.target.value }); toast(e.target.value ? 'Tus mensajes irán a esa sesión' : 'Tus mensajes irán a la bandeja'); };
  const saveRules = async () => {
    try {
      M = await api('/api/messaging/rules', { types: Object.fromEntries($$('[data-rule]').map((i) => [i.dataset.rule, i.checked])),
        quiet: { enabled: $('#m-quiet').checked, from: $('#m-qfrom').value, to: $('#m-qto').value }, urgentInQuiet: $('#m-urgent').checked });
      toast('Reglas de avisos guardadas');
    } catch (e) { toast(e.message, true); }
  };
  $$('[data-rule], #m-quiet, #m-qfrom, #m-qto, #m-urgent').forEach((el) => (el.onchange = saveRules));
  const sendNow = async () => {
    const t = $('#m-text').value.trim(); if (!t) return;
    try { await api('/api/messaging/send', { text: t }); $('#m-text').value = ''; loadMessaging(); } catch (e) { toast(e.message, true); }
  };
  $('#m-send')?.addEventListener('click', sendNow);
  $('#m-text')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendNow(); });
  $$('#messaging-body [data-m]').forEach((b) => (b.onclick = async () => {
    const id = b.closest('[data-ch]').dataset.ch, c = M.channels[id];
    try {
      if (b.dataset.m === 'config') return editChannel(id);
      if (b.dataset.m === 'toggle') {
        if (!c.enabled && !isConfigured(id, c)) return editChannel(id, true);
        M = await api('/api/messaging/channel', { id, config: { enabled: !c.enabled } }); return renderMessaging();
      }
      if (b.dataset.m === 'primary') { M = await api('/api/messaging/settings', { primary: id }); return renderMessaging(); }
      if (b.dataset.m === 'test') { b.disabled = true; await api('/api/messaging/test', { id }); toast(`Mensaje de prueba enviado por ${CH[id].name}`); loadMessaging(); }
    } catch (e) { toast(e.message, true); loadMessaging(); } finally { b.disabled = false; }
  }));
}
const isConfigured = (id, c) => CH[id].fields.filter(([k]) => !/Port$/.test(k)).every(([k]) => c[k]);

function editChannel(id, enable = false) {
  const d = CH[id], c = M.channels[id] || {};
  modal(`<div class="mhead">${chLogo(id, c, 44)}<div><small>Mensajería</small><h2>${d.name}</h2></div></div>
    <ol class="steps">${d.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
    <div class="form">
      ${d.presets ? `<div class="seg" id="mc-preset">${Object.keys(d.presets).map((p) => `<button type="button" data-p="${p}">${p}</button>`).join('')}<button type="button" data-p="">Otro</button></div>` : ''}
      ${d.fields.map(([k, label, type, ph]) => `${/Host$/.test(k) ? '<div class="row">' : ''}<label ${/Port$/.test(k) ? 'style="max-width:120px"' : ''}>${label}${k === 'chatId'
        ? `<div class="pw-row"><input id="mc-${k}" class="field mono" value="${esc(c[k] || '')}" placeholder="${esc(ph)}"><button type="button" class="btn" id="mc-detect">Detectar</button></div>`
        : `<input id="mc-${k}" type="${type}" class="field ${type === 'password' || /Host|Port|Id/.test(k) ? 'mono' : ''}" value="${esc(c[k] || (k === 'smtpHost' || k === 'imapHost' || /Port$/.test(k) ? ph : ''))}" placeholder="${esc(ph)}" autocomplete="off">`}</label>${/Port$/.test(k) ? '</div>' : ''}`).join('')}
      ${id === 'telegram' ? `<span class="hint" id="mc-chatname">${esc(c.chatName || '')}</span>` : ''}
      <label class="check" style="align-self:flex-start"><input type="checkbox" id="mc-enabled" ${c.enabled || enable ? 'checked' : ''}>Activar ${d.name}${tick}</label>
    </div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="mc-save">Guardar</button></div>`);
  let chatName = c.chatName || '';
  $$('#mc-preset button').forEach((b) => (b.onclick = () => {
    $$('#mc-preset button').forEach((x) => x.classList.toggle('on', x === b));
    for (const [k, v] of Object.entries(d.presets[b.dataset.p] || {})) $(`#mc-${k}`).value = v;
  }));
  const host = $('#mc-smtpHost')?.value || '';
  $(`#mc-preset button[data-p="${Object.keys(d.presets || {}).find((p) => d.presets[p].smtpHost === host) ?? ''}"]`)?.classList.add('on');
  $('#mc-detect')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { const r = await api('/api/messaging/detect-telegram', { token: $('#mc-token').value }); $('#mc-chatId').value = r.chatId; chatName = r.name; $('#mc-chatname').textContent = `Enlazado con ${r.name}`; }
    catch (err) { toast(err.message, true); } finally { e.target.disabled = false; }
  });
  $('#mc-save').onclick = async () => {
    const config = Object.fromEntries(d.fields.map(([k]) => [k, $(`#mc-${k}`).value]));
    config.enabled = $('#mc-enabled').checked;
    if (id === 'telegram') config.chatName = chatName;
    try { M = await api('/api/messaging/channel', { id, config }); toast(`${d.name} guardado`); closeModal(); renderMessaging(); setTimeout(loadMessaging, 2500); }
    catch (e) { toast(e.message, true); }
  };
}

function registerMessaging() {
  const cur = S.servers['mcp-hub-messaging']?.targets;
  modal(`<div class="mhead">${logo('messaging', 44)}<div><small>Servidor MCP</small><h2>Conectar la Mensajería a los agentes</h2></div></div>
    <p class="sub" style="margin-top:12px">Añade <code>mcp-hub-messaging</code> a los agentes que elijas. Podrán avisarte (<code>send_message</code>), preguntarte y esperar tu respuesta (<code>ask_user</code>) y leer lo que les mandes (<code>read_messages</code>).</p>
    <div class="form"><div class="flabel">Conectar a${targetsChecks(cur || null)}</div>
    <span class="hint">MCP Hub tiene que estar abierto y con al menos un canal activo.</span></div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="mr-ok">Conectar</button></div>`);
  $('#mr-ok').onclick = async () => {
    try { reportErrors((await api('/api/messaging/register', { targets: readTargets() })).errors) && toast('Mensajería conectada a los agentes'); closeModal(); await refresh(); loadMessaging(); }
    catch (e) { toast(e.message, true); }
  };
}

loadMessaging();
