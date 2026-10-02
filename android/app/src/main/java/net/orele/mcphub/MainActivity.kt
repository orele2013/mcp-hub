package net.orele.mcphub

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Message
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.MimeTypeMap
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {

    private lateinit var store: ServerStore
    private lateinit var webView: WebView
    private lateinit var errorView: View
    private lateinit var errorTitle: TextView
    private lateinit var errorMessage: TextView
    private lateinit var originUri: Uri

    private var lastFailedUrl: String? = null
    /** Evita que el error genérico tape el mensaje de certificado (cambiado/cancelado). */
    private var tlsErrorShown = false
    private var sslDialog: AlertDialog? = null
    private val pendingSsl = mutableListOf<SslErrorHandler>()

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingStorageAction: ((Boolean) -> Unit)? = null
    private val io = Executors.newSingleThreadExecutor()

    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        val cb = fileCallback
        fileCallback = null
        val data = res.data
        val uris: Array<Uri>? = if (res.resultCode == RESULT_OK && data != null) {
            val clip = data.clipData
            when {
                clip != null && clip.itemCount > 0 -> Array(clip.itemCount) { clip.getItemAt(it).uri }
                data.data != null -> arrayOf(data.data!!)
                else -> null
            }
        } else null
        cb?.onReceiveValue(uris)
    }

    private val storagePermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val action = pendingStorageAction
        pendingStorageAction = null
        action?.invoke(granted)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        store = ServerStore(this)
        val origin = store.origin
        if (origin == null) {
            openSetup()
            return
        }
        originUri = Uri.parse(origin)

        setContentView(R.layout.activity_main)
        findViewById<View>(R.id.root).applySystemBarPadding()
        webView = findViewById(R.id.webView)
        errorView = findViewById(R.id.errorView)
        errorTitle = findViewById(R.id.errorTitle)
        errorMessage = findViewById(R.id.errorMessage)
        findViewById<Button>(R.id.btnRetry).setOnClickListener { retry() }
        findViewById<Button>(R.id.btnChange).setOnClickListener { resetServer() }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = true
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = true
            userAgentString = "$userAgentString MCPHubAndroid/1.0"
        }
        webView.addJavascriptInterface(WebBridge(this), WebBridge.NAME)
        webView.webViewClient = Client()
        webView.webChromeClient = Chrome()
        webView.setDownloadListener { url, _, contentDisposition, mimeType, _ ->
            onDownload(url, contentDisposition, mimeType)
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (errorView.visibility != View.VISIBLE && webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        })

        val restored = savedInstanceState != null && webView.restoreState(savedInstanceState) != null
        if (!restored) webView.loadUrl(startUrl(intent))
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (!::webView.isInitialized) return
        intent.getStringExtra(EXTRA_URL)?.let {
            hideError()
            webView.loadUrl(startUrl(intent))
        }
    }

    private fun startUrl(intent: Intent?): String {
        val extra = intent?.getStringExtra(EXTRA_URL)?.let { Uri.parse(it) }
        return if (extra != null && extra.scheme != null && UrlRules.sameOrigin(extra, originUri)) extra.toString()
        else "${store.origin}/"
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (::webView.isInitialized) webView.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) webView.onResume()
    }

    override fun onPause() {
        if (::webView.isInitialized) webView.onPause()
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onDestroy() {
        sslDialog?.dismiss()
        pendingSsl.forEach { it.cancel() }
        pendingSsl.clear()
        if (::webView.isInitialized) {
            (webView.parent as? ViewGroup)?.removeView(webView)
            webView.destroy()
        }
        io.shutdown()
        super.onDestroy()
    }

    // ---- Navegación ----

    private fun isAppUrl(uri: Uri): Boolean = UrlRules.sameOrigin(uri, originUri)

    private fun openExternal(uri: Uri) {
        try {
            val intent = if (uri.scheme.equals("intent", true)) {
                Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME).apply {
                    addCategory(Intent.CATEGORY_BROWSABLE)
                    component = null
                    selector = null
                }
            } else Intent(Intent.ACTION_VIEW, uri)
            startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_app, Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, R.string.no_app, Toast.LENGTH_SHORT).show()
        }
    }

    /** Decide dónde se abre una URL de navegación. true = la gestionamos nosotros (no cargar). */
    private fun route(uri: Uri, mainFrame: Boolean, fromNewWindow: Boolean): Boolean {
        val scheme = uri.scheme?.lowercase() ?: return false
        if (scheme == "mcphub") {
            if (uri.host.equals("reset", true)) resetServer()
            return true
        }
        if (scheme == "http" || scheme == "https") {
            if (isAppUrl(uri)) {
                if (fromNewWindow) webView.loadUrl(uri.toString())
                return fromNewWindow
            }
            if (!mainFrame) return false
            openExternal(uri)
            return true
        }
        if (scheme in setOf("blob", "data", "about", "javascript")) {
            if (fromNewWindow && scheme != "javascript" && scheme != "about") webView.loadUrl(uri.toString())
            return fromNewWindow
        }
        openExternal(uri) // mailto:, tel:, intent:, etc.
        return true
    }

    private inner class Client : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
            route(request.url, request.isForMainFrame, fromNewWindow = false)

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            view.evaluateJavascript(Downloads.INJECT_JS, null)
        }

        override fun onPageFinished(view: WebView, url: String?) {
            view.evaluateJavascript(Downloads.INJECT_JS, null)
            CookieManager.getInstance().flush()
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (!request.isForMainFrame || tlsErrorShown) return
            lastFailedUrl = request.url.toString()
            showError(getString(R.string.error_title), getString(R.string.error_generic, error.description))
        }

        override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
            handleSslError(handler, error)
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            // El proceso de renderizado murió: rehacemos la actividad con un WebView nuevo.
            (view.parent as? ViewGroup)?.removeView(view)
            view.destroy()
            recreate()
            return true
        }
    }

    private inner class Chrome : WebChromeClient() {
        override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
            // Solo se usa si algún día se habilitan varias ventanas: capturamos la URL y la enrutamos.
            val temp = WebView(this@MainActivity)
            temp.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                    route(request.url, mainFrame = true, fromNewWindow = true)
                    v.post { v.destroy() }
                    return true
                }
            }
            (resultMsg.obj as WebView.WebViewTransport).webView = temp
            resultMsg.sendToTarget()
            return true
        }

        override fun onShowFileChooser(
            webView: WebView,
            filePathCallback: ValueCallback<Array<Uri>>,
            fileChooserParams: FileChooserParams
        ): Boolean {
            fileCallback?.onReceiveValue(null)
            fileCallback = filePathCallback
            val mimes = fileChooserParams.acceptTypes
                .flatMap { it.split(',') }
                .map { it.trim().lowercase() }
                .filter { it.isNotEmpty() }
                .mapNotNull {
                    if (it.startsWith(".")) MimeTypeMap.getSingleton().getMimeTypeFromExtension(it.substring(1))
                    else it
                }
                .distinct()
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = if (mimes.size == 1) mimes[0] else "*/*"
                if (mimes.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, mimes.toTypedArray())
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, fileChooserParams.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
            }
            return try {
                pickFiles.launch(Intent.createChooser(intent, null))
                true
            } catch (e: ActivityNotFoundException) {
                fileCallback = null
                filePathCallback.onReceiveValue(null)
                true
            }
        }
    }

    // ---- TLS: confianza en el primer uso para el ordenador guardado ----

    private fun handleSslError(handler: SslErrorHandler, error: SslError) {
        val uri = Uri.parse(error.url ?: "")
        if (uri.host == null || !UrlRules.sameHostPort(uri, originUri)) {
            handler.cancel() // nunca para otros hosts
            return
        }
        val fingerprint = Tls.sha256(error.certificate)
        if (fingerprint == null) {
            handler.cancel()
            return
        }
        val pinned = store.pinnedFingerprint
        when {
            pinned == null -> askTrust(handler, fingerprint)
            pinned.equals(fingerprint, ignoreCase = true) -> handler.proceed()
            else -> {
                handler.cancel()
                lastFailedUrl = null
                tlsErrorShown = true
                showError(
                    getString(R.string.cert_changed_title),
                    getString(R.string.tls_changed, originUri.host, Tls.short(fingerprint))
                )
            }
        }
    }

    private fun askTrust(handler: SslErrorHandler, fingerprint: String) {
        pendingSsl += handler
        if (sslDialog?.isShowing == true) return
        sslDialog = AlertDialog.Builder(this)
            .setTitle(R.string.tls_title)
            .setMessage(getString(R.string.tls_message, originUri.host + portSuffix(), Tls.short(fingerprint)))
            .setCancelable(false)
            .setPositiveButton(R.string.tls_trust) { _, _ ->
                store.pinnedFingerprint = fingerprint
                pendingSsl.forEach { it.proceed() }
                pendingSsl.clear()
            }
            .setNegativeButton(R.string.tls_cancel) { _, _ ->
                pendingSsl.forEach { it.cancel() }
                pendingSsl.clear()
                tlsErrorShown = true
                showError(getString(R.string.error_title), getString(R.string.tls_cancelled))
            }
            .show()
    }

    private fun portSuffix() = if (originUri.port != -1) ":${originUri.port}" else ""

    // ---- Error / cambio de ordenador ----

    private fun showError(title: String, message: String) {
        errorTitle.text = title
        errorMessage.text = message
        errorView.visibility = View.VISIBLE
    }

    private fun hideError() {
        tlsErrorShown = false
        if (::webView.isInitialized) errorView.visibility = View.GONE
    }

    private fun retry() {
        hideError()
        webView.loadUrl(lastFailedUrl ?: "${store.origin}/")
    }

    private fun resetServer() {
        store.forget()
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.clearHistory()
            webView.clearCache(true)
        }
        openSetup()
    }

    private fun openSetup() {
        startActivity(Intent(this, SetupActivity::class.java))
        finish()
    }

    // ---- Descargas ----

    private fun onDownload(url: String, contentDisposition: String?, mimeType: String?) {
        val uri = Uri.parse(url)
        val name = URLUtil.guessFileName(url, contentDisposition, mimeType)
        when (uri.scheme?.lowercase()) {
            "blob", "data" -> webView.evaluateJavascript(Downloads.fetchAndSaveJs(url, name), null)
            "http", "https" -> {
                if (isAppUrl(uri) && store.pinnedFingerprint != null) {
                    // Certificado autofirmado: DownloadManager no lo aceptaría; lo bajamos desde la página.
                    webView.evaluateJavascript(Downloads.fetchAndSaveJs(url, name), null)
                } else {
                    withStorage { enqueueDownload(url, name, mimeType) }
                }
            }
        }
    }

    private fun enqueueDownload(url: String, name: String, mimeType: String?) {
        try {
            val req = DownloadManager.Request(Uri.parse(url)).apply {
                CookieManager.getInstance().getCookie(url)?.let { addRequestHeader("Cookie", it) }
                addRequestHeader("User-Agent", webView.settings.userAgentString)
                if (!mimeType.isNullOrBlank()) setMimeType(mimeType)
                setTitle(name)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
            }
            (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
            Toast.makeText(this, R.string.download_started, Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            onDownloadFailed(e.localizedMessage ?: e.javaClass.simpleName)
        }
    }

    /** En Android 8–9 hace falta permiso de almacenamiento para escribir en Descargas. */
    private fun withStorage(action: (granted: Boolean) -> Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ||
            checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        ) {
            action(true)
        } else {
            pendingStorageAction = action
            storagePermission.launch(Manifest.permission.WRITE_EXTERNAL_STORAGE)
        }
    }

    fun saveDownload(bytes: ByteArray, name: String, mime: String) {
        withStorage { granted ->
            io.execute {
                val ok = try {
                    Downloads.save(applicationContext, bytes, name, mime, legacyPublic = granted)
                } catch (e: Exception) {
                    false
                }
                runOnUiThread {
                    if (ok) Toast.makeText(this, R.string.download_done, Toast.LENGTH_SHORT).show()
                    else onDownloadFailed(name)
                }
            }
        }
    }

    fun onDownloadFailed(reason: String) {
        Toast.makeText(this, getString(R.string.download_failed, reason), Toast.LENGTH_LONG).show()
    }

    companion object {
        const val EXTRA_URL = "url"
    }
}
