package com.smartme.app.feature.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.core.model.UserSummary
import com.smartme.app.core.network.ApiError
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.security.SessionTokens
import com.smartme.app.core.security.TokenStore
import com.smartme.app.data.auth.AuthRepository
import com.smartme.app.data.auth.SessionPreferences
import com.smartme.app.data.onboarding.OnboardingDraftStore
import com.smartme.app.data.onboarding.OnboardingRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Decides which shell the app shows and keeps it in sync with the encrypted
 * session.
 *
 * On a cold start it trusts the cached `onboarding_completed` flag so the Home
 * tab appears immediately, then refreshes the learner in the background. With no
 * cache it waits for `GET /auth/me`, which also covers accounts that finished
 * onboarding on another device.
 */
@HiltViewModel
class SessionViewModel @Inject constructor(
    private val tokenStore: TokenStore,
    private val sessionPreferences: SessionPreferences,
    private val authRepository: AuthRepository,
    private val onboardingRepository: OnboardingRepository,
    private val draftStore: OnboardingDraftStore,
) : ViewModel() {

    private val _state = MutableStateFlow<SessionState>(SessionState.Restoring)
    val state: StateFlow<SessionState> = _state.asStateFlow()

    private var userRefreshJob: Job? = null

    private val launchedAtMillis = System.currentTimeMillis()
    private var splashDismissed = false

    init {
        viewModelScope.launch {
            combine(
                tokenStore.isRestored,
                tokenStore.session,
            ) { restored, session -> restored to session }
                .collect { (restored, session) -> onSessionChanged(restored, session) }
        }
    }

    private suspend fun onSessionChanged(restored: Boolean, session: SessionTokens?) {
        if (!restored) {
            _state.value = SessionState.Restoring
            return
        }
        if (session == null) {
            userRefreshJob?.cancel()
            showAfterSplash(SessionState.SignedOut)
            return
        }

        val knownUser = authRepository.currentUser.value
        if (knownUser != null) {
            showAfterSplash(settle(knownUser))
            return
        }

        when (sessionPreferences.onboardingCompleted()) {
            // Cached: show the right shell now and refresh the name in the background.
            true -> {
                showAfterSplash(SessionState.Ready(null))
                refreshUserInBackground()
            }

            false -> {
                showAfterSplash(SessionState.NeedsOnboarding(null))
                refreshUserInBackground()
            }

            // First launch with a session (for example after reinstalling): ask the API.
            null -> {
                _state.value = SessionState.Restoring
                resolveUser()
            }
        }
    }

    /**
     * Leaves the splash for the first resolved state.
     *
     * Restoring the session usually finishes in a few milliseconds, which would
     * flash the branded splash past the learner. Holding it briefly gives the
     * launch a stable first frame; later transitions are published immediately.
     */
    private suspend fun showAfterSplash(state: SessionState) {
        if (!splashDismissed) {
            val elapsed = System.currentTimeMillis() - launchedAtMillis
            if (elapsed < MinimumSplashMillis) {
                delay(MinimumSplashMillis - elapsed)
            }
            splashDismissed = true
        }
        _state.value = state
    }

    /** Fetches the learner and decides whether onboarding is still required. */
    private suspend fun resolveUser() {
        when (val result = authRepository.me()) {
            is ApiResult.Success -> showAfterSplash(settle(result.data))
            is ApiResult.Failure -> showAfterSplash(failureState(result.error))
        }
    }

    private fun refreshUserInBackground() {
        if (userRefreshJob?.isActive == true) return
        userRefreshJob = viewModelScope.launch {
            when (val result = authRepository.me()) {
                is ApiResult.Success -> {
                    if (tokenStore.session.value == null) {
                        _state.value = SessionState.SignedOut
                    } else {
                        _state.value = settle(result.data)
                    }
                }

                is ApiResult.Failure -> {
                    // The optimistic state stays; a 403 means the account is unusable.
                    if (result.error.httpStatus == 403) {
                        tokenStore.clear()
                        _state.value = SessionState.SignedOut
                    }
                }
            }
        }
    }

    /**
     * A signed-in account that has not finished onboarding consumes the draft
     * collected before sign-up. If the submission fails, the wizard is shown so
     * the learner can retry with a visible error.
     */
    private suspend fun settle(user: UserSummary): SessionState {
        if (!user.onboardingCompleted) {
            val draft = draftStore.current()
            if (!draft.submitRequested) {
                return SessionState.NeedsOnboarding(user)
            }
            return when (onboardingRepository.complete(draft)) {
                is ApiResult.Success -> SessionState.Ready(user.copy(onboardingCompleted = true))
                is ApiResult.Failure -> SessionState.NeedsOnboarding(user)
            }
        }

        // Choices collected for a different account are not applied to an account
        // that already finished onboarding.
        if (draftStore.current().submitRequested) {
            draftStore.clear()
        }
        return SessionState.Ready(user)
    }

    private suspend fun failureState(error: ApiError): SessionState {
        if (error.httpStatus == 403) {
            tokenStore.clear()
            return SessionState.SignedOut
        }
        // The refresher clears the store when the refresh token is rejected.
        if (tokenStore.session.value == null) {
            return SessionState.SignedOut
        }
        // Offline or a transient failure: prefer opening the app with the cached flag.
        return if (sessionPreferences.onboardingCompleted() == false) {
            SessionState.NeedsOnboarding(null)
        } else {
            SessionState.Ready(null)
        }
    }

    /** Called by the post-auth onboarding wizard after a successful save. */
    fun onOnboardingCompleted() {
        val user = authRepository.currentUser.value ?: currentUser()
        _state.value = SessionState.Ready(user?.copy(onboardingCompleted = true))
    }

    /** Clears the local session immediately, then revokes it in the background. */
    fun signOut() {
        userRefreshJob?.cancel()
        _state.value = SessionState.SignedOut
        viewModelScope.launch {
            draftStore.clear()
            authRepository.logout()
        }
    }

    private fun currentUser(): UserSummary? = when (val current = _state.value) {
        is SessionState.Ready -> current.user
        is SessionState.NeedsOnboarding -> current.user
        SessionState.Restoring, SessionState.SignedOut -> null
    }
}

/** How long the branded splash stays on screen after a fast session restore. */
private const val MinimumSplashMillis = 900L
