package com.smartme.app.feature.auth.register

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.R
import com.smartme.app.core.network.ApiResult
import com.smartme.app.data.auth.AuthRepository
import com.smartme.app.feature.auth.AuthValidation
import com.smartme.app.feature.auth.GoogleIdTokenResult
import com.smartme.app.feature.auth.GoogleSignInClient
import com.smartme.app.feature.auth.signin.toSignInMessage
import com.smartme.app.feature.common.UiText
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RegisterUiState(
    val name: String = "",
    val email: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val passwordVisible: Boolean = false,
    val acceptTerms: Boolean = false,
    val acceptPrivacy: Boolean = false,
    val nameError: Int? = null,
    val emailError: Int? = null,
    val passwordError: Int? = null,
    val confirmPasswordError: Int? = null,
    val termsError: Boolean = false,
    val formError: UiText? = null,
    val submitting: Boolean = false,
    val googleLoading: Boolean = false,
    val googleAvailable: Boolean = false,
    val consentRequired: Boolean = false,
) {
    val busy: Boolean get() = submitting || googleLoading
    val consentGiven: Boolean get() = acceptTerms && acceptPrivacy
}

@HiltViewModel
class RegisterViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val googleSignInClient: GoogleSignInClient,
) : ViewModel() {

    private val _state = MutableStateFlow(
        RegisterUiState(googleAvailable = googleSignInClient.isConfigured),
    )
    val state: StateFlow<RegisterUiState> = _state.asStateFlow()

    private var pendingGoogleToken: String? = null

    fun onNameChange(value: String) {
        _state.update { it.copy(name = value, nameError = null, formError = null) }
    }

    fun onEmailChange(value: String) {
        _state.update { it.copy(email = value, emailError = null, formError = null) }
    }

    fun onPasswordChange(value: String) {
        _state.update {
            it.copy(password = value, passwordError = null, confirmPasswordError = null, formError = null)
        }
    }

    fun onConfirmPasswordChange(value: String) {
        _state.update { it.copy(confirmPassword = value, confirmPasswordError = null, formError = null) }
    }

    fun togglePasswordVisibility() {
        _state.update { it.copy(passwordVisible = !it.passwordVisible) }
    }

    fun onAcceptTermsChange(accepted: Boolean) {
        _state.update { it.copy(acceptTerms = accepted, termsError = false) }
    }

    fun onAcceptPrivacyChange(accepted: Boolean) {
        _state.update { it.copy(acceptPrivacy = accepted, termsError = false) }
    }

    fun submit() {
        val current = _state.value
        if (current.busy) return

        val nameError = AuthValidation.nameError(current.name)
        val emailError = AuthValidation.emailError(current.email)
        val passwordError = AuthValidation.passwordError(current.password)
        val confirmPasswordError = AuthValidation.confirmPasswordError(
            password = current.password,
            confirmation = current.confirmPassword,
        )
        val termsError = !current.consentGiven

        if (nameError != null || emailError != null || passwordError != null ||
            confirmPasswordError != null || termsError
        ) {
            _state.update {
                it.copy(
                    nameError = nameError,
                    emailError = emailError,
                    passwordError = passwordError,
                    confirmPasswordError = confirmPasswordError,
                    termsError = termsError,
                )
            }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(submitting = true, formError = null) }
            val result = authRepository.register(
                email = current.email.trim(),
                password = current.password,
                name = current.name.trim().takeIf { name -> name.isNotBlank() },
                acceptTerms = current.acceptTerms,
                acceptPrivacy = current.acceptPrivacy,
            )
            _state.update {
                it.copy(
                    submitting = false,
                    formError = (result as? ApiResult.Failure)?.error?.toSignInMessage(),
                )
            }
        }
    }

    fun signUpWithGoogle(activityContext: Context) {
        val current = _state.value
        if (current.busy) return
        if (!current.consentGiven) {
            _state.update { it.copy(termsError = true) }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(googleLoading = true, formError = null) }
            when (val token = googleSignInClient.idToken(activityContext)) {
                is GoogleIdTokenResult.Success -> submitGoogle(token.idToken, consentGranted = true)
                GoogleIdTokenResult.Cancelled -> _state.update { it.copy(googleLoading = false) }
                GoogleIdTokenResult.Failed -> _state.update {
                    it.copy(
                        googleLoading = false,
                        formError = UiText.Resource(R.string.auth_error_google),
                    )
                }
            }
        }
    }

    fun acceptGoogleConsent() {
        val token = pendingGoogleToken ?: return
        pendingGoogleToken = null
        _state.update { it.copy(consentRequired = false) }
        viewModelScope.launch { submitGoogle(token, consentGranted = true) }
    }

    fun dismissGoogleConsent() {
        pendingGoogleToken = null
        _state.update { it.copy(consentRequired = false) }
    }

    private suspend fun submitGoogle(idToken: String, consentGranted: Boolean) {
        _state.update { it.copy(googleLoading = true, formError = null) }
        when (val result = authRepository.signInWithGoogle(idToken, consentGranted)) {
            is ApiResult.Success -> _state.update { it.copy(googleLoading = false) }

            is ApiResult.Failure -> {
                if (result.error.code == TERMS_ACCEPTANCE_REQUIRED) {
                    pendingGoogleToken = idToken
                    _state.update { it.copy(googleLoading = false, consentRequired = true) }
                } else {
                    _state.update {
                        it.copy(googleLoading = false, formError = result.error.toSignInMessage())
                    }
                }
            }
        }
    }

    private companion object {
        const val TERMS_ACCEPTANCE_REQUIRED = "TERMS_ACCEPTANCE_REQUIRED"
    }
}
