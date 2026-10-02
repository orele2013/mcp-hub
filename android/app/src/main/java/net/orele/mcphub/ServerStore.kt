package net.orele.mcphub

import android.content.Context
import android.net.Uri
import android.webkit.CookieManager
import android.webkit.WebStorage

/** Servidor guardado (origen) y huella TLS fijada (trust-on-first-use). */
class ServerStore(context: Context) {
    private val prefs = context.getSharedPreferences("server", Context.MODE_PRIVATE)

    val origin: String? get() = prefs.getString(KEY_ORIGIN, null)

    /** SHA-256 (hex) del certificado aceptado para el servidor guardado. */
    var pinnedFingerprint: String?
        get() = prefs.getString(KEY_PIN, null)
        set(value) { prefs.edit().putString(KEY_PIN, value).apply() }

    fun saveOrigin(newOrigin: String) {
        val editor = prefs.edit()
        if (newOrigin != origin) editor.remove(KEY_PIN)
        editor.putString(KEY_ORIGIN, newOrigin).apply()
    }

    /** Olvida el servidor: origen, huella fijada, cookies y almacenamiento web. */
    fun forget() {
        prefs.edit().clear().apply()
        CookieManager.getInstance().apply {
            removeAllCookies(null)
            flush()
        }
        WebStorage.getInstance().deleteAllData()
    }

    companion object {
        private const val KEY_ORIGIN = "origin"
        private const val KEY_PIN = "pin_sha256"
    }
}

object UrlRules {
    private val LOCAL_HTTP_HOSTS = setOf("127.0.0.1", "localhost", "10.0.2.2")

    /** Acepta solo https:// (o http:// para pruebas locales). Devuelve null si no es válida. */
    fun parseServerUrl(raw: String): Uri? {
        var s = raw.trim()
        if (s.isEmpty()) return null
        if (!s.contains("://")) s = "https://$s"
        val uri = Uri.parse(s)
        val host = uri.host?.lowercase() ?: return null
        if (host.isEmpty()) return null
        return when (uri.scheme?.lowercase()) {
            "https" -> uri
            "http" -> if (host in LOCAL_HTTP_HOSTS) uri else null
            else -> null
        }
    }

    /** scheme://host[:port] */
    fun originOf(uri: Uri): String {
        val scheme = uri.scheme!!.lowercase()
        val host = uri.host!!.lowercase().let { if (it.contains(':')) "[$it]" else it }
        return if (uri.port != -1) "$scheme://$host:${uri.port}" else "$scheme://$host"
    }

    private fun effectivePort(uri: Uri): Int = when {
        uri.port != -1 -> uri.port
        uri.scheme.equals("https", true) -> 443
        uri.scheme.equals("http", true) -> 80
        else -> -1
    }

    fun sameOrigin(a: Uri, b: Uri): Boolean =
        a.scheme.equals(b.scheme, true) &&
            a.host.equals(b.host, true) &&
            effectivePort(a) == effectivePort(b)

    /** Mismo host y puerto (para errores TLS, que siempre son https). */
    fun sameHostPort(a: Uri, b: Uri): Boolean =
        a.host.equals(b.host, true) && effectivePort(a) == effectivePort(b)
}
