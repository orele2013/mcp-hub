# Mantener los métodos expuestos a JavaScript (addJavascriptInterface)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keep class net.orele.mcphub.WebBridge { *; }
