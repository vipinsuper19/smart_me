package com.smartme.app.core.network

import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

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

    // Content catalogue.
    @GET("learning-paths")
    suspend fun learningPaths(
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 50,
    ): PaginatedDto<LearningPathDto>

    @GET("learning-paths/{id}")
    suspend fun learningPath(@Path("id") id: String): LearningPathDto

    @GET("courses")
    suspend fun courses(
        @Query("learningPathId") learningPathId: String? = null,
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 50,
    ): PaginatedDto<CourseCardDto>

    @GET("courses/{id}")
    suspend fun course(@Path("id") id: String): CourseCardDto

    @GET("courses/{id}/lessons")
    suspend fun courseLessons(
        @Path("id") id: String,
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 100,
    ): CourseLessonsDto

    @GET("lessons/continue")
    suspend fun continueLearning(): ContinueLearningDto

    @GET("lessons/recommended")
    suspend fun recommendedLesson(): RecommendedLessonDto

    @GET("lessons/{id}")
    suspend fun lesson(@Path("id") id: String): LessonDetailDto

    // Lesson progress.
    @POST("lessons/{id}/start")
    suspend fun startLesson(@Path("id") id: String): LessonProgressDto

    @POST("lessons/{id}/progress")
    suspend fun updateLessonProgress(
        @Path("id") id: String,
        @Body body: UpdateLessonProgressRequest,
    ): LessonProgressDto

    @POST("lessons/{id}/complete")
    suspend fun completeLesson(@Path("id") id: String): LessonCompletionDto

    // Quizzes.
    @GET("lessons/{id}/quiz")
    suspend fun lessonQuiz(@Path("id") id: String): LessonQuizDto

    @POST("quizzes/{id}/attempts")
    suspend fun startQuizAttempt(@Path("id") id: String): QuizAttemptStartDto

    @POST("quiz-attempts/{id}/answers")
    suspend fun saveQuizAnswer(
        @Path("id") attemptId: String,
        @Body body: AnswerQuizRequest,
    ): QuizAttemptDto

    @POST("quiz-attempts/{id}/submit")
    suspend fun submitQuizAttempt(@Path("id") attemptId: String): QuizSubmissionDto

    @GET("quiz-attempts/{id}/results")
    suspend fun quizResults(@Path("id") attemptId: String): QuizResultDto

    // Gamification.
    @GET("gamification/summary")
    suspend fun gamificationSummary(): GamificationSummaryDto
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
