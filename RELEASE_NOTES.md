## MCP Hub para escritorio y móvil

Un sitio para gestionar tus servidores MCP y trabajar con tus agentes de programación (Claude Code, Codex, OpenCode, Gemini CLI y Cursor Agent): terminales integradas, encargos entre agentes, Diseño (prototipos, presentaciones y objetos 3D), Bóveda, mensajería y acceso desde el móvil.

MCP Hub se ejecuta en tu ordenador. Necesitas tener instalados los agentes que quieras usar (por ejemplo `npm install -g @anthropic-ai/claude-code`); la app los detecta sola.

### Descargas

| Sistema | Archivo |
|---|---|
| Windows 10/11 (64 bits) | `MCP-Hub-…-windows-x64-setup.exe` |
| macOS con chip Apple (M1–M4) | `MCP-Hub-…-mac-arm64.dmg` |
| macOS con Intel | `MCP-Hub-…-mac-x64.dmg` |
| Linux (64 bits) | `MCP-Hub-…-linux-x86_64.AppImage` |
| Android (mando a distancia) | `MCP-Hub-…-android.apk` |

`SHA256SUMS.txt` tiene las sumas de comprobación de cada archivo.

### Instalación

- **Windows**: ejecuta el instalador. Como la app no está firmada con un certificado de pago, Windows puede mostrar «Windows protegió tu PC»: pulsa **Más información → Ejecutar de todas formas**. Las terminales usan PowerShell.
- **macOS**: abre el `.dmg` y arrastra MCP Hub a Aplicaciones. La primera vez, haz **clic derecho → Abrir** (la app no está notarizada por Apple). Si macOS dice que «está dañada», ejecuta en la Terminal: `xattr -cr "/Applications/MCP Hub.app"`.
- **Linux**: da permiso de ejecución y ábrela: `chmod +x MCP-Hub-*.AppImage && ./MCP-Hub-*.AppImage`. Algunas distribuciones necesitan `libfuse2`.
- **Android**: instala el `.apk` (permite «instalar apps de origen desconocido» si te lo pide). La app del móvil es el mando a distancia de MCP Hub: en el ordenador abre **Móvil → Vincular dispositivo** y escanea el código QR desde la app. Funciona en la Wi‑Fi de casa o desde cualquier sitio con Tailscale.

### Notas

- Al cerrar la ventana se detiene MCP Hub y las terminales abiertas. Tu configuración se guarda en `~/.config/mcp-hub`.
- Si ya tienes MCP Hub en marcha (por ejemplo, desde el código), la app usa ese en lugar de arrancar otro.
- Para exportar modelos 3D a FBX, OBJ, BLEND, USD o Alembic hace falta tener Blender instalado; GLB, glTF, STL, PLY y USDZ funcionan sin nada más. Las capturas y PDF de Diseño usan Chrome, Edge o Chromium.
