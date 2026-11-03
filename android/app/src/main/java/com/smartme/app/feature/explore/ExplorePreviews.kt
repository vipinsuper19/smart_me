package com.smartme.app.feature.explore

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.core.model.UiState
import com.smartme.app.feature.learning.LearningSamples

@ScreenPreviews
@Composable
private fun ExploreCataloguePreview() {
    PreviewContainer {
        ExploreContent(
            state = ExploreUiState(paths = UiState.Content(LearningSamples.paths)),
            onQueryChange = {},
            onRetry = {},
            onOpenPath = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun ExploreNoResultsPreview() {
    PreviewContainer {
        ExploreContent(
            state = ExploreUiState(
                paths = UiState.Content(LearningSamples.paths),
                query = "accounting",
            ),
            onQueryChange = {},
            onRetry = {},
            onOpenPath = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun ExploreLoadingPreview() {
    PreviewContainer {
        ExploreContent(
            state = ExploreUiState(paths = UiState.Loading),
            onQueryChange = {},
            onRetry = {},
            onOpenPath = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun ExploreErrorPreview() {
    PreviewContainer {
        ExploreContent(
            state = ExploreUiState(
                paths = UiState.Error(
                    message = "We couldn't reach SmartMe. Check your connection and try again.",
                    code = "NETWORK_UNAVAILABLE",
                ),
            ),
            onQueryChange = {},
            onRetry = {},
            onOpenPath = {},
        )
    }
}
