package net.orele.mcphub

import android.content.ContentValues
import android.content.Context
import android.media.MediaScannerConnection
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.MimeTypeMap
import org.json.JSONObject
import java.io.File

object Downloads {

    /** Script inyectado en la página: guarda blobs/data (a[download]) mediante el puente nativo. */
    val INJECT_JS = """
        (function(){
          if (window.__mcphubSave) return;
          function save(href, name){
            fetch(href, {credentials: 'include'}).then(function(r){
              if (!r.ok) throw new Error('HTTP ' + r.status);
              var ct = r.headers.get('content-type') || '';
              return r.blob().then(function(b){ return [b, ct]; });
            }).then(function(x){
              var fr = new FileReader();
              fr.onloadend = function(){
                var s = String(fr.result || ''); var i = s.indexOf(',');
                __BRIDGE__.saveBase64(s.slice(i + 1), name || '', x[0].type || x[1] || 'application/octet-stream');
              };
              fr.onerror = function(){ __BRIDGE__.onError('FileReader'); };
              fr.readAsDataURL(x[0]);
            }).catch(function(e){ __BRIDGE__.onError(String(e && e.message || e)); });
          }
          window.__mcphubSave = save;
          function handle(a){
            if (!a || !a.hasAttribute || !a.hasAttribute('download')) return false;
            var h = a.href || '';
            if (h.indexOf('blob:') !== 0 && h.indexOf('data:') !== 0) return false;
            save(h, a.getAttribute('download')); return true;
          }
          document.addEventListener('click', function(e){
            var a = e.target && e.target.closest ? e.target.closest('a') : null;
            if (handle(a)) e.preventDefault();
          }, true);
          var origClick = HTMLAnchorElement.prototype.click;
          HTMLAnchorElement.prototype.click = function(){
            if (!this.isConnected && handle(this)) return;
            return origClick.apply(this, arguments);
          };
        })();
    """.trimIndent().replace("__BRIDGE__", WebBridge.NAME)

    fun fetchAndSaveJs(url: String, fileName: String): String =
        INJECT_JS + "\nwindow.__mcphubSave(${JSONObject.quote(url)}, ${JSONObject.quote(fileName)});"

    fun cleanName(raw: String, mime: String): String {
        var name = raw.substringAfterLast('/').substringAfterLast('\\')
            .replace(Regex("[\\u0000-\\u001f:*?\"<>|]"), "_").trim().trimStart('.')
        if (name.isEmpty()) name = "descarga"
        if (!name.contains('.')) {
            MimeTypeMap.getSingleton().getExtensionFromMimeType(mime.substringBefore(';').trim())
                ?.let { name += ".$it" }
        }
        return name.take(120)
    }

    /** Guarda en Descargas. Ejecutar fuera del hilo principal. */
    fun save(context: Context, bytes: ByteArray, rawName: String, mime: String, legacyPublic: Boolean): Boolean {
        val type = mime.substringBefore(';').trim().ifEmpty { "application/octet-stream" }
        val name = cleanName(rawName, type)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = context.contentResolver
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, type)
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return false
            try {
                resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: error("sin salida")
                values.clear()
                values.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
                true
            } catch (e: Exception) {
                resolver.delete(uri, null, null)
                false
            }
        } else {
            @Suppress("DEPRECATION")
            val dir = if (legacyPublic) Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            else context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: return false
            dir.mkdirs()
            var file = File(dir, name)
            var n = 1
            val base = name.substringBeforeLast('.', name)
            val ext = name.substringAfterLast('.', "").let { if (it.isEmpty()) "" else ".$it" }
            while (file.exists()) file = File(dir, "$base (${n++})$ext")
            file.writeBytes(bytes)
            MediaScannerConnection.scanFile(context, arrayOf(file.absolutePath), arrayOf(type), null)
            true
        }
    }
}

/** Puente JS → nativo para guardar archivos generados en la página (blob:/data:). */
class WebBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun saveBase64(base64: String, name: String, mime: String) {
        val bytes = try {
            Base64.decode(base64, Base64.DEFAULT)
        } catch (e: IllegalArgumentException) {
            activity.runOnUiThread { activity.onDownloadFailed("base64") }
            return
        }
        activity.runOnUiThread { activity.saveDownload(bytes, name, mime) }
    }

    @JavascriptInterface
    fun onError(message: String) {
        activity.runOnUiThread { activity.onDownloadFailed(message) }
    }

    companion object {
        const val NAME = "MCPHubAndroid"
    }
}
