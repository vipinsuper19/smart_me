package com.smartme.app.feature.quiz

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.QuizResultOptionDto
import com.smartme.app.feature.learning.LearningSamples

private val previewContent = QuizContent(
    quiz = LearningSamples.quiz,
    attempt = LearningSamples.attempt,
    answers = mapOf("question-1" to "option-present"),
    lessonId = LearningSamples.lesson.id,
)

@ScreenPreviews
@Composable
private fun QuizQuestionPreview() {
    PreviewContainer {
        QuizScreenContent(
            state = QuizUiState(content = UiState.Content(previewContent)),
            onBack = {},
            onRetry = {},
            onSelectAnswer = { _, _ -> },
            onNext = {},
            onPrevious = {},
            onSubmit = {},
            onRetryQuiz = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun QuizPassedResultPreview() {
    PreviewContainer {
        QuizScreenContent(
            state = QuizUiState(
                content = UiState.Content(previewContent),
                result = LearningSamples.quizSubmission,
                lessonCompleted = true,
            ),
            onBack = {},
            onRetry = {},
            onSelectAnswer = { _, _ -> },
            onNext = {},
            onPrevious = {},
            onSubmit = {},
            onRetryQuiz = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun QuizFailedResultPreview() {
    val submission = LearningSamples.quizSubmission
    PreviewContainer {
        QuizScreenContent(
            state = QuizUiState(
                content = UiState.Content(previewContent),
                result = submission.copy(
                    attempt = submission.attempt.copy(
                        passed = false,
                        score = 50,
                        correctCount = 1,
                        xpAwarded = 0,
                    ),
                    questions = submission.questions.map { question ->
                        question.copy(
                            selectedOptionId = "option-childhood",
                            isCorrect = false,
                            earnedPoints = 0,
                            options = listOf(
                                QuizResultOptionDto(
                                    id = "option-present",
                                    text = "Start with the present",
                                    order = 0,
                                    isCorrect = true,
                                ),
                                QuizResultOptionDto(
                                    id = "option-childhood",
                                    text = "Start with childhood",
                                    order = 1,
                                    selected = true,
                                ),
                            ),
                        )
                    },
                ),
            ),
            onBack = {},
            onRetry = {},
            onSelectAnswer = { _, _ -> },
            onNext = {},
            onPrevious = {},
            onSubmit = {},
            onRetryQuiz = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun QuizLoadingPreview() {
    PreviewContainer {
        QuizScreenContent(
            state = QuizUiState(content = UiState.Loading),
            onBack = {},
            onRetry = {},
            onSelectAnswer = { _, _ -> },
            onNext = {},
            onPrevious = {},
            onSubmit = {},
            onRetryQuiz = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun QuizEmptyPreview() {
    PreviewContainer {
        QuizScreenContent(
            state = QuizUiState(content = UiState.Empty),
            onBack = {},
            onRetry = {},
            onSelectAnswer = { _, _ -> },
            onNext = {},
            onPrevious = {},
            onSubmit = {},
            onRetryQuiz = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun QuizErrorPreview() {
    PreviewContainer {
        QuizScreenContent(
            state = QuizUiState(
                content = UiState.Error(
                    message = "We couldn't reach SmartMe. Check your connection and try again.",
                    code = "NETWORK_UNAVAILABLE",
                ),
            ),
            onBack = {},
            onRetry = {},
            onSelectAnswer = { _, _ -> },
            onNext = {},
            onPrevious = {},
            onSubmit = {},
            onRetryQuiz = {},
        )
    }
}
