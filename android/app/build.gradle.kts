plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val appVersionName = "1.0.0"

// Firma de release desde variables de entorno (CI / local). Si faltan, se usa la firma debug.
val keystoreFile: String? = System.getenv("ANDROID_KEYSTORE_FILE")?.takeIf { it.isNotBlank() }
val hasReleaseSigning = keystoreFile != null && file(keystoreFile).exists() &&
    !System.getenv("ANDROID_KEYSTORE_PASSWORD").isNullOrEmpty() &&
    !System.getenv("ANDROID_KEY_ALIAS").isNullOrEmpty()

android {
    namespace = "net.orele.mcphub"
    compileSdk = 35
    buildToolsVersion = "35.0.0"

    defaultConfig {
        applicationId = "net.orele.mcphub"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = appVersionName
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(keystoreFile!!)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
                    ?.takeIf { it.isNotEmpty() } ?: System.getenv("ANDROID_KEYSTORE_PASSWORD")
                storeType = if (keystoreFile.endsWith(".p12", ignoreCase = true) ||
                    keystoreFile.endsWith(".pfx", ignoreCase = true)) "pkcs12" else null
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = if (hasReleaseSigning) signingConfigs.getByName("release")
            else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")
    // play-services trae un androidx.fragment antiguo; se fuerza uno compatible con ActivityResult
    implementation("androidx.fragment:fragment:1.8.5")
}

// ./gradlew assembleRelease copia también el APK a build/dist/MCP-Hub-<version>.apk
val copyNamedApk by tasks.registering(Copy::class) {
    from(layout.buildDirectory.file("outputs/apk/release/app-release.apk"))
    into(rootProject.layout.buildDirectory.dir("dist"))
    rename { "MCP-Hub-$appVersionName.apk" }
}
tasks.matching { it.name == "assembleRelease" }.configureEach { finalizedBy(copyNamedApk) }
