package com.smartme.app.data.auth

import com.smartme.app.core.network.ApiExecutor
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.AuthApi
import com.smartme.app.core.network.AuthResponseDto
import com.smartme.app.core.network.GoogleLoginRequest
import com.smartme.app.core.network.LoginRequest
import com.smartme.app.core.network.RefreshRequest
import com.smartme.app.core.network.RegisterRequest
import com.smartme.app.core.network.SmartMeApi
import com.smartme.app.core.model.UserSummary
import com.smartme.app.core.security.TokenStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Owns authentication side effects: calls the API, stores the encrypted session,
 * records the onboarding flag and exposes the current learner in memory.
 *
 * Every method returns [ApiResult] so screens render the shared error copy
 * instead of handling HTTP or serialization failures themselves.
 */
@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val api: SmartMeApi,
    private val executor: ApiExecutor,
    private val tokenStore: TokenStore,
    private val sessionPreferences: SessionPreferences,
) {

    private val _currentUser = MutableStateFlow<UserSummary?>(null)
    val currentUser: StateFlow<UserSummary?> = _currentUser.asStateFlow()

    suspend fun login(email: String, password: String): ApiResult<UserSummary> =
        executor.call {
            authApi.login(LoginRequest(email = email.trim().lowercase(), password = password))
        }.adoptSession()

    suspend fun register(
        email: String,
        password: String,
        name: String?,
        acceptTerms: Boolean,
        acceptPrivacy: Boolean,
    ): ApiResult<UserSummary> = executor.call {
        authApi.register(
            RegisterRequest(
                email = email.trim().lowercase(),
                password = password,
                name = name?.trim()?.takeIf { it.isNotBlank() },
                acceptTerms = acceptTerms,
                acceptPrivacy = acceptPrivacy,
            ),
        )
    }.adoptSession()

    /**
     * @param consentGranted consent is only required when the backend creates a
     * new account; existing Google identities can sign in without it.
     */
    suspend fun signInWithGoogle(idToken: String, consentGranted: Boolean): ApiResult<UserSummary> =
        executor.call {
            authApi.google(
                GoogleLoginRequest(
                    idToken = idToken,
                    acceptTerms = if (consentGranted) true else null,
                    acceptPrivacy = if (consentGranted) true else null,
                ),
            )
        }.adoptSession()

    suspend fun me(): ApiResult<UserSummary> {
        return when (val result = executor.call { api.me() }) {
            is ApiResult.Success -> {
                val user = result.data.toUserSummary()
                recordUser(user)
                ApiResult.Success(user)
            }

            is ApiResult.Failure -> result
        }
    }

    suspend fun completeOnboarding(request: com.smartme.app.core.network.OnboardingCompleteRequest): ApiResult<Unit> {
        return when (val result = executor.call { api.completeOnboarding(request) }) {
            is ApiResult.Success -> {
                sessionPreferences.setOnboardingCompleted(true)
                _currentUser.value = _currentUser.value?.copy(onboardingCompleted = true)
                ApiResult.Success(Unit)
            }

            is ApiResult.Failure -> result
        }
    }

    /**
     * Clears the local session first so sign-out is immediate, then revokes the
     * refresh token on a best-effort basis. A failed request must never keep the
     * learner signed in on this device.
     */
    suspend fun logout() {
        val refreshToken = tokenStore.session.value?.refreshToken
        tokenStore.clear()
        sessionPreferences.setOnboardingCompleted(null)
        _currentUser.value = null
        if (refreshToken != null) {
            runCatching { authApi.logout(RefreshRequest(refreshToken)) }
        }
    }

    private suspend fun ApiResult<AuthResponseDto>.adoptSession(): ApiResult<UserSummary> = when (this) {
        is ApiResult.Success -> {
            tokenStore.save(data.tokens.toSessionTokens())
            val user = data.user.toUserSummary()
            recordUser(user)
            ApiResult.Success(user)
        }

        is ApiResult.Failure -> this
    }

    private suspend fun recordUser(user: UserSummary) {
        _currentUser.value = user
        sessionPreferences.setOnboardingCompleted(user.onboardingCompleted)
    }
}
