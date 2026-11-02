package com.smartme.app.feature.auth.createaccount

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews

@ScreenPreviews
@Composable
private fun CreateAccountScreenPreview() {
    PreviewContainer {
        CreateAccountContent(
            state = CreateAccountUiState(googleAvailable = true),
            onBack = {},
            onContinueWithEmail = {},
            onSignIn = {},
            onGoogleClick = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun CreateAccountGoogleLoadingPreview() {
    PreviewContainer {
        CreateAccountContent(
            state = CreateAccountUiState(googleAvailable = true, googleLoading = true),
            onBack = {},
            onContinueWithEmail = {},
            onSignIn = {},
            onGoogleClick = {},
            googleEnabled = false,
        )
    }
}

@ScreenPreviews
@Composable
private fun CreateAccountEmailOnlyPreview() {
    PreviewContainer {
        CreateAccountContent(
            state = CreateAccountUiState(googleAvailable = false),
            onBack = {},
            onContinueWithEmail = {},
            onSignIn = {},
            onGoogleClick = {},
        )
    }
}
