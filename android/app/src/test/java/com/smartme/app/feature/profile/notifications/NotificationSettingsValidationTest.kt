package com.smartme.app.feature.profile.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NotificationSettingsValidationTest {

    @Test
    fun `valid 24 hour times parse to hour and minute`() {
        assertEquals(0 to 0, parseReminderTime("00:00"))
        assertEquals(7 to 5, parseReminderTime("7:05"))
        assertEquals(19 to 0, parseReminderTime("19:00"))
        assertEquals(23 to 59, parseReminderTime("23:59"))
        assertEquals(19 to 0, parseReminderTime(" 19:00 "))
    }

    @Test
    fun `invalid times return null instead of guessing`() {
        assertNull(parseReminderTime(""))
        assertNull(parseReminderTime("24:00"))
        assertNull(parseReminderTime("19:60"))
        assertNull(parseReminderTime("19:5"))
        assertNull(parseReminderTime("7 pm"))
        assertNull(parseReminderTime("19-00"))
    }

    @Test
    fun `formatting always produces a two digit 24 hour value`() {
        assertEquals("07:05", formatReminderTime(7, 5))
        assertEquals("19:00", formatReminderTime(19, 0))
        assertEquals("00:00", formatReminderTime(0, 0))
    }

    @Test
    fun `formatting clamps out of range values`() {
        assertEquals("23:59", formatReminderTime(28, 75))
        assertEquals("00:00", formatReminderTime(-3, -1))
    }
}
