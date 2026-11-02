package com.smartme.app.feature.auth.welcome

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews

@ScreenPreviews
@Composable
private fun WelcomeScreenPreview() {
    PreviewContainer {
        WelcomeScreen(
            onGetStarted = {},
            onSignIn = {},
        )
    }
}
