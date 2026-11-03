package com.smartme.app.feature.lesson

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.LessonCompletionDto
import com.smartme.app.core.network.RewardResultDto
import com.smartme.app.feature.learning.LearningSamples

@ScreenPreviews
@Composable
private fun LessonReadingPreview() {
    PreviewContainer {
        LessonContent(
            state = LessonUiState(
                content = UiState.Content(LearningSamples.lesson),
            ),
            onBack = {},
            onRetry = {},
            onScrollChanged = { _, _ -> },
            onComplete = {},
            onDismissCompletion = {},
            onOpenQuiz = {},
            onOpenLesson = {},
            onDone = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun LessonCompletedPreview() {
    PreviewContainer {
        LessonContent(
            state = LessonUiState(
                content = UiState.Content(
                    LearningSamples.lesson.copy(progress = LearningSamples.completed),
                ),
            ),
            onBack = {},
            onRetry = {},
            onScrollChanged = { _, _ -> },
            onComplete = {},
            onDismissCompletion = {},
            onOpenQuiz = {},
            onOpenLesson = {},
            onDone = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun LessonCompletionDialogPreview() {
    PreviewContainer {
        LessonContent(
            state = LessonUiState(
                content = UiState.Content(
                    LearningSamples.lesson.copy(progress = LearningSamples.completed),
                ),
                completion = LessonCompletionDto(
                    lessonId = LearningSamples.lesson.id,
                    status = "COMPLETED",
                    progressPercent = 100,
                    completedAt = "2026-11-03T09:10:00.000Z",
                    rewards = RewardResultDto(xpEarned = 10, totalXp = 250, level = 3),
                ),
            ),
            onBack = {},
            onRetry = {},
            onScrollChanged = { _, _ -> },
            onComplete = {},
            onDismissCompletion = {},
            onOpenQuiz = {},
            onOpenLesson = {},
            onDone = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun LessonLoadingPreview() {
    PreviewContainer {
        LessonContent(
            state = LessonUiState(content = UiState.Loading),
            onBack = {},
            onRetry = {},
            onScrollChanged = { _, _ -> },
            onComplete = {},
            onDismissCompletion = {},
            onOpenQuiz = {},
            onOpenLesson = {},
            onDone = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun LessonErrorPreview() {
    PreviewContainer {
        LessonContent(
            state = LessonUiState(
                content = UiState.Error(
                    message = "We couldn't reach SmartMe. Check your connection and try again.",
                    code = "NETWORK_UNAVAILABLE",
                ),
            ),
            onBack = {},
            onRetry = {},
            onScrollChanged = { _, _ -> },
            onComplete = {},
            onDismissCompletion = {},
            onOpenQuiz = {},
            onOpenLesson = {},
            onDone = {},
        )
    }
}
