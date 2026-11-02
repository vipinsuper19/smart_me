package com.smartme.app.data.auth

import com.smartme.app.core.network.AuthTokensDto
import com.smartme.app.core.network.AuthUserDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthMappersTest {

    @Test
    fun `tokens map ISO timestamps to epoch milliseconds`() {
        val tokens = tokensDto().toSessionTokens()

        assertEquals("access-token", tokens.accessToken)
        assertEquals("refresh-token", tokens.refreshToken)
        assertEquals(1_792_574_100_000L, tokens.accessTokenExpiresAt)
        assertEquals(1_795_166_100_000L, tokens.refreshTokenExpiresAt)
    }

    @Test
    fun `an unparseable expiry is treated as expired instead of crashing`() {
        val tokens = tokensDto(
            accessExpiry = "not-a-date",
            refreshExpiry = "also-not-a-date",
        ).toSessionTokens()

        assertEquals(0L, tokens.accessTokenExpiresAt)
        assertEquals(0L, tokens.refreshTokenExpiresAt)
        assertFalse(tokens.isAccessTokenValid(1L))
        assertFalse(tokens.isRefreshTokenValid(1L))
    }

    @Test
    fun `a completed onboarding timestamp marks the learner as onboarded`() {
        val user = userDto(onboardingCompletedAt = "2026-10-21T09:30:00.000Z").toUserSummary()

        assertTrue(user.onboardingCompleted)
        assertEquals("Asha", user.displayName)
        assertEquals("learner@example.com", user.email)
    }

    @Test
    fun `a missing onboarding timestamp means onboarding is still required`() {
        val user = userDto(onboardingCompletedAt = null).toUserSummary()

        assertFalse(user.onboardingCompleted)
    }

    @Test
    fun `a blank name falls back to the email local part`() {
        val user = userDto(name = "   ").toUserSummary()

        assertEquals("learner", user.displayName)
    }

    private fun tokensDto(
        accessExpiry: String = "2026-10-21T09:15:00.000Z",
        refreshExpiry: String = "2026-11-20T09:15:00.000Z",
    ) = AuthTokensDto(
        accessToken = "access-token",
        refreshToken = "refresh-token",
        accessTokenExpiresAt = accessExpiry,
        refreshTokenExpiresAt = refreshExpiry,
    )

    private fun userDto(
        name: String? = "Asha",
        onboardingCompletedAt: String? = null,
    ) = AuthUserDto(
        id = "user-1",
        email = "learner@example.com",
        name = name,
        onboardingCompletedAt = onboardingCompletedAt,
    )
}
