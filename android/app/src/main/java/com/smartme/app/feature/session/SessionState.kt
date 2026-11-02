package com.smartme.app.feature.session

import com.smartme.app.core.model.UserSummary

/**
 * The four states the app can be in before the main tab shell is shown.
 *
 * [user] is nullable because a cold start can restore a valid session, skip the
 * blocking `/auth/me` call using the cached onboarding flag, and fill the user
 * in from the network afterwards.
 */
sealed interface SessionState {
    /** Reading the encrypted session from disk. */
    data object Restoring : SessionState

    /** No usable session: show the welcome / auth flow. */
    data object SignedOut : SessionState

    /** Signed in, but the learner has not finished onboarding. */
    data class NeedsOnboarding(val user: UserSummary?) : SessionState

    /** Signed in and onboarded: show the main application. */
    data class Ready(val user: UserSummary?) : SessionState
}
