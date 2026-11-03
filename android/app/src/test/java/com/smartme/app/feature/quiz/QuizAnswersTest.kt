package com.smartme.app.feature.quiz

import com.smartme.app.core.network.QuizSavedAnswerDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class QuizAnswersTest {

    @Test
    fun `saved selections are restored by question`() {
        val restored = savedAnswersToMap(
            listOf(
                QuizSavedAnswerDto(questionId = "q1", selectedOptionId = "o1"),
                QuizSavedAnswerDto(questionId = "q2", selectedOptionId = "o2"),
            ),
        )

        assertEquals(mapOf("q1" to "o1", "q2" to "o2"), restored)
    }

    @Test
    fun `unanswered questions are omitted`() {
        val restored = savedAnswersToMap(
            listOf(
                QuizSavedAnswerDto(questionId = "q1", selectedOptionId = null),
                QuizSavedAnswerDto(questionId = "q2", selectedOptionId = "o2"),
            ),
        )

        assertEquals(mapOf("q2" to "o2"), restored)
    }

    @Test
    fun `an empty attempt restores to no selections`() {
        assertTrue(savedAnswersToMap(emptyList()).isEmpty())
    }
}
