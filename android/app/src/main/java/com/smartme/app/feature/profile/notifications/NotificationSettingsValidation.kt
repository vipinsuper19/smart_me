package com.smartme.app.feature.profile.notifications

import java.util.Locale

/** Parses a 24-hour `HH:MM` string, returning null when it is not a valid time. */
fun parseReminderTime(value: String): Pair<Int, Int>? {
    val match = Regex("^([01]?\\d|2[0-3]):([0-5]\\d)$").matchEntire(value.trim()) ?: return null
    val hour = match.groupValues[1].toIntOrNull() ?: return null
    val minute = match.groupValues[2].toIntOrNull() ?: return null
    return hour to minute
}

fun formatReminderTime(hour: Int, minute: Int): String =
    String.format(Locale.US, "%02d:%02d", hour.coerceIn(0, 23), minute.coerceIn(0, 59))
