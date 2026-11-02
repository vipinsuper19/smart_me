package com.smartme.app.feature.auth.createaccount

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.R
import com.smartme.app.core.network.ApiResult
import com.smartme.app.data.auth.AuthRepository
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

data class CreateAccountUiState(
    val googleAvailable: Boolean = false,
    val googleLoading: Boolean = false,
    val consentRequired: Boolean = false,
    val formError: UiText? = null,
)

/**
 * Backs the provider chooser shown before the email form.
 *
 * Only Google needs state here: the email paths simply navigate to the existing
 * registration form, which owns its own validation and submission.
 */
@HiltViewModel
class CreateAccountViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val googleSignInClient: GoogleSignInClient,
) : ViewModel() {

    private val _state = MutableStateFlow(
        CreateAccountUiState(googleAvailable = googleSignInClient.isConfigured),
    )
    val state: StateFlow<CreateAccountUiState> = _state.asStateFlow()

    private var pendingGoogleToken: String? = null

    fun signUpWithGoogle(activityContext: Context) {
        if (_state.value.googleLoading) return
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
