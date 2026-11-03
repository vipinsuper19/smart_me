package com.smartme.app.feature.lesson

import com.smartme.app.core.network.LessonBlockDto
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Test

class LessonProgressMathTest {

    @Test
    fun `audio time formats below an hour as minutes and seconds`() {
        assertEquals("0:00", formatTime(0))
        assertEquals("0:05", formatTime(5_000))
        assertEquals("1:01", formatTime(61_000))
        assertEquals("9:59", formatTime(599_000))
    }

    @Test
    fun `audio time includes hours for long recordings`() {
        assertEquals("1:00:00", formatTime(3_600_000))
        assertEquals("2:03:04", formatTime(7_384_000))
    }

    @Test
    fun `negative positions are treated as zero`() {
        assertEquals("0:00", formatTime(-1_500))
    }

    @Test
    fun `scroll progress leaves the final percent for completion`() {
        assertEquals(70, scrollProgressPercent(firstVisibleIndex = 6, totalBlocks = 10))
        assertEquals(99, scrollProgressPercent(firstVisibleIndex = 9, totalBlocks = 10))
        assertEquals(99, scrollProgressPercent(firstVisibleIndex = 0, totalBlocks = 1))
        assertEquals(0, scrollProgressPercent(firstVisibleIndex = 0, totalBlocks = 0))
    }

    @Test
    fun `out of range scroll indexes are clamped`() {
        assertEquals(10, scrollProgressPercent(firstVisibleIndex = -4, totalBlocks = 10))
        assertEquals(99, scrollProgressPercent(firstVisibleIndex = 99, totalBlocks = 10))
    }

    @Test
    fun `resume index matches the saved block order`() {
        val blocks = listOf(block(0), block(5), block(9))
        assertEquals(1, resumeBlockIndex(blocks, lastBlockOrder = 5))
        assertEquals(2, resumeBlockIndex(blocks, lastBlockOrder = 8))
    }

    @Test
    fun `resume is tolerant of missing or unknown positions`() {
        val blocks = listOf(block(0), block(1))
        assertEquals(0, resumeBlockIndex(blocks, lastBlockOrder = null))
        assertEquals(0, resumeBlockIndex(blocks, lastBlockOrder = 42))
        assertEquals(0, resumeBlockIndex(emptyList(), lastBlockOrder = 3))
    }

    private fun block(order: Int) = LessonBlockDto(
        id = "block-$order",
        type = "PARAGRAPH",
        order = order,
        payload = JsonObject(emptyMap()),
    )
}
