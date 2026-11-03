package com.smartme.app.feature.home

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.core.model.UiState
import com.smartme.app.feature.learning.LearningSamples

@ScreenPreviews
@Composable
private fun HomeDashboardPreview() {
    PreviewContainer {
        HomeContent(
            state = UiState.Content(
                HomeData(
                    summary = LearningSamples.summary,
                    continueLearning = LearningSamples.continueItem,
                    recommended = LearningSamples.recommendation,
                ),
            ),
            userName = "Aarav",
            onRetry = {},
            onOpenLesson = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun HomeNewLearnerPreview() {
    PreviewContainer {
        HomeContent(
            state = UiState.Content(
                HomeData(
                    summary = LearningSamples.summary.copy(
                        currentStreak = 0,
                        totalXp = 0,
                        level = 1,
                    ),
                    continueLearning = null,
                    recommended = LearningSamples.recommendation,
                ),
            ),
            userName = "",
            onRetry = {},
            onOpenLesson = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun HomeLoadingPreview() {
    PreviewContainer {
        HomeContent(
            state = UiState.Loading,
            userName = "Aarav",
            onRetry = {},
            onOpenLesson = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun HomeErrorPreview() {
    PreviewContainer {
        HomeContent(
            state = UiState.Error(
                message = "We couldn't reach SmartMe. Check your connection and try again.",
                code = "NETWORK_UNAVAILABLE",
            ),
            userName = "Aarav",
            onRetry = {},
            onOpenLesson = {},
        )
    }
}
