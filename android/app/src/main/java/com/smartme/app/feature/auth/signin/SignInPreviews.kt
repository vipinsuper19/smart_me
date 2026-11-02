package com.smartme.app.feature.auth.signin

import androidx.compose.runtime.Composable
import com.smartme.app.R
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.feature.common.UiText

@ScreenPreviews
@Composable
private fun SignInScreenPreview() {
    PreviewContainer {
        SignInContent(
            state = SignInUiState(googleAvailable = true),
            onBack = {},
            onCreateAccount = {},
            onEmailChange = {},
            onPasswordChange = {},
            onTogglePasswordVisibility = {},
            onSubmit = {},
            onGoogleSignIn = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun SignInFilledPreview() {
    PreviewContainer {
        SignInContent(
            state = SignInUiState(
                email = "aarav@example.com",
                password = "Walkthrough1",
                passwordVisible = true,
                googleAvailable = true,
            ),
            onBack = {},
            onCreateAccount = {},
            onEmailChange = {},
            onPasswordChange = {},
            onTogglePasswordVisibility = {},
            onSubmit = {},
            onGoogleSignIn = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun SignInErrorsPreview() {
    PreviewContainer {
        SignInContent(
            state = SignInUiState(
                email = "aarav",
                emailError = R.string.auth_error_email_invalid,
                passwordError = R.string.auth_error_password_required,
                formError = UiText.Resource(R.string.auth_error_invalid_credentials),
                googleAvailable = true,
            ),
            onBack = {},
            onCreateAccount = {},
            onEmailChange = {},
            onPasswordChange = {},
            onTogglePasswordVisibility = {},
            onSubmit = {},
            onGoogleSignIn = {},
        )
    }
}
