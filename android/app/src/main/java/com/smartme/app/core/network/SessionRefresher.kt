package com.smartme.app.core.network

/**
 * Recovers the session after a `401`.
 *
 * Implementations must be single-flight: several requests can fail with the same
 * stale access token at once, and only one refresh may reach the API because the
 * backend rotates refresh tokens and treats replays as theft after a short grace
 * window.
 */
interface SessionRefresher {

    /**
     * Refreshes the session that [failedAccessToken] belonged to and returns the
     * new access token. Returns `null` when the session cannot be recovered, in
     * which case the caller should surface the original response.
     *
     * Blocking because it runs on an OkHttp worker thread from the auth
     * interceptor.
     */
    fun refreshBlocking(failedAccessToken: String): String?
}
