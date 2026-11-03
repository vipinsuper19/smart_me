package com.smartme.app.feature.explore

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.core.model.UiState
import com.smartme.app.feature.learning.LearningSamples

@ScreenPreviews
@Composable
private fun PathDetailPreview() {
    PreviewContainer {
        PathDetailContent(
            state = UiState.Content(LearningSamples.path),
            onBack = {},
            onRetry = {},
            onOpenCourse = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun PathDetailLoadingPreview() {
    PreviewContainer {
        PathDetailContent(
            state = UiState.Loading,
            onBack = {},
            onRetry = {},
            onOpenCourse = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun PathDetailErrorPreview() {
    PreviewContainer {
        PathDetailContent(
            state = UiState.Error(
                message = "We couldn't reach SmartMe. Check your connection and try again.",
            ),
            onBack = {},
            onRetry = {},
            onOpenCourse = {},
        )
    }
}
