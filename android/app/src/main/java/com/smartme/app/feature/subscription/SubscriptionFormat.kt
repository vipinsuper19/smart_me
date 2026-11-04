package com.smartme.app.feature.subscription

import com.smartme.app.data.billing.BillingFailure
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

/** Formats paise as a currency amount using Indian digit grouping for INR. */
fun formatPriceInPaise(priceInPaise: Int, currency: String): String {
    val safe = priceInPaise.coerceAtLeast(0)
    val whole = safe / 100
    val paise = safe % 100
    val fraction = if (paise == 0) "" else ".${paise.toString().padStart(2, '0')}"

    if (currency.equals("INR", ignoreCase = true)) {
        val symbol = runCatching { Currency.getInstance("INR").symbol }.getOrDefault("₹")
        return "$symbol${groupIndianDigits(whole.toLong())}$fraction"
    }

    val formatter = NumberFormat.getCurrencyInstance(Locale.getDefault()).apply {
        try {
            this.currency = Currency.getInstance(currency)
        } catch (_: IllegalArgumentException) {
            // Keep the locale's symbol when the server sends an unknown code.
        }
        val hasPaise = paise != 0
        maximumFractionDigits = if (hasPaise) 2 else 0
        minimumFractionDigits = if (hasPaise) 2 else 0
    }
    return formatter.format(whole + paise / 100.0)
}

/**
 * Groups digits Indian-style: the last three digits, then pairs, e.g.
 * `123456` becomes `1,23,456`.
 */
internal fun groupIndianDigits(value: Long): String {
    val digits = value.coerceAtLeast(0).toString()
    if (digits.length <= 3) return digits

    val lastThree = digits.takeLast(3)
    var rest = digits.dropLast(3)
    val groups = ArrayDeque<String>()
    while (rest.length > 2) {
        groups.addFirst(rest.takeLast(2))
        rest = rest.dropLast(2)
    }
    groups.addFirst(rest)
    return groups.joinToString(",") + "," + lastThree
}

fun billingPeriodRes(period: String): Int = when (period.uppercase(Locale.US)) {
    "YEARLY", "ANNUAL" -> com.smartme.app.R.string.subscription_period_yearly
    else -> com.smartme.app.R.string.subscription_period_monthly
}

fun isYearly(period: String): Boolean =
    period.uppercase(Locale.US) == "YEARLY" || period.uppercase(Locale.US) == "ANNUAL"

/** Copy for a Play Billing failure, shared by the screen and the purchase result. */
fun billingFailureRes(failure: BillingFailure): Int = when (failure) {
    BillingFailure.UNAVAILABLE -> com.smartme.app.R.string.subscription_billing_unavailable
    BillingFailure.PRODUCT_NOT_FOUND -> com.smartme.app.R.string.subscription_unavailable
    BillingFailure.FLOW_FAILED -> com.smartme.app.R.string.subscription_purchase_failed_body
    BillingFailure.NETWORK -> com.smartme.app.R.string.subscription_network_error
    BillingFailure.TIMEOUT -> com.smartme.app.R.string.subscription_timeout
    BillingFailure.UNKNOWN -> com.smartme.app.R.string.subscription_purchase_failed_body
}
