# Hoja de ruta de MCP Hub

Estado real de las 50 mejoras propuestas. **Hecho** = se puede usar de principio a fin y se ha probado; **Parcial** = existe una parte usable (se indica cuál y qué falta); **Pendiente** = no implementado.

Última actualización: 2026-10-02 (quinto bloque: 15 funciones nuevas, fuera de las 50; ver al final).

## Delegación y control (prioridad 1)

| # | Mejora | Estado | Notas |
|---|---|---|---|
| 11 | Entorno aislado por encargo | **Hecho** | `isolation: worktree`: el encargo trabaja en un `git worktree` en `~/.local/share/mcp-hub/worktrees/` con una rama `mcphub/encargo-<id>`. Incluye los cambios sin confirmar del repositorio (también archivos nuevos). Solo carpetas con git y con al menos un commit; si no, se avisa con un error claro. |
| 12 | Perfiles de permisos | **Hecho** | `read`, `edit`, `ask`, `full`, traducidos a los flags de cada agente (Claude `--permission-mode plan/acceptEdits` o `--dangerously-skip-permissions`; Codex `-s read-only/workspace-write` o bypass; Gemini `--approval-mode`; OpenCode `OPENCODE_CONFIG_CONTENT`). Cursor solo distingue "sin límites" (`--force`) del resto. |
| 13 | Bandeja de aprobaciones | **Hecho** | Por acción con Claude Code (`--permission-prompt-tool` → `approvals-mcp.js`). En los demás agentes, aprobación antes de empezar. Se decide en Agentes → Encargos (también desde el móvil) o por Mensajería con `/aprobar id` y `/denegar id`. Claude Code aprueba él solo los comandos de solo lectura y, en modo edición, los de archivos de la carpeta; esos no pasan por la bandeja. |
| 14 | Flujos con dependencias | **Hecho** | Un encargo puede esperar a otros (`after`): queda "esperando a otros encargos" y entra en la cola cuando terminan. Por defecto recibe sus respuestas al final de la tarea. Si falla una dependencia: omitirlo (también en cadena), lanzarlo igualmente o lanzarlo si al menos una salió bien. Si la dependencia trabajó aislada en el mismo repositorio y este también se aísla, parte de sus cambios sin revisar, y al aplicar se exige el orden correcto. Tras un reinicio, los que esperan a un encargo interrumpido siguen esperando a que lo reanudes. Se crea desde Nuevo encargo ("Esperar a otros encargos"), con "Encadenar otro" en cada encargo, o desde los agentes (`delegate(after: …)`). No hay un editor visual de flujos guardados: cada cadena se crea encargo a encargo. |
| 15 | Delegación en paralelo | **Hecho** | Nuevo encargo → "Varios en paralelo" (o `delegate_parallel` desde los agentes): la misma tarea a 2–8 agentes, cada uno con su modelo. Opcionalmente un agente reúne y compara las respuestas (síntesis de solo lectura que arranca cuando terminan, con las que salieron bien). `get_group` espera al grupo y devuelve todas las respuestas. Respetan la cola y el máximo simultáneo. |
| 16 | Revisión independiente | **Hecho** | "Revisión independiente" en un encargo, al crearlo ("Revisión independiente al terminar") o desde los agentes (`request_review`, `delegate(review_with: …)`). Otro agente (por defecto, uno distinto del autor) lo revisa con permisos de solo lectura: recibe la tarea, la respuesta y el diff si trabajó aislado (y se ejecuta dentro de esa copia). Termina con un veredicto (aprobado, cambios necesarios, rechazado) que se muestra en ambos encargos; si no da uno reconocible, no se inventa. Mientras la revisión está en marcha no se pueden aplicar ni descartar esos cambios. |
| 17 | Puntos de control y reanudación | **Hecho** | Los encargos interrumpidos (reinicio de MCP Hub), fallidos, cancelados o sin tiempo se reanudan. Si el agente informó su sesión (Claude, Codex, OpenCode, Cursor), se continúa esa conversación (`--resume`); si no, empieza de cero. El estado vive en `~/.config/mcp-hub/job-state/`. |
| 18 | Cola de encargos | **Hecho** | Prioridad de -10 a 10, pausar o reanudar en cola, y máximo simultáneo configurable. Los encargos que no caben esperan en la cola en vez de fallar. |
| 19 | Límites por encargo | **Hecho** | Tiempo (todos los agentes; al agotarse se corta y queda reanudable). Turnos y gasto máximo, solo Claude Code (`--max-turns`, `--max-budget-usd`). El gasto es la estimación que da el propio agente. |
| 20 | Revisión de cambios | **Hecho** | Para encargos aislados: diff con colores, "Aplicar a mi carpeta" (`git apply`, y con `--3way` si hace falta), "Conservar en rama" (commit en `mcphub/encargo-<id>`) o "Descartar" (pide confirmación). |

## Perfiles, proyectos y sesiones

| # | Mejora | Estado | Notas |
|---|---|---|---|
| 1 | Perfiles por proyecto | **Parcial** | Agentes → Perfiles de proyecto guarda y aplica carpeta, agente, cuenta/modelo, selección de MCPs cuando el agente lo admite, instrucciones iniciales y referencias autorizadas de la Bóveda. Los secretos no se copian al perfil; se validan al iniciar y requieren la Bóveda desbloqueada. Las skills son preferencias incluidas en el primer mensaje: deben estar instaladas globalmente y no se ocultan otras skills del agente. |
| 2 | Catálogo de roles | **Hecho** | Roles editables con agente, modelo, permisos, aislamiento, límites e instrucciones (vienen 5 de inicio: revisor, investigador, implementador, escritor de tests y diseñador). Se usan en Nuevo encargo, en las tareas programadas y desde los agentes con `delegate(role: …)`. `list_agents` los lista. |
| 3 | Clonar una sesión | **Hecho** | Terminales → panel de la sesión → "Clonar": abre el formulario con la misma configuración para cambiar el modelo, la cuenta o el enfoque. |
| 4 | Recuperar sesiones | **Hecho** | Las pestañas abiertas se guardan (sus opciones, no su contenido). Tras reiniciar se ofrece "Restaurar", que retoma la última conversación del agente en esa carpeta (`--continue`, `codex resume --last`, `gemini --resume latest`), o "Abrir de nuevo". Limitación: si había dos sesiones del mismo agente en la misma carpeta, ambas retoman la conversación más reciente. |
| 5 | Buscar en sesiones | Pendiente | |
| 6 | Indicador de contexto | Pendiente | |
| 7 | Memoria por proyecto | Pendiente | |
| 8 | Enrutador de tareas | Pendiente | |
| 9 | Plantillas de encargos | **Hecho** | Plantillas con campos `{{así}}` que se rellenan en un formulario al crear el encargo; pueden fijar un rol. Se editan en Agentes → Encargos → Roles y plantillas. |
| 10 | Paquete de contexto al iniciar | Pendiente | |

## Gestión MCP

| # | Mejora | Estado | Notas |
|---|---|---|---|
| 21 | Explorador MCP | **Hecho** | Servidores → "Explorar": herramientas (con anotaciones), recursos, plantillas de recursos, prompts y sugerencias de argumentos (`default`, `examples`, `enum` del esquema). |
| 22 | Probador de herramientas | **Hecho** | Formulario generado desde el `inputSchema` (texto, números, booleanos, enumerados, listas y JSON). Ejecuta la herramienta de verdad y muestra texto, imágenes, recursos, resultado estructurado y tiempo. También lee recursos y obtiene prompts. |
| 23 | Proxy MCP central | Pendiente | |
| 24 | Panel de salud | **Hecho** | Historial real (últimas 50 comprobaciones por servidor: resultado, tiempo, nº de herramientas y error), punto de estado en la tabla, "Comprobar todos" y pestaña Salud con gráfica de latencia. No hay sondeo automático en segundo plano. El tiempo incluye arrancar el servidor. |
| 25 | Permisos por herramienta | Pendiente | |
| 26 | Asistente OAuth | Pendiente | Ahora se detecta y se avisa cuando un servidor pide autenticación (401/403). |
| 27 | Revisión de seguridad antes de instalar | **Hecho** | Análisis estático de la configuración al añadir o editar un servidor y en el Explorador. Detecta sudo, shells, `curl \| sh`, paquetes sin versión fija (npx/uvx), Docker privilegiado o con el socket, acceso a `/`, a la carpeta personal o a carpetas de credenciales, secretos en variables o cabeceras, http sin cifrar y tokens en la URL. No revisa el código del paquete. |
| 28 | Historial y comparación de configuración | Pendiente | Se guarda una copia `.mcp-hub.bak` de cada configuración la primera vez que se modifica. |
| 29 | Ejecución aislada de servidores | Pendiente | |
| 30 | Pruebas de compatibilidad MCP | **Hecho** | En el Explorador: versión del protocolo, capacidades declaradas, nombres de herramientas válidos para Claude, OpenAI y Gemini, descripciones, esquemas (`type: object`, `$ref`, `oneOf`/`anyOf`, tamaño), duplicados y número de herramientas. |

## Automatización y calidad

| # | Mejora | Estado | Notas |
|---|---|---|---|
| 31 | Tareas programadas | **Hecho** | Encargos recurrentes cada N minutos (mínimo 5) o a una hora en los días elegidos. Usan la misma cola, permisos, aislamiento, aprobaciones y límites. Se pueden activar, desactivar, lanzar ahora y editar. Si MCP Hub está apagado a la hora prevista, esa ejecución se salta. |
| 32 | Desencadenadores | Parcial | Solo dos: una web caída (Monitores) lanza una investigación, y el calendario aplaza tareas programadas. No hay desencadenadores por archivos, git o webhooks. |
| 33 | Reglas de notificación | **Hecho** | Mensajería → Qué te aviso. Seis tipos activables (sesiones, encargos, aprobaciones, tareas programadas, diseño y seguridad), horas de silencio (también cruzando la medianoche) y la opción de que aprobaciones y seguridad lleguen igualmente. Los avisos silenciados quedan en el registro de la conversación. Los avisos van al canal principal; no hay canal distinto por tipo. |
| 34 | Panel de trabajo | Parcial | Agentes → Encargos: activos, por revisar e historial, con estado, carpeta, quién lo pidió, uso y acciones. Faltan los encargos de otros sistemas y la vista por proyecto. La Sala de control (mosaico de terminales, aprobaciones y encargos activos) completa la vista en vivo. |
| 35 | Línea de tiempo | Pendiente | |
| 36 | Panel de uso | **Hecho** | Agentes → Encargos → Uso: encargos, % de éxito, duración media (medida), turnos medios y coste estimado, por agente y modelo o por proyecto (carpeta). Los turnos y el coste son los que informa el agente; el coste solo lo da Claude Code y es su estimación. Se calcula con los últimos 200 encargos guardados. |
| 37 | Pruebas de regresión de agentes | Pendiente | |
| 38 | Comparador de modelos | Pendiente | |
| 39 | Cuotas y avisos | Pendiente | |
| 40 | Recuperación ante fallos | Parcial | Reanudación manual de encargos (17), cola (18) y reconexión automática de las terminales y del móvil. Faltan las políticas automáticas (reintentos o cambio de agente ante límites de API). |

## Contexto, entregas y diseño

| # | Mejora | Estado | Notas |
|---|---|---|---|
| 41 | Base de conocimiento local | Pendiente | |
| 42 | Paquete automático para delegar | Parcial | Con aislamiento, el encargo parte del estado exacto del repositorio, incluidos los cambios sin confirmar. No se adjunta automáticamente el resumen de git ni la salida reciente. |
| 43 | Biblioteca de resultados | Parcial | Las exportaciones de Diseño van a `~/Designs/_exportaciones` y el historial de encargos guarda las respuestas. No hay un buscador común. |
| 44 | Adjuntos para todas las sesiones | Parcial | Solo en Diseño (imágenes y dibujos) y en el MCP de diseño (`images`). |
| 45 | Entrada por voz | Pendiente | El usuario eligió "solo texto" para el móvil. |
| 46 | Cuaderno de investigación web | Pendiente | El tipo "Investigación" de Diseño cita fuentes, pero no las guarda aparte. |
| 47 | Encargos desde tickets | Parcial | Issues de GitHub → encargo aislado o tarjeta del tablero, y PR desde el encargo con su revisión adjunta (Integraciones → GitHub). Faltan Jira y Linear. La creación del PR no se ha probado (sube a GitHub). |
| 48 | Prototipos navegables | Parcial | Los prototipos de Diseño son navegables (varias pantallas con JS). No hay un editor visual de enlaces entre pantallas. |
| 49 | Revisión visual y de accesibilidad | Parcial | El tipo "Color + tipografía" calcula contrastes WCAG y hay capturas por tamaño de pantalla (`design_screenshot`). No hay una comparación automática. |
| 50 | Vista previa compartible | Parcial | Exportación a un HTML único y acceso remoto (Wi‑Fi o Tailscale/Funnel con dispositivos vinculados). No hay enlaces temporales sin vincular. |

## Cómo se ha verificado lo implementado

- **Perfiles por proyecto (1, parcial):** recorrido de interfaz en navegador local: abrir la lista, editar y aplicar un perfil en el formulario de sesión. Prueba API de extremo a extremo en una carpeta temporal con Claude simulado: alta y borrado, permisos `600`, secreto ausente del archivo del perfil pero presente en el entorno del agente, instrucciones y skills preferidas en el primer mensaje, rechazo de carpeta/MCP inexistentes y bloqueo del inicio si la Bóveda está cerrada. No se ejecutó un agente real. La elección de skills aún no tiene aislamiento por perfil.

- **Dependencias, paralelo y revisión (14–16):**
  - 23 comprobaciones con un lanzador simulado y un repositorio git real:
    - esperar y recibir respuestas, y omitir en cadena;
    - reanudar tras un fallo, `onDepFail` run/any y cancelar dependencias;
    - grupo con síntesis, revisión con otro agente y lectura del veredicto;
    - copia aislada encadenada, orden de aplicación y reinicio con encargos esperando.
  - Prueba real, con:
    - Claude Haiku y Codex en paralelo, y síntesis de Claude.
    - Una cadena aislada: A (Claude) añade una función y B (Claude) parte de sus cambios y añade tests.
    - Una revisión de A por Codex, con veredicto APROBADO.
  - El intento de aplicar B antes que A se rechazó. Después se aplicaron A y B en orden y los tests generados pasan.
  - Las herramientas `get_group`, `get_delegation` y `request_review` se probaron por stdio.
  - Las capturas de escritorio y de móvil no muestran errores ni desplazamiento horizontal.

- **Roles y plantillas:**
  - Encargo con el rol `revisor` (aplica solo lectura y antepone sus instrucciones).
  - `list_agents` del MCP muestra los roles.
  - El formulario de plantilla rellena el rol y muestra los campos.
- **Tareas programadas:**
  - Guardar, validar (rechaza intervalos menores de 5 min), lanzar ahora (crea un encargo real) y borrar.
  - Cálculo de la próxima ejecución para horarios por días y por intervalo.
  - Disparo por temporizador y registro de errores, con un lanzador simulado.
- **Reglas de avisos:** pruebas unitarias del gestor de mensajería (tipos desactivados, silencio, urgentes, cruce de medianoche).
- **Uso:** con los encargos de prueba reales, por agente y por carpeta.

- **Encargos:** pruebas reales con Claude Code (Haiku) en un repositorio git de prueba:
  - Edición aislada con diff y aplicar, y conservar en rama.
  - Aprobación por acción, aprobada y denegada.
  - Cola con prioridad y pausa.
  - Reinicio de MCP Hub en mitad de un encargo y reanudación de la misma sesión.
  - El límite de tiempo se probó con un agente simulado.
- **Sesiones:** se reinició MCP Hub con una shell y una sesión de Claude abiertas, y se restauraron (Claude se abrió con `--continue`).
- **MCP:**
  - Exploración y llamada real a `time.get_current_time`.
  - "Comprobar todos" con los 17 servidores registrados (14 correctos; desktop-commander y Roblox_Studio terminan al arrancar, n8n pide OAuth).
  - Revisión de seguridad con configuraciones peligrosas de ejemplo.

## Funciones nuevas (quinto bloque, fuera de las 50)

| Función | Estado | Notas |
|---|---|---|
| Chat unificado | **Hecho** | `@claude`, `@codex`, `@todos`… en un hilo; cada agente ve lo que dijeron los demás. |
| Debate | **Hecho** | Dos agentes por turnos y un tercero de juez. |
| Tablero kanban | **Hecho** | Mover a "En curso" lanza el encargo; al terminar pasa a "Revisar". |
| Recetas (grabar y repetir) | **Hecho** | Los pasos se guardan con rutas relativas; el agente adapta la receta al otro proyecto. |
| Mapa del proyecto | **Hecho** | Imports reales, sin IA; se actualiza solo. |
| Agente sombra | **Hecho** | Solo consulta al agente si la pantalla cambió. |
| Monitores | **Hecho** | Caída tras 2 fallos, investigación opcional por un agente, aviso de recuperación. |
| Calendario | **Hecho** | iCal con recurrencias y zonas horarias; "Aplazar si estoy ocupado" en tareas programadas. |
| GitHub | Parcial | Listar issues y convertirlos en encargo o tarjeta: probado. Crear PR: sin probar (sube a GitHub). |
| Home Assistant | **Hecho** (simulado) | Probado contra un Home Assistant simulado, no contra el del usuario: notificación, luz, voz, y pausa de la cola al salir de casa. |
| MCP `mcp-hub-extras` | **Hecho** | 7 herramientas; registrado en Claude Code, Codex y OpenCode. |
| Vídeo de demostración (Diseño) | **Hecho** | MP4, GIF (ligero: 8 fps, 720 px) o WebM. |
| "Desde captura" y "Presentación de un proyecto" | **Hecho** | Probados con Claude. |
| Sala de control y paleta Ctrl+K | **Hecho** | |
| Vistas en el móvil | **Hecho** | Sin desplazamiento horizontal ni errores de consola a 390 px. |

### Cómo se ha verificado (2026-10-01 y 2026-10-02)
- Con agentes reales (Claude Haiku y Codex): chat, debate, tablero, receta repetida en otro repositorio, diagnóstico del monitor (encontró el proceso caído) y aviso de la sombra (detectó un JSON con una coma de más).
- Calendario: un `.ics` servido en local con un evento en curso. La tarea programada se aplazó hasta el final del evento sin lanzar ningún encargo. Las 7 herramientas de `mcp-hub-extras` se probaron por stdio.
- GitHub: issues reales de `omacom/omarchy` (solo lectura) y conversión en tarjeta enlazada.
- Home Assistant: servidor simulado que registra las llamadas. Se probaron el token incorrecto (401), el descubrimiento de entidades y el envío a los tres destinos, y la salida y vuelta a casa (la cola se pausa y se reanuda).
- Diseño: vídeo MP4/GIF del proyecto `prueba-landing`, una captura convertida en prototipo y una presentación de 12 diapositivas sobre MCP Hub, ambos con Claude.
- Interfaz: Chromium sin ventana a 1440 px y a 390 px, con Sala de control, Ctrl+K → "monitor" → Intro y las vistas nuevas.
- Durante las pruebas, los avisos se silenciaron con horas de silencio para no enviar correos; quedaron en el registro de Mensajería.
