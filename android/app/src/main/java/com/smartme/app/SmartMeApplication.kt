package com.smartme.app

import android.app.Application
import com.smartme.app.core.security.TokenStore
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltAndroidApp
class SmartMeApplication : Application() {

    @Inject
    lateinit var tokenStore: TokenStore

    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        // Restores the session into memory so the auth interceptor can attach a
        // bearer token on the first request after a cold start.
        applicationScope.launch { tokenStore.restore() }
    }
}
