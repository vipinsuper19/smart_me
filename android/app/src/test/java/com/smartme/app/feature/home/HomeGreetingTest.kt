package com.smartme.app.feature.home

import com.smartme.app.R
import org.junit.Assert.assertEquals
import org.junit.Test

class HomeGreetingTest {

    @Test
    fun `morning greeting covers the early day`() {
        assertEquals(R.string.home_greeting_morning, greetingResForHour(0))
        assertEquals(R.string.home_greeting_morning, greetingResForHour(11))
    }

    @Test
    fun `afternoon greeting starts at noon`() {
        assertEquals(R.string.home_greeting_afternoon, greetingResForHour(12))
        assertEquals(R.string.home_greeting_afternoon, greetingResForHour(16))
    }

    @Test
    fun `evening greeting covers the rest of the day`() {
        assertEquals(R.string.home_greeting_evening, greetingResForHour(17))
        assertEquals(R.string.home_greeting_evening, greetingResForHour(23))
    }

    @Test
    fun `out of range hours fall back instead of throwing`() {
        assertEquals(R.string.home_greeting_day, greetingResForHour(-1))
        assertEquals(R.string.home_greeting_day, greetingResForHour(24))
    }
}
