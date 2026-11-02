package com.smartme.app.core.network

import com.smartme.app.core.security.TokenStore
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

/**
 * Attaches the bearer access token and transparently recovers an expired one.
 *
 * Two cases are covered:
 *  - the stored access token is still usable but the API rejects it (`401`);
 *  - the stored access token already expired while the refresh token is valid,
 *    in which case there is nothing to attach and a refresh happens up front.
 *
 * Refresh lives here rather than in OkHttp's `Authenticator` because application
 * interceptors do not run again for authenticator retries, so the new header
 * would never be attached. A request is retried at most once and the original
 * response is returned if recovery fails.
 */
class AuthInterceptor @Inject constructor(
    private val tokenStore: TokenStore,
    private val refresher: SessionRefresher,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (request.header(HEADER) != null) {
            // Callers that set their own header (for example a future public API)
            // are left alone.
            return chain.proceed(request)
        }

        var accessToken = tokenStore.accessTokenOrNull()
        if (accessToken == null && tokenStore.isSignedIn()) {
            // The session exists but its access token is expired (or inside the
            // expiry skew). Get a fresh one before the server can reject us.
            accessToken = refresher.refreshBlocking(EXPIRED_TOKEN)
        }

        val firstAttempt = if (accessToken != null) request.withAccessToken(accessToken) else request
        val response = chain.proceed(firstAttempt)
        if (response.code != UNAUTHORIZED || accessToken == null) {
            return response
        }

        val refreshedToken = refresher.refreshBlocking(accessToken) ?: return response
        response.close()
        return chain.proceed(request.withAccessToken(refreshedToken))
    }

    private fun okhttp3.Request.withAccessToken(accessToken: String): okhttp3.Request =
        newBuilder().header(HEADER, bearer(accessToken)).build()

    companion object {
        const val HEADER = "Authorization"
        private const val UNAUTHORIZED = 401

        /** Sentinel passed to [SessionRefresher] when no usable token was attached. */
        private const val EXPIRED_TOKEN = ""

        fun bearer(accessToken: String): String = "Bearer $accessToken"

        fun authorizationHeader(accessToken: String?): String? =
            accessToken?.takeIf { it.isNotBlank() }?.let(::bearer)
    }
}
