# MCP Hub para Android

Mando a distancia de MCP Hub: abre la interfaz de MCP Hub de tu ordenador en el móvil, como app.
Los agentes siguen ejecutándose en el ordenador; el móvil solo los controla.

## Uso

1. En el ordenador: MCP Hub → **Móvil** → activa la Wi‑Fi de casa o Tailscale → **Vincular dispositivo**.
2. En el móvil: abre la app, pulsa **Escanear el código QR** (o pega la dirección) y listo.

En la Wi‑Fi de casa el ordenador usa un certificado propio: la primera vez la app te pide confiar en él y recuerda
su huella; si un día cambia, avisa y no se conecta. Con Tailscale el certificado es público y no pregunta nada.
Si no puede conectar, la pantalla de error tiene **Cambiar de ordenador**.

## Compilar

Requisitos: JDK 17 y el SDK de Android (API 35). Desde esta carpeta:

```sh
./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

Sin Android SDK instalado, con Docker:

```sh
docker run --rm -u $(id -u):$(id -g) -e HOME=/tmp -v "$PWD":/work -w /work ghcr.io/cirruslabs/android-sdk:35 ./gradlew assembleRelease
```

## Firma

La versión de release se firma con la clave indicada en estas variables de entorno (si faltan, se usa la de depuración):

| Variable | Qué es |
|---|---|
| `ANDROID_KEYSTORE_FILE` | Ruta al almacén de claves (.p12 o .jks) |
| `ANDROID_KEYSTORE_PASSWORD` | Contraseña del almacén |
| `ANDROID_KEY_ALIAS` | Alias de la clave |
| `ANDROID_KEY_PASSWORD` | Contraseña de la clave (si no, la del almacén) |

En GitHub Actions salen de los secretos del repositorio (`ANDROID_KEYSTORE_B64`, en base64, y los demás).
Usa siempre la misma clave: con otra, los móviles no dejan actualizar la app.
