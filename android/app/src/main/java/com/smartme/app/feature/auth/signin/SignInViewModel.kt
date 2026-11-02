package com.smartme.app.feature.auth.signin

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.R
import com.smartme.app.core.network.ApiError
import com.smartme.app.core.network.ApiResult
import com.smartme.app.data.auth.AuthRepository
import com.smartme.app.feature.auth.AuthValidation
import com.smartme.app.feature.auth.GoogleIdTokenResult
import com.smartme.app.feature.auth.GoogleSignInClient
import com.smartme.app.feature.common.UiText
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SignInUiState(
    val email: String = "",
    val password: String = "",
    val passwordVisible: Boolean = false,
    val emailError: Int? = null,
    val passwordError: Int? = null,
    val formError: UiText? = null,
    val submitting: Boolean = false,
    val googleLoading: Boolean = false,
    val googleAvailable: Boolean = false,
    val consentRequired: Boolean = false,
) {
    val busy: Boolean get() = submitting || googleLoading
}

@HiltViewModel
class SignInViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val googleSignInClient: GoogleSignInClient,
) : ViewModel() {

    private val _state = MutableStateFlow(
        SignInUiState(googleAvailable = googleSignInClient.isConfigured),
    )
    val state: StateFlow<SignInUiState> = _state.asStateFlow()

    /** Holds the ID token while the learner accepts the terms for a new account. */
    private var pendingGoogleToken: String? = null

    fun onEmailChange(value: String) {
        _state.update { it.copy(email = value, emailError = null, formError = null) }
    }

    fun onPasswordChange(value: String) {
        _state.update { it.copy(password = value, passwordError = null, formError = null) }
    }

    fun togglePasswordVisibility() {
        _state.update { it.copy(passwordVisible = !it.passwordVisible) }
    }

    fun submit() {
        val current = _state.value
        if (current.busy) return

        val emailError = AuthValidation.emailError(current.email)
        val passwordError = AuthValidation.passwordError(current.password)
        if (emailError != null || passwordError != null) {
            _state.update { it.copy(emailError = emailError, passwordError = passwordError) }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(submitting = true, formError = null) }
            val result = authRepository.login(current.email.trim(), current.password)
            _state.update {
                it.copy(
                    submitting = false,
                    formError = (result as? ApiResult.Failure)?.error?.toSignInMessage(),
                )
            }
        }
    }

    fun signInWithGoogle(activityContext: Context) {
        if (_state.value.busy) return
        viewModelScope.launch {
            _state.update { it.copy(googleLoading = true, formError = null) }
            when (val token = googleSignInClient.idToken(activityContext)) {
                is GoogleIdTokenResult.Success -> submitGoogle(token.idToken, consentGranted = false)
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

internal fun ApiError.toSignInMessage(): UiText = when (code) {
    "INVALID_CREDENTIALS" -> UiText.Resource(R.string.auth_error_invalid_credentials)
    else -> UiText.Plain(message)
}
