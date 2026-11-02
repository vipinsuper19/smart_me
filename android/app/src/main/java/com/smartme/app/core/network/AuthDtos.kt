package com.smartme.app.core.network

import kotlinx.serialization.Serializable

// Wire shapes for `/auth/*`. Dates are ISO-8601 strings and are converted to
// epoch milliseconds by the data layer, not here.

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String? = null,
    val acceptTerms: Boolean,
    val acceptPrivacy: Boolean,
)

@Serializable
data class GoogleLoginRequest(
    val idToken: String,
    val acceptTerms: Boolean? = null,
    val acceptPrivacy: Boolean? = null,
)

@Serializable
data class RefreshRequest(val refreshToken: String)

@Serializable
data class AuthResponseDto(
    val user: AuthUserDto,
    val tokens: AuthTokensDto,
)

@Serializable
data class AuthUserDto(
    val id: String,
    val email: String,
    val name: String? = null,
    val avatarUrl: String? = null,
    val emailVerifiedAt: String? = null,
    val status: String? = null,
    val timeZone: String? = null,
    val locale: String? = null,
    val onboardingCompletedAt: String? = null,
    val createdAt: String? = null,
    val hasPassword: Boolean = true,
    val authProviders: List<String> = emptyList(),
)

@Serializable
data class AuthTokensDto(
    val accessToken: String,
    val refreshToken: String,
    val accessTokenExpiresAt: String,
    val refreshTokenExpiresAt: String,
    val tokenType: String? = null,
)
