package com.smartme.app.core.connectivity

import kotlinx.coroutines.flow.Flow

/** Emits the device connectivity state so the shell can surface an offline banner. */
interface NetworkMonitor {
    val isOnline: Flow<Boolean>
}
