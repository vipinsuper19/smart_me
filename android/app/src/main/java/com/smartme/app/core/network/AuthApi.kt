package com.smartme.app.core.network

import retrofit2.http.Body
import retrofit2.http.POST

/**
 * Anonymous auth endpoints.
 *
 * These deliberately use a Retrofit instance without [AuthInterceptor]: a `401`
 * from login or refresh must never trigger another refresh, and sending a stale
 * bearer token to the refresh endpoint makes no difference to the backend.
 */
interface AuthApi {

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): AuthResponseDto

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): AuthResponseDto

    @POST("auth/google")
    suspend fun google(@Body body: GoogleLoginRequest): AuthResponseDto

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): AuthResponseDto

    @POST("auth/logout")
    suspend fun logout(@Body body: RefreshRequest)
}
