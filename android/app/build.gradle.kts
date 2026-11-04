import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.smartme.app"
    compileSdk = 37

    // Release values can be supplied per build so the same source produces
    // versioned, environment-specific artifacts in CI.
    val appVersionCode = providers.gradleProperty("SMARTME_VERSION_CODE")
        .orNull
        ?.toIntOrNull()
        ?: 1
    val appVersionName = providers.gradleProperty("SMARTME_VERSION_NAME")
        .orNull
        ?.takeIf { it.isNotBlank() }
        ?: "0.1.0"

    require(appVersionCode > 0) {
        "SMARTME_VERSION_CODE must be a positive integer (got $appVersionCode)."
    }
    require(Regex("""^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$""").matches(appVersionName)) {
        "SMARTME_VERSION_NAME must look like 1.2.3 (got \"$appVersionName\")."
    }

    defaultConfig {
        applicationId = "com.smartme.app"
        minSdk = 29
        targetSdk = 37
        versionCode = appVersionCode
        versionName = appVersionName

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Google Sign-In is hidden when this is blank. The value must match the
        // backend's GOOGLE_CLIENT_ID (a "Web application" OAuth client).
        val googleWebClientId = providers.gradleProperty("SMARTME_GOOGLE_WEB_CLIENT_ID")
            .orElse("")
            .get()
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$googleWebClientId\"")
    }

    signingConfigs {
        // CI provides these through Gradle properties after decoding the
        // keystore. Without all four values the release build stays unsigned,
        // which is useful for pull-request verification.
        val storeFile = providers.gradleProperty("SMARTME_RELEASE_STORE_FILE").orNull
        val storePassword = providers.gradleProperty("SMARTME_RELEASE_STORE_PASSWORD").orNull
        val keyAlias = providers.gradleProperty("SMARTME_RELEASE_KEY_ALIAS").orNull
        val keyPassword = providers.gradleProperty("SMARTME_RELEASE_KEY_PASSWORD").orNull

        val provided = listOf(storeFile, storePassword, keyAlias, keyPassword)
            .count { !it.isNullOrBlank() }
        // Silently falling back to an unsigned build when only some secrets are
        // present produces an artifact that looks releasable but cannot be
        // installed or uploaded. Fail loudly instead.
        if (provided in 1..3) {
            throw GradleException(
                "Release signing requires SMARTME_RELEASE_STORE_FILE, " +
                    "SMARTME_RELEASE_STORE_PASSWORD, SMARTME_RELEASE_KEY_ALIAS and " +
                    "SMARTME_RELEASE_KEY_PASSWORD together; only $provided of 4 were provided.",
            )
        }

        if (!storeFile.isNullOrBlank() && !storePassword.isNullOrBlank() &&
            !keyAlias.isNullOrBlank() && !keyPassword.isNullOrBlank()
        ) {
            create("release") {
                this.storeFile = file(storeFile)
                this.storePassword = storePassword
                this.keyAlias = keyAlias
                this.keyPassword = keyPassword
            }
        }
    }

    buildTypes {
        debug {
            // Emulator loopback by default. On a physical device run
            // `adb reverse tcp:3001 tcp:3001` and build with
            // `-PSMARTME_API_BASE_URL=http://127.0.0.1:3001/api/v1/`.
            val debugApiBaseUrl = providers.gradleProperty("SMARTME_API_BASE_URL")
                .orElse("http://10.0.2.2:3001/api/v1/")
                .get()
            buildConfigField("String", "API_BASE_URL", "\"$debugApiBaseUrl\"")
        }
        release {
            val configuredBaseUrl = providers.gradleProperty("SMARTME_RELEASE_API_BASE_URL")
                .orElse("https://api.smartme.app/api/v1/")
                .get()
            val releaseApiBaseUrl =
                if (configuredBaseUrl.endsWith("/")) configuredBaseUrl else "$configuredBaseUrl/"
            require(releaseApiBaseUrl.startsWith("https://")) {
                "SMARTME_RELEASE_API_BASE_URL must use https (got \"$releaseApiBaseUrl\")."
            }
            buildConfigField("String", "API_BASE_URL", "\"$releaseApiBaseUrl\"")

            val releaseSigning = signingConfigs.findByName("release")
            if (releaseSigning != null) {
                signingConfig = releaseSigning
            }

            // R8 stays off until the Retrofit, kotlinx.serialization and Hilt
            // rules have been validated against a real release build.
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.compose.navigation)

    implementation(libs.hilt.android)
    implementation(libs.hilt.android.compose)
    ksp(libs.hilt.android.compiler)

    implementation(libs.kotlinx.serialization.json)

    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging.interceptor)

    implementation(libs.androidx.datastore)

    // Google Sign-In via Credential Manager.
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.googleid)

    // Remote images in lesson blocks and path covers.
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)

    // Google Play Billing. Purchases are verified by the backend before access
    // is granted; the client library only opens the store flow.
    implementation(libs.billing.ktx)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)

    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)

    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
