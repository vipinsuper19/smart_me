package com.smartme.app.core.security

import kotlinx.serialization.Serializable

/**
 * Tokens returned by `POST /auth/login`, `/auth/register`, `/auth/google` and
 * `/auth/refresh`. Expiries are stored as epoch milliseconds.
 */
data class SessionTokens(
    val accessToken: String,
    val refreshToken: String,
    val accessTokenExpiresAt: Long,
    val refreshTokenExpiresAt: Long,
) {
    fun isAccessTokenValid(nowMillis: Long, skewMillis: Long = DEFAULT_SKEW_MILLIS): Boolean =
        accessToken.isNotBlank() && accessTokenExpiresAt - skewMillis > nowMillis

    fun isRefreshTokenValid(nowMillis: Long): Boolean =
        refreshToken.isNotBlank() && refreshTokenExpiresAt > nowMillis

    companion object {
        /** Treats tokens as expired slightly early so a request cannot expire in flight. */
        const val DEFAULT_SKEW_MILLIS = 30_000L
    }
}

/** Stable on-disk shape for the encrypted session blob. */
@Serializable
internal data class TokenPayload(
    val accessToken: String,
    val refreshToken: String,
    val accessTokenExpiresAt: Long,
    val refreshTokenExpiresAt: Long,
) {
    fun toSessionTokens(): SessionTokens = SessionTokens(
        accessToken = accessToken,
        refreshToken = refreshToken,
        accessTokenExpiresAt = accessTokenExpiresAt,
        refreshTokenExpiresAt = refreshTokenExpiresAt,
    )

    companion object {
        fun from(tokens: SessionTokens): TokenPayload = TokenPayload(
            accessToken = tokens.accessToken,
            refreshToken = tokens.refreshToken,
            accessTokenExpiresAt = tokens.accessTokenExpiresAt,
            refreshTokenExpiresAt = tokens.refreshTokenExpiresAt,
        )
    }
}
