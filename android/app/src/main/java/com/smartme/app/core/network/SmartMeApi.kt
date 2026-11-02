package com.smartme.app.core.network

import kotlinx.serialization.Serializable
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Body

/**
 * The authenticated SmartMe REST API (`/api/v1`). Endpoints are added as the
 * matching feature is built.
 */
interface SmartMeApi {

    @GET("health")
    suspend fun health(): HealthDto

    @GET("auth/me")
    suspend fun me(): AuthUserDto

    @POST("onboarding/complete")
    suspend fun completeOnboarding(@Body body: OnboardingCompleteRequest): OnboardingCompletionDto
}

@Serializable
data class HealthDto(
    val status: String,
    val service: String? = null,
    val version: String? = null,
    val timestamp: String? = null,
    val uptimeSeconds: Long? = null,
)

@Serializable
data class OnboardingCompleteRequest(
    val learningGoal: String? = null,
    val proficiency: String? = null,
    val explanationLanguage: String? = null,
    val dailyGoalMinutes: Int? = null,
    val interests: List<String>? = null,
)

@Serializable
data class OnboardingCompletionDto(
    val completedAt: String? = null,
)
