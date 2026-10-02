# MCP Hub

App local para gestionar servidores MCP en todos tus agentes y abrirlos desde un solo sitio.

- **Servidores MCP**: un único registro; los interruptores escriben cada servidor en la config de Claude Code, Codex, OpenCode, Gemini CLI y Cursor Agent. Importar, pegar JSON, probar (lista las herramientas) y sincronizar.
- **Catálogo**: ~28 MCPs populares (Playwright, GitHub, Context7, Filesystem, Notion, Supabase…).
- **Agentes**: abre cada CLI en una pestaña integrada o en una terminal externa, con todos los MCPs o solo los que elijas para esa sesión.
  - **Suscripción**: quita las API keys del entorno (y en Codex fuerza el login con ChatGPT). El botón "Iniciar sesión con suscripción" abre el login de cada CLI.
  - **Proveedores IA**: añade APIs OpenAI-/Anthropic-compatibles (OpenRouter, DeepSeek, Kimi, GLM, Groq, Ollama…) y úsalas desde Claude Code, Codex u OpenCode.

- **Mensajería**: Telegram, email (SMTP/IMAP), Discord y Slack, en las dos direcciones.
  - Los agentes usan el MCP `mcp-hub-messaging`: `send_message` (avisarte), `ask_user` (preguntarte y esperar la respuesta), `wait_for_reply` y `read_messages`.
  - Desde el chat: `/sesiones`, `/ver n` (pantalla de una sesión), `/usar n` (tus mensajes se teclean en esa sesión), `/s n texto`, `/preguntas`, `/soltar`, `/ayuda`. Para contestar a un agente, responde a su pregunta.
  - Solo se aceptan mensajes del chat/usuario/dirección configurados.
  - Reglas de avisos: qué tipos se envían (sesiones, encargos, aprobaciones, tareas programadas, diseño, seguridad), horas de silencio y excepción para lo urgente.

- **Encargos entre agentes**: con el MCP `mcp-hub-agents`, un agente encarga una tarea a otro (Claude Code, Codex, OpenCode, Gemini CLI o Cursor) y recibe la respuesta. Herramientas: `delegate`, `delegate_parallel`, `get_group`, `request_review`, `get_delegation`, `resume_delegation`, `cancel_delegation` y `list_agents`. También se crean desde Agentes → Encargos → Nuevo encargo.
  - **Permisos:** solo lectura, editar archivos, aprobar cada acción (bandeja de aprobaciones; por acción solo en Claude Code) o sin límites.
  - **Aislamiento:** con `worktree`, el encargo trabaja en una copia aislada del repositorio git (incluye tus cambios sin confirmar). Al terminar ves el diff y eliges entre aplicarlo a tu carpeta, conservarlo en una rama o descartarlo.
  - **Cola:** prioridades, pausa y un máximo de encargos a la vez.
  - **Límites:** tiempo para todos los agentes; turnos y gasto solo en Claude Code.
  - **Reanudación:** los encargos interrumpidos, fallidos o sin tiempo se reanudan continuando la sesión del agente cuando es posible.
  - **Mensajería:** `/encargos`, `/aprobar id` y `/denegar id`. Hay avisos de aprobaciones pendientes y de encargos largos o con cambios por revisar.
  - **Cadenas:** máximo 3 niveles de encargos en cadena.
  - **Roles y plantillas:** los roles son perfiles reutilizables (revisor, investigador, implementador…); las plantillas son encargos con campos `{{editables}}`. Los agentes pueden usar los roles con `delegate(role: …)`.
  - **Tareas programadas:** encargos recurrentes cada N minutos o a una hora en los días elegidos.
  - **Uso:** éxito, duración, turnos y coste estimado, por agente y modelo o por proyecto.
  - **Dependencias:** un encargo puede esperar a otros y recibir sus respuestas (`after`); si una falla, se omite, se lanza igualmente o se lanza si al menos una salió bien. Si ambos están aislados en el mismo repositorio, el segundo parte de los cambios del primero.
  - **En paralelo:** la misma tarea a varios agentes, y opcionalmente otro agente que reúne y compara las respuestas (`delegate_parallel`, `get_group`).
  - **Revisión independiente:** otro agente revisa el resultado (y el diff) con solo lectura y da un veredicto (`request_review`, `delegate(review_with)`).
- **Sesiones recuperables**: las pestañas abiertas se guardan; tras reiniciar se pueden restaurar retomando la última conversación del agente. Además, "Clonar" abre una variante con otro modelo o cuenta.
- **Perfiles por proyecto**: en Agentes → Perfiles de proyecto guarda la carpeta, agente, cuenta/modelo, MCPs seleccionados cuando el agente permite filtrarlos, skills preferidas, instrucciones de inicio y referencias a credenciales de la Bóveda. También puedes guardar la configuración desde el formulario de nueva sesión y elegir el perfil al volver a abrir el proyecto. El archivo `~/.config/mcp-hub/project-profiles.json` usa permisos `600` y solo guarda identificadores de credenciales, nunca sus valores. Las credenciales autorizadas deben tener variable de entorno y secreto en la Bóveda desbloqueada al iniciar; si se borran o la bóveda está bloqueada, la sesión falla con un mensaje. Las instrucciones y skills preferidas se envían como primer mensaje del agente; las skills deben estar instaladas para ese agente y no se ocultan otras skills globales. Cursor Agent no permite filtrar MCPs por sesión.
- **Explorador MCP**: Servidores → Explorar. Incluye:
  - Herramientas, recursos y prompts, y un probador de herramientas con formulario generado desde el esquema.
  - Comprobaciones de compatibilidad.
  - Revisión de seguridad de la configuración (también al añadir o editar un servidor).
  - Historial de salud, y "Comprobar todos" para probar todos los servidores a la vez.
- **Diseño** (estilo Claude Design, con cualquier agente): prototipos interactivos, presentaciones, documentos y diseños libres en `~/Designs/<proyecto>` (carpeta normal con git).
  - Chat con el agente elegido (Claude Code, Codex, OpenCode, Gemini CLI o Cursor; se puede cambiar a mitad) y lienzo en vivo con tamaños de pantalla y zoom.
  - Comentar elementos del lienzo, editar textos directamente, panel de Ajustes (variables CSS que declara el agente), dibujar encima y mandarlo al chat, imágenes de referencia.
  - Versiones (cada turno es un commit; ver y restaurar), plantillas, sistemas de diseño (desde tu código, una web o una descripción).
  - Inicio como Claude Design: “¿Qué creamos?” con adjuntos, sistema de diseño, código enlazado (</>) como referencia, agente y modelo; 12 tipos (en blanco, app móvil, presentación, documento, wireframe, animación, mockups, currículum, objeto 3D, investigación, email HTML, color + tipografía); pestañas Proyectos / Sistemas de diseño / Plantillas con búsqueda, favoritos y vista de lista o cuadrícula.
  - MCP `mcp-hub-design` (en los 5 agentes): `design_list`, `design_create`, `design_message`, `design_wait`, `design_get`, `design_screenshot` (devuelve la imagen), `design_export` y `design_open` (lo abre en la ventana del Hub). Enlace directo: `http://127.0.0.1:7777/#design/<slug>`.
  - Exportar a PDF, PNG, PPTX (presentaciones), HTML de un solo archivo o ZIP; presentar a pantalla completa; “Pasar a código” abre un agente con el encargo de implementarlo.

- **Chat unificado y debates**: un hilo con varios agentes; escribe `@claude`, `@codex`, `@gemini` o `@todos` y cada uno responde viendo lo que dijeron los demás. "Debate": dos agentes discuten por turnos un tema y un tercero hace de juez.
- **Tablero kanban** (Ideas, En curso, Revisar, Hecho): al mover una tarjeta a "En curso" se lanza su encargo y, al terminar, pasa sola a "Revisar". Las tarjetas pueden venir de issues de GitHub o de los agentes (`board_add`).
- **Recetas (grabar y repetir)**: guarda los pasos de un encargo terminado y repítelo en otro proyecto; el agente lo adapta a los nombres de ese proyecto.
- **Agente sombra**: en Terminales → panel de la sesión → "Vigilar esta terminal". Otro agente (por defecto Claude Haiku, solo lectura) mira la pantalla cada N minutos, solo si cambió, y avisa de errores, tests que fallan, comandos peligrosos o credenciales a la vista.
- **Mapa del proyecto**: módulos y dependencias calculados con los imports reales (JS/TS, Python, CSS, HTML), sin IA; se actualiza solo. Opcionalmente un agente describe cada módulo.
- **Monitores**: comprueban una URL cada N minutos (código esperado y texto opcional). Tras 2 fallos seguidos avisan y, si lo configuras, un agente investiga la causa en la carpeta del proyecto y propone el arreglo. También avisan al recuperarse.
- **Integraciones**:
  - **Calendario** (iCal, por ejemplo la dirección secreta de Google Calendar; eventos recurrentes y zonas horarias): las tareas programadas con "Aplazar si estoy ocupado" esperan a que termine el evento.
  - **GitHub** (con tu sesión de `gh`): issues de un repositorio → encargo aislado o tarjeta del tablero; "Crear PR" sube la rama de un encargo aislado y abre un PR (borrador) con su revisión independiente adjunta. Solo se sube algo cuando lo pulsas.
  - **Home Assistant**: los avisos pueden llegar a la app de HA, hacer parpadear una luz o decirse por un altavoz; al salir de casa (entidad `person`/`device_tracker`) la cola de encargos se pausa y al volver se reanuda.
- **MCP `mcp-hub-extras`** (Claude Code, Codex y OpenCode): `calendar_events`, `calendar_free_slots`, `calendar_busy_now`, `board_list`, `board_add`, `project_map` y `monitors_status`.
- **Sala de control**: todas las terminales en mosaico, con aprobaciones pendientes, encargos activos y avisos del agente sombra. **Ctrl+K** abre una paleta para ir a cualquier sección o lanzar acciones.
- **Diseño, extras**: vídeo de demostración del diseño (MP4, GIF o WebM, recorre la página sola) y dos tipos nuevos: "Desde captura" (reproduce una captura como prototipo editable) y "Presentación de un proyecto" (diapositivas sacadas del código enlazado).

- **Móvil y tablet**: la misma app adaptada a pantallas táctiles (instalable como PWA); todo se ejecuta en el ordenador.
  - Wi‑Fi de casa: HTTPS en el puerto 7778 con certificado propio (`~/.config/mcp-hub/tls`). Fuera de casa: Tailscale (`tailscale serve` → 127.0.0.1:7779).
  - Cada dispositivo se vincula con un QR de un solo uso y recibe su propia cookie (revocable en Móvil → Dispositivos). El token interno nunca sale del ordenador y las rutas de agentes (`/agent/*`) no son accesibles desde fuera.
  - En el móvil: menú lateral desplegable, barra de teclas (Esc, Tab, flechas, Ctrl+C) y caja de texto para las terminales, y Diseño con Chat/Lienzo alternables.

## Instalar

Descarga la última versión desde [Releases](https://github.com/orele2013/mcp-hub/releases/latest):

| Sistema | Archivo |
|---|---|
| Windows 10/11 (64 bits) | `MCP-Hub-…-windows-x64-setup.exe` |
| macOS con chip Apple | `MCP-Hub-…-mac-arm64.dmg` |
| macOS con Intel | `MCP-Hub-…-mac-x64.dmg` |
| Linux (64 bits) | `MCP-Hub-…-linux-x86_64.AppImage` |
| Android (mando a distancia) | `MCP-Hub-…-android.apk` |

Las apps de escritorio traen su propio Node: solo necesitas los agentes que quieras usar. No están firmadas con un certificado de pago:
en Windows pulsa **Más información → Ejecutar de todas formas**; en macOS, **clic derecho → Abrir** (o `xattr -cr "/Applications/MCP Hub.app"`).
En Windows las terminales usan PowerShell. La app de Android se conecta a MCP Hub de tu ordenador (Móvil → Vincular dispositivo); ver [android/README.md](android/README.md).

Desde el código: `npm install && npm start`, o `npm run app` para la ventana de escritorio. Para publicar una versión nueva, sube la etiqueta
(`git tag v1.0.1 && git push origin v1.0.1`): GitHub Actions construye y prueba las cinco descargas en cada sistema y crea la release (`.github/workflows/release.yml`).

## Uso

    mcp-hub                 # arranca el servidor (si hace falta) y abre la ventana
    mcp-hub --server-only   # solo el servidor, en http://127.0.0.1:7777

Datos en `~/.config/mcp-hub/servers.json` (permisos 600, incluye las API keys).
Antes del primer cambio se guarda una copia `*.mcp-hub.bak` de cada config JSON que se edita.
Mensajes: `~/.config/mcp-hub/messages.json`. Encargos: `~/.config/mcp-hub/delegations.json` (+ `delegation-settings.json`, `job-state/`); sesiones: `sessions.json`/`previous-sessions.json`; perfiles de proyecto: `project-profiles.json`; salud MCP: `mcp-health.json`; roles y plantillas: `library.json`; tareas programadas: `schedules.json`. Chat y debates: `chats.json`; tablero: `board.json`; monitores: `monitors.json`; calendario: `calendar.json` (URLs secretas, permisos 600); Home Assistant: `homeassistant.json` (token, permisos 600); mapas: `maps/`; recetas: en `library.json`. Hoja de ruta y estado de las mejoras: `ROADMAP.md`. Log: `~/.local/state/mcp-hub.log`. Puerto: `MCP_HUB_PORT`.
