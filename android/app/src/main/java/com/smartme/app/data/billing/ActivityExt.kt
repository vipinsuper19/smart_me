package com.smartme.app.data.billing

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper

/**
 * Unwraps the activity that owns a Compose context. Play Billing needs a real
 * Activity to show its purchase sheet.
 */
fun Context.findActivity(): Activity? {
    var current: Context = this
    while (current is ContextWrapper) {
        if (current is Activity) return current
        current = current.baseContext
    }
    return null
}
