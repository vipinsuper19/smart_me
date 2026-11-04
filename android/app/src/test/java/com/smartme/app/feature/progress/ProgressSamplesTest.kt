package com.smartme.app.feature.progress

import com.smartme.app.core.network.WeeklyDayDto
import org.junit.Assert.assertEquals
import org.junit.Test

class ProgressSamplesTest {

    @Test
    fun `weekday initials map from the local date`() {
        assertEquals("M", weekdayInitial("2026-11-02"))
        assertEquals("T", weekdayInitial("2026-11-03"))
        assertEquals("W", weekdayInitial("2026-11-04"))
        assertEquals("S", weekdayInitial("2026-11-07"))
        assertEquals("S", weekdayInitial("2026-11-08"))
    }

    @Test
    fun `unparseable dates return an empty label`() {
        assertEquals("", weekdayInitial(""))
        assertEquals("", weekdayInitial("not-a-date"))
    }

    @Test
    fun `weekly bars scale against the busiest day`() {
        assertEquals(0f, weeklyBarFraction(0, ProgressSamples.weekly.days))
        assertEquals(0f, weeklyBarFraction(-5, ProgressSamples.weekly.days))
        assertEquals(1f, weeklyBarFraction(35, ProgressSamples.weekly.days))
        assertEquals(1f, weeklyBarFraction(999, ProgressSamples.weekly.days))
    }

    @Test
    fun `weekly bars stay empty when no day has activity`() {
        val days = listOf(WeeklyDayDto(date = "2026-11-04", minutesLearned = 0))

        assertEquals(0f, weeklyBarFraction(0, days))
        assertEquals(0f, weeklyBarFraction(10, emptyList()))
    }
}
