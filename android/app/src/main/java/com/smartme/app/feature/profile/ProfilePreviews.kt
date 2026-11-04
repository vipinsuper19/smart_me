package com.smartme.app.feature.profile

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.core.model.UiState
import com.smartme.app.core.model.UserSummary

private val previewUser = UserSummary(
    id = "preview-user",
    email = "aarav.sharma@example.com",
    name = "Aarav Sharma",
    avatarUrl = null,
    onboardingCompleted = true,
)

@ScreenPreviews
@Composable
private fun ProfileSignedInPreview() {
    PreviewContainer {
        ProfileContent(
            state = UiState.Content(ProfileSamples.profile),
            fallbackUser = previewUser,
            onRetry = {},
            onEditProfile = {},
            onLearningPreferences = {},
            onNotificationSettings = {},
            onSubscription = {},
            onSupport = {},
            onPrivacy = {},
            onSignOut = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun ProfileSignedOutPreview() {
    PreviewContainer {
        ProfileContent(
            state = UiState.Empty,
            fallbackUser = null,
            onRetry = {},
            onEditProfile = {},
            onLearningPreferences = {},
            onNotificationSettings = {},
            onSubscription = {},
            onSupport = {},
            onPrivacy = {},
            onSignOut = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun ProfileErrorPreview() {
    PreviewContainer {
        ProfileContent(
            state = UiState.Error(
                message = "We couldn't reach SmartMe. Check your connection and try again.",
                code = "NETWORK_UNAVAILABLE",
            ),
            fallbackUser = previewUser,
            onRetry = {},
            onEditProfile = {},
            onLearningPreferences = {},
            onNotificationSettings = {},
            onSubscription = {},
            onSupport = {},
            onPrivacy = {},
            onSignOut = {},
        )
    }
}
