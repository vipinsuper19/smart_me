package com.smartme.app.feature.progress

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.core.model.UiState

@ScreenPreviews
@Composable
private fun ProgressDashboardPreview() {
    PreviewContainer {
        ProgressContent(
            state = UiState.Content(
                ProgressData(
                    overview = ProgressSamples.overview,
                    weekly = ProgressSamples.weekly,
                    achievements = ProgressSamples.achievements,
                ),
            ),
            onRetry = {},
            onOpenAchievements = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun ProgressLoadingPreview() {
    PreviewContainer {
        ProgressContent(
            state = UiState.Loading,
            onRetry = {},
            onOpenAchievements = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun ProgressErrorPreview() {
    PreviewContainer {
        ProgressContent(
            state = UiState.Error(
                message = "We couldn't reach SmartMe. Check your connection and try again.",
                code = "NETWORK_UNAVAILABLE",
            ),
            onRetry = {},
            onOpenAchievements = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun ProgressEmptyPreview() {
    PreviewContainer {
        ProgressContent(
            state = UiState.Empty,
            onRetry = {},
            onOpenAchievements = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun AchievementsListPreview() {
    PreviewContainer {
        AchievementsContent(
            state = UiState.Content(ProgressSamples.achievements),
            onRetry = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun AchievementsEmptyPreview() {
    PreviewContainer {
        AchievementsContent(
            state = UiState.Empty,
            onRetry = {},
        )
    }
}
