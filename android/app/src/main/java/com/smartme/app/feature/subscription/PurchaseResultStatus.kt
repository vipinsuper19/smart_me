package com.smartme.app.feature.subscription

import java.util.Locale

/** The three purchase outcomes the app can render, as route-safe strings. */
object PurchaseResultStatus {
    const val Success = "success"
    const val Pending = "pending"
    const val Failure = "failure"
}

/** Normalises a route argument, defaulting to a failure so nothing is silently granted. */
fun purchaseResultStatus(raw: String?): String = when (raw?.trim()?.lowercase(Locale.US)) {
    PurchaseResultStatus.Success -> PurchaseResultStatus.Success
    PurchaseResultStatus.Pending -> PurchaseResultStatus.Pending
    PurchaseResultStatus.Failure -> PurchaseResultStatus.Failure
    else -> PurchaseResultStatus.Failure
}
