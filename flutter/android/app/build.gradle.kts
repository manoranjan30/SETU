import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
}

// Release signing — reads android/key.properties if present (git-ignored; see
// android/.gitignore, which already anticipates this file). Falls back to the
// debug key when absent so local/CI builds keep working before a real production
// keystore is generated. Replace this fallback with a real key.properties before
// shipping to the Play Store — see the Play Store launch plan.
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKeystore = keystorePropertiesFile.exists()
val keystoreProperties = Properties().apply {
    if (hasReleaseKeystore) load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.setu.mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.setu.mobile"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        resValue("string", "app_name", "SETU")
    }

    // Two distribution channels from one codebase — see the Play Store launch plan
    // (C:\Users\omano\.claude\plans\greedy-sniffing-pascal.md):
    //  - "playstore": the published build. The self-updater is gated out in Dart
    //    (AppFlavor.isInternal) AND the REQUEST_INSTALL_PACKAGES permission itself
    //    is stripped via src/playstore/AndroidManifest.xml, so Play's static
    //    scanner never even sees it declared — not just an unused code path.
    //  - "internal": direct-APK distribution, unchanged from today — keeps the
    //    self-update mechanism (AppUpdateService/AndroidApkDownloader) that Play
    //    policy prohibits, which is exactly why it can't ship on Play Store as-is.
    // Suffixed applicationId on "internal" lets both be installed side-by-side on
    // one test device.
    flavorDimensions += "distribution"
    productFlavors {
        create("playstore") {
            dimension = "distribution"
            // applicationId stays the base com.setu.mobile
        }
        create("internal") {
            dimension = "distribution"
            applicationIdSuffix = ".internal"
            resValue("string", "app_name", "SETU Internal")
        }
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Real keystore once key.properties exists; falls back to the debug
            // key otherwise so `flutter build --release` keeps working while a
            // production keystore is still pending.
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Flutter's own release-AAB build unconditionally requires AGP to have
            // extracted a native debug symbol table (libflutter.so.sym/.dbg) and
            // moved it into BUNDLE-METADATA, or it hard-fails the build. Explicitly
            // request SYMBOL_TABLE so extractReleaseNativeSymbolTables actually runs
            // and produces it. This task used to AccessDeniedException on this
            // machine because the project's OneDrive path pushes intermediate file
            // paths past Windows' 260-char MAX_PATH limit — fixed by enabling
            // Windows long-path support (HKLM LongPathsEnabled), not by relocating
            // the build directory (that broke Flutter's own hard-coded assumption
            // of where the AAB lives).
            ndk {
                debugSymbolLevel = "SYMBOL_TABLE"
            }
        }
    }
}

flutter {
    source = "../.."
}

// Skip tasks that fail on this Windows/OneDrive machine:
//  - cleanMerge<Flavor>ReleaseAssets: Windows Defender locks mlkit model files during scan
// Not required for the APK/AAB binary itself, so disabling it is safe.
//
// extractReleaseNativeSymbolTables used to be disabled here too (AccessDeniedException
// on the long OneDrive path), but Flutter's release-AAB build requires that task's
// output (libflutter.so.sym/.dbg) to exist or it hard-fails — see debugSymbolLevel
// above. Fixed at the root instead, by moving Gradle's build output outside OneDrive
// (android/build.gradle.kts), so this task now runs normally.
//
// Matching uses `contains` checks on each token rather than exact/prefix equality —
// adding the "playstore"/"internal" product flavors inserts the flavor name between
// the verb and "Release" in the generated task name (e.g.
// "cleanMergeInternalReleaseAssets"), which silently stopped matching an earlier
// exact-name check and let a release build hang indefinitely on the same Windows
// Defender file lock this was written to avoid.
afterEvaluate {
    tasks.configureEach {
        val isCleanMergeAssets = name.startsWith("clean") &&
            name.contains("Merge") &&
            name.contains("Release") &&
            name.contains("Assets")
        if (isCleanMergeAssets) {
            enabled = false
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")
}
