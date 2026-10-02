package net.orele.mcphub

import android.net.http.SslCertificate
import android.os.Build
import java.security.MessageDigest

object Tls {
    /** Bytes DER del certificado del servidor. */
    private fun derBytes(cert: SslCertificate): ByteArray? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            cert.x509Certificate?.let { return it.encoded }
        }
        // Android 8–9: SslCertificate.saveState guarda el DER bajo la clave "x509-certificate"
        return SslCertificate.saveState(cert)?.getByteArray("x509-certificate")
    }

    /** SHA-256 en hexadecimal (mayúsculas, sin separadores) o null si no se puede leer. */
    fun sha256(cert: SslCertificate?): String? {
        val der = cert?.let { derBytes(it) } ?: return null
        return MessageDigest.getInstance("SHA-256").digest(der)
            .joinToString("") { "%02X".format(it) }
    }

    /** Forma corta legible: AB:CD:EF:01 … 23:45:67:89 */
    fun short(hex: String): String {
        val pairs = hex.chunked(2)
        return pairs.take(4).joinToString(":") + " … " + pairs.takeLast(4).joinToString(":")
    }
}
