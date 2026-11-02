package com.smartme.app.feature.profile

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
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
        ProfileScreen(user = previewUser, onSignOut = {})
    }
}

@ScreenPreviews
@Composable
private fun ProfileSignedOutPreview() {
    PreviewContainer {
        ProfileScreen(user = null, onSignOut = {})
    }
}
