package com.smartme.app.feature.explore

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.core.model.UiState
import com.smartme.app.feature.learning.LearningSamples

@ScreenPreviews
@Composable
private fun CourseDetailPreview() {
    PreviewContainer {
        CourseDetailContent(
            state = UiState.Content(LearningSamples.course),
            onBack = {},
            onRetry = {},
            onOpenLesson = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun CourseDetailLoadingPreview() {
    PreviewContainer {
        CourseDetailContent(
            state = UiState.Loading,
            onBack = {},
            onRetry = {},
            onOpenLesson = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun CourseDetailErrorPreview() {
    PreviewContainer {
        CourseDetailContent(
            state = UiState.Error(
                message = "We couldn't reach SmartMe. Check your connection and try again.",
            ),
            onBack = {},
            onRetry = {},
            onOpenLesson = {},
        )
    }
}
