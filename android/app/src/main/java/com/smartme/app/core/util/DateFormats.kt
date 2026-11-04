package com.smartme.app.core.util

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private fun mediumDateFormatter(): DateTimeFormatter =
    DateTimeFormatter.ofPattern("d MMM yyyy", Locale.getDefault())

/** Formats an ISO-8601 instant in the device zone, or returns null when unparseable. */
fun formatIsoDate(iso: String?): String? {
    if (iso.isNullOrBlank()) return null
    return runCatching {
        Instant.parse(iso)
            .atZone(ZoneId.systemDefault())
            .toLocalDate()
            .format(mediumDateFormatter())
    }.getOrNull()
}

/** Formats a `YYYY-MM-DD` local date, or returns null when unparseable. */
fun formatDateOnly(date: String?): String? {
    if (date.isNullOrBlank()) return null
    return runCatching { LocalDate.parse(date).format(mediumDateFormatter()) }.getOrNull()
}
