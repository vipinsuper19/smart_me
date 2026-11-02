package com.smartme.app.feature.home

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.core.model.UiState

@ScreenPreviews
@Composable
private fun HomeConnectedPreview() {
    PreviewContainer {
        HomeContent(
            state = UiState.Content(
                BackendStatus(service = "SmartMe API", version = "0.1.0"),
            ),
            onRetry = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun HomeLoadingPreview() {
    PreviewContainer {
        HomeContent(state = UiState.Loading, onRetry = {})
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
            onRetry = {},
        )
    }
}
