package net.orele.mcphub

import android.content.Intent
import android.os.Bundle
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.enableEdgeToEdge
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.ApiException
import com.google.mlkit.common.MlKitException
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning

class SetupActivity : ComponentActivity() {

    private lateinit var input: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)
        findViewById<android.view.View>(R.id.root).applySystemBarPadding()

        input = findViewById(R.id.inputUrl)
        findViewById<Button>(R.id.btnScan).setOnClickListener { scan() }
        findViewById<Button>(R.id.btnConnect).setOnClickListener { connect(input.text.toString()) }
        input.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_GO) {
                connect(input.text.toString()); true
            } else false
        }
    }

    private fun scan() {
        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .enableAutoZoom()
            .build()
        GmsBarcodeScanning.getClient(this, options).startScan()
            .addOnSuccessListener { barcode ->
                val value = barcode.rawValue ?: barcode.url?.url
                if (value != null) {
                    input.setText(value)
                    connect(value)
                }
            }
            .addOnFailureListener { e ->
                val unavailable = (e is MlKitException && e.errorCode == MlKitException.UNAVAILABLE) ||
                    (e is ApiException && e.statusCode == CommonStatusCodes.API_NOT_CONNECTED)
                val msg = if (unavailable) getString(R.string.setup_scan_unavailable)
                else getString(R.string.setup_scan_failed, e.localizedMessage ?: e.javaClass.simpleName)
                Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
            }
        // addOnCanceledListener: el usuario cerró el escáner, no hacemos nada
    }

    private fun connect(raw: String) {
        val uri = UrlRules.parseServerUrl(raw)
        if (uri == null) {
            input.error = getString(R.string.setup_invalid)
            return
        }
        ServerStore(this).saveOrigin(UrlRules.originOf(uri))
        startActivity(
            Intent(this, MainActivity::class.java)
                .putExtra(MainActivity.EXTRA_URL, uri.toString())
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        )
        finish()
    }
}
