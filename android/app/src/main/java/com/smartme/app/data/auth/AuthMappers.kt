package com.smartme.app.data.auth

import com.smartme.app.core.model.UserSummary
import com.smartme.app.core.network.AuthTokensDto
import com.smartme.app.core.network.AuthUserDto
import com.smartme.app.core.security.SessionTokens
import java.time.Instant

internal fun AuthTokensDto.toSessionTokens(): SessionTokens = SessionTokens(
    accessToken = accessToken,
    refreshToken = refreshToken,
    accessTokenExpiresAt = accessTokenExpiresAt.toEpochMillis(),
    refreshTokenExpiresAt = refreshTokenExpiresAt.toEpochMillis(),
)

internal fun AuthUserDto.toUserSummary(): UserSummary = UserSummary(
    id = id,
    email = email,
    name = name,
    avatarUrl = avatarUrl,
    onboardingCompleted = onboardingCompletedAt != null,
)

/**
 * The API sends ISO-8601 timestamps. An unparseable value is treated as already
 * expired rather than crashing the app: an expired access token triggers a
 * refresh, and an expired refresh token sends the learner back to sign-in.
 */
private fun String.toEpochMillis(): Long =
    runCatching { Instant.parse(this).toEpochMilli() }.getOrDefault(0L)
