package com.smartme.app.feature.auth.register

import androidx.compose.runtime.Composable
import com.smartme.app.R
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.feature.common.UiText

@ScreenPreviews
@Composable
private fun RegisterScreenPreview() {
    PreviewContainer {
        RegisterContent(
            state = RegisterUiState(googleAvailable = true),
            onBack = {},
            onSignIn = {},
            onNameChange = {},
            onEmailChange = {},
            onPasswordChange = {},
            onConfirmPasswordChange = {},
            onTogglePasswordVisibility = {},
            onAcceptTermsChange = {},
            onAcceptPrivacyChange = {},
            onSubmit = {},
            onGoogleSignUp = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun RegisterFilledPreview() {
    PreviewContainer {
        RegisterContent(
            state = RegisterUiState(
                name = "Aarav Sharma",
                email = "aarav@example.com",
                password = "Walkthrough1",
                confirmPassword = "Walkthrough1",
                acceptTerms = true,
                acceptPrivacy = true,
                googleAvailable = true,
            ),
            onBack = {},
            onSignIn = {},
            onNameChange = {},
            onEmailChange = {},
            onPasswordChange = {},
            onConfirmPasswordChange = {},
            onTogglePasswordVisibility = {},
            onAcceptTermsChange = {},
            onAcceptPrivacyChange = {},
            onSubmit = {},
            onGoogleSignUp = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun RegisterErrorsPreview() {
    PreviewContainer {
        RegisterContent(
            state = RegisterUiState(
                name = "Aarav Sharma",
                email = "aarav@example.com",
                password = "short",
                confirmPassword = "different",
                passwordError = R.string.auth_error_password_length,
                confirmPasswordError = R.string.auth_error_password_mismatch,
                termsError = true,
                formError = UiText.Plain("That email is already registered."),
                googleAvailable = true,
            ),
            onBack = {},
            onSignIn = {},
            onNameChange = {},
            onEmailChange = {},
            onPasswordChange = {},
            onConfirmPasswordChange = {},
            onTogglePasswordVisibility = {},
            onAcceptTermsChange = {},
            onAcceptPrivacyChange = {},
            onSubmit = {},
            onGoogleSignUp = {},
        )
    }
}
