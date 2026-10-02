'use strict';
// Móvil y tablet: vincular dispositivos por QR y elegir cómo se conectan (Wi‑Fi de casa o Tailscale desde cualquier sitio).
Object.assign(ICONS, {
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM11 18h2',
  wifi: 'M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2zM6.5 6.5h1v1h-1zM16.5 6.5h1v1h-1zM6.5 16.5h1v1h-1z',
});
Object.assign(LOGOS, { phone: { icon: 'phone' }, tailscale: { icon: 'globe' }, wifi: { icon: 'wifi' } });

let R = { lan: {}, tailscale: {}, devices: [] };
async function loadRemote() {
  try { R = await api('/api/remote'); } catch (e) { return toast(e.message, true); }
  $('#count-remote').textContent = R.devices.length || '';
  if (currentView === 'remote') renderRemote();
}

function renderRemote() {
  const L = R.lan, T = R.tailscale;
  const when = (t) => (t ? new Date(t).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
  const anyOn = (L.enabled && L.running) || (T.enabled && T.running && T.serving);
  const tsBody = !T.installed
    ? `<p>Tailscale no está instalado. Ejecuta en una terminal (te pedirá tu contraseña):</p>
       <pre class="cmd">sudo pacman -S tailscale
sudo systemctl enable --now tailscaled
sudo tailscale up
sudo tailscale set --operator=${esc(T.user || '$USER')}</pre>
       <p class="hint">Después instala la app de Tailscale en el móvil, entra con la misma cuenta y vuelve aquí.</p>`
    : T.state !== 'Running'
      ? `<p>Tailscale está instalado pero no conectado (${esc(T.state)}). Ejecuta <code>sudo tailscale up</code> e inicia sesión.</p>`
      : `<p>Conectado como <code>${esc(T.dns)}</code>.${T.serving ? ' Publicado en tu red privada.' : ''}</p>
         ${T.enabled && !T.serving ? `<button class="btn primary sm" id="r-ts-serve">Publicar en Tailscale</button>` : ''}
         ${T.serving ? `<p class="mono hint">${esc(T.url)}</p>` : ''}`;
  $('#remote-body').innerHTML = `
    <header class="page-head">
      <div><h1>Móvil y tablet</h1><p class="sub">Usa MCP Hub desde el móvil o la tablet: la misma app adaptada a pantalla táctil. Todo se ejecuta en este ordenador.</p></div>
      <div class="actions"><button class="btn primary" id="r-pair" ${anyOn ? '' : 'disabled'}>${svg('qr')}Vincular dispositivo</button></div>
    </header>
    ${R.current ? `<div class="callout">${logo('phone', 36)}<span class="txt">Estás usando MCP Hub desde <b>${esc(R.devices.find((d) => d.id === R.current)?.name || 'este dispositivo')}</b>. Todo lo que hagas se ejecuta en el ordenador.</span></div>` : ''}
    <div class="grid rgrid">
      <article class="card rcard ${L.enabled ? 'on' : ''}">
        <div class="head">${logo('wifi', 44)}<div><b>En casa (Wi‑Fi)</b><small>Conexión directa por tu red local</small></div>
          <button class="sw" aria-pressed="${!!L.enabled}" aria-label="Activar Wi‑Fi" data-r="lan"><span class="track"><span class="knob"></span></span></button></div>
        ${L.enabled ? `${L.error ? `<p class="errtxt">${esc(L.error)}</p>` : ''}
          ${L.urls.map((u) => `<p class="mono">${esc(u)}</p>`).join('')}
          <p class="hint">El certificado es propio de este ordenador: la primera vez el móvil avisará de que la conexión “no es privada”. Comprueba que la huella empieza por <code>${esc((L.fingerprint || '').slice(0, 17))}</code> y continúa.</p>
          ${L.firewall ? `<p class="hint">Tu cortafuegos (ufw) está activo. Permite el acceso desde tu red una vez:</p><pre class="cmd">${esc(L.firewall)}</pre>` : ''}`
        : '<p>Sin instalar nada. Solo funciona cuando el móvil está en la misma Wi‑Fi que el ordenador.</p>'}
      </article>
      <article class="card rcard ${T.enabled ? 'on' : ''}">
        <div class="head">${logo('tailscale', 44)}<div><b>Desde cualquier sitio (Tailscale)</b><small>Red privada cifrada entre tus dispositivos</small></div>
          <button class="sw" aria-pressed="${!!T.enabled}" aria-label="Activar Tailscale" data-r="tailscale"><span class="track"><span class="knob"></span></span></button></div>
        ${T.enabled ? tsBody : '<p>Funciona fuera de casa, con HTTPS real y sin abrir nada a internet. Se puede instalar como app en el móvil.</p>'}
        ${T.enabled ? `<div class="rpass">${svg('lock')}<span>${T.passwordSet ? 'Contraseña de acceso configurada: se pide la primera vez en cada dispositivo.' : '<b>Configura una contraseña</b>: se pedirá la primera vez que un dispositivo entre por Tailscale.'}</span>
          <button class="btn sm ${T.passwordSet ? '' : 'primary'}" id="r-pass">${T.passwordSet ? 'Cambiar' : 'Configurar'}</button></div>` : ''}
        ${T.enabled && T.serving ? `<div class="rpass">${svg('globe')}<span>${T.funnel ? '<b>Abierto a internet (Funnel)</b>: la dirección funciona desde cualquier navegador, sin Tailscale. La protege la contraseña.' : 'Solo para dispositivos de tu red de Tailscale. Actívalo para abrirlo a cualquier navegador (Funnel).'}</span>
          <button class="sw" aria-pressed="${!!T.funnel}" aria-label="Abrir a internet" id="r-funnel"><span class="track"><span class="knob"></span></span></button></div>` : ''}
        ${T.enabled && T.error && T.installed ? `<p class="errtxt">${esc(T.error)}</p>` : ''}
      </article>
    </div>
    <h2 class="section-title">Dispositivos vinculados</h2>
    ${R.devices.length ? `<div class="log devlog">${R.devices.map((d) => `<div data-id="${d.id}"><span>${logo('phone', 28)}</span><span><b>${esc(d.name)}</b>${d.id === R.current ? ' <span class="tag">este</span>' : ''}<small>Vinculado ${when(d.created)} · última vez ${when(d.lastSeen)}${d.via ? ` · ${d.via === 'tailscale' ? 'Tailscale' : 'Wi‑Fi'}` : ''}</small></span>
        <span class="row-actions"><button class="btn sm" data-d="rename">Renombrar</button><button class="btn sm danger" data-d="del">Quitar</button></span></div>`).join('')}</div>`
      : `<p class="sub">Aún no hay dispositivos. Activa una conexión y pulsa <b>Vincular dispositivo</b>.</p>`}
    <p class="hint" style="margin-top:14px">En el móvil, una vez dentro, usa “Añadir a pantalla de inicio” para tenerlo como una app.</p>`;

  $$('#remote-body [data-r]').forEach((b) => (b.onclick = async () => {
    try { R = await api('/api/remote/settings', { [b.dataset.r]: !R[b.dataset.r === 'lan' ? 'lan' : 'tailscale'].enabled }); renderRemote(); } catch (e) { toast(e.message, true); }
  }));
  $('#r-ts-serve')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { R = await api('/api/remote/tailscale-serve', {}); toast('Publicado en Tailscale'); renderRemote(); } catch (err) { toast(err.message, true); e.target.disabled = false; }
  });
  $('#r-pair').onclick = pairDevice;
  $('#r-pass')?.addEventListener('click', setPassword);
  $('#r-funnel')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    try { R = await api('/api/remote/funnel', { on: !R.tailscale.funnel }); toast(R.tailscale.funnel ? 'Abierto a internet' : 'Solo en tu red de Tailscale'); renderRemote(); }
    catch (err) { toast(err.message, true); renderRemote(); }
  });
  $$('#remote-body [data-d]').forEach((b) => (b.onclick = async () => {
    const id = b.closest('[data-id]').dataset.id, d = R.devices.find((x) => x.id === id);
    if (b.dataset.d === 'rename') {
      modal(`<div class="mhead">${logo('phone', 40)}<div><small>Dispositivo</small><h2>${esc(d.name)}</h2></div></div>
        <div class="form"><label>Nombre<input id="dv-name" class="field" value="${esc(d.name)}"></label></div>
        <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="dv-ok">Guardar</button></div>`);
      $('#dv-ok').onclick = async () => { R = await api('/api/remote/devices/rename', { id, name: $('#dv-name').value }); closeModal(); renderRemote(); };
      return;
    }
    modal(`<div class="mhead">${logo('phone', 40)}<div><small>Quitar dispositivo</small><h2>${esc(d.name)}</h2></div></div>
      <p class="sub" style="margin-top:14px">Dejará de tener acceso a MCP Hub${id === R.current ? ' (es el que estás usando ahora)' : ''}. Para volver a usarlo tendrás que vincularlo otra vez.</p>
      <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn danger" id="dv-del">Quitar</button></div>`);
    $('#dv-del').onclick = async () => { R = await api('/api/remote/devices/delete', { id }); closeModal(); renderRemote(); };
  }));
}

function setPassword() {
  const change = R.tailscale.passwordSet;
  modal(`<div class="mhead">${logo('tailscale', 44)}<div><small>Tailscale</small><h2>${change ? 'Cambiar contraseña de acceso' : 'Contraseña de acceso'}</h2></div></div>
    <p class="sub" style="margin-top:10px">Se pedirá la primera vez que un móvil o tablet entre por Tailscale. Los dispositivos ya vinculados no tienen que volver a escribirla.</p>
    <div class="form">
      ${change && REMOTE ? '<label>Contraseña actual<input id="rp-cur" type="password" class="field" autocomplete="current-password"></label>' : ''}
      <label>Nueva contraseña <span class="hint">mínimo 8 caracteres</span><input id="rp-new" type="password" class="field" autocomplete="new-password"></label>
      <label>Repítela<input id="rp-new2" type="password" class="field" autocomplete="new-password"></label>
    </div>
    <div class="mfoot"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="rp-ok">Guardar</button></div>`);
  $('#rp-ok').onclick = async () => {
    if ($('#rp-new').value !== $('#rp-new2').value) return toast('Las contraseñas no coinciden', true);
    try { R = await api('/api/remote/password', { password: $('#rp-new').value, current: $('#rp-cur')?.value }); closeModal(); toast('Contraseña guardada'); renderRemote(); }
    catch (e) { toast(e.message, true); }
  };
}

async function pairDevice() {
  let r;
  try { r = await api('/api/remote/pair', {}); } catch (e) { return toast(e.message, true); }
  if (!r.links.length) return toast('Activa primero una conexión (Wi‑Fi o Tailscale)', true);
  let i = 0;
  const draw = () => {
    const l = r.links[i];
    modal(`<div class="mhead">${logo('phone', 44)}<div><small>Vincular dispositivo</small><h2>Escanea con la cámara del móvil</h2></div></div>
      ${r.links.length > 1 ? `<div class="seg" style="margin-top:14px">${r.links.map((x, n) => `<button data-l="${n}" class="${n === i ? 'on' : ''}">${esc(x.label)}</button>`).join('')}</div>` : ''}
      <div class="qrbox">${l.qr}</div>
      <p class="mono hint qrurl">${esc(l.url)}</p>
      <p class="hint">${l.password ? 'Al abrirlo pedirá la contraseña de acceso (solo la primera vez).' : 'El código vale para un dispositivo y caduca en 10 minutos. Verás un aviso de certificado la primera vez: es normal, continúa.'}</p>
      <div class="mfoot"><button class="btn" id="qr-copy">${svg('copy')}Copiar enlace</button><button class="btn primary" data-close>Listo</button></div>`);
    $$('[data-l]').forEach((b) => (b.onclick = () => { i = Number(b.dataset.l); draw(); }));
    $('#qr-copy').onclick = () => navigator.clipboard.writeText(l.url).then(() => toast('Enlace copiado'));
  };
  draw();
}

loadRemote();
