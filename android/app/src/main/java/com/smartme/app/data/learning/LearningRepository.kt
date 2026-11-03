package com.smartme.app.data.learning

import com.smartme.app.core.network.AnswerQuizRequest
import com.smartme.app.core.network.ApiExecutor
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.ContinueLearningItemDto
import com.smartme.app.core.network.CourseCardDto
import com.smartme.app.core.network.GamificationSummaryDto
import com.smartme.app.core.network.LearningPathDto
import com.smartme.app.core.network.LessonCardDto
import com.smartme.app.core.network.LessonCompletionDto
import com.smartme.app.core.network.LessonDetailDto
import com.smartme.app.core.network.LessonProgressDto
import com.smartme.app.core.network.LessonQuizDto
import com.smartme.app.core.network.QuizAttemptDto
import com.smartme.app.core.network.QuizAttemptStartDto
import com.smartme.app.core.network.QuizResultDto
import com.smartme.app.core.network.QuizSubmissionDto
import com.smartme.app.core.network.RecommendedLessonDto
import com.smartme.app.core.network.SmartMeApi
import com.smartme.app.core.network.UpdateLessonProgressRequest
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Single entry point for the learning catalogue, lesson progress, quizzes and
 * the gamification summary.
 *
 * Every method returns [ApiResult] so ViewModels render the shared error copy
 * instead of handling HTTP or serialization failures themselves.
 */
@Singleton
class LearningRepository @Inject constructor(
    private val api: SmartMeApi,
    private val apiExecutor: ApiExecutor,
) {

    suspend fun learningPaths(): ApiResult<List<LearningPathDto>> = apiExecutor.call {
        api.learningPaths().items
    }

    suspend fun learningPath(pathId: String): ApiResult<LearningPathDto> = apiExecutor.call {
        api.learningPath(pathId)
    }

    suspend fun courses(learningPathId: String? = null): ApiResult<List<CourseCardDto>> =
        apiExecutor.call {
            api.courses(learningPathId = learningPathId).items
        }

    suspend fun course(courseId: String): ApiResult<CourseCardDto> = apiExecutor.call {
        api.course(courseId)
    }

    suspend fun courseLessons(courseId: String): ApiResult<List<LessonCardDto>> = apiExecutor.call {
        api.courseLessons(courseId).items
    }

    suspend fun continueLearning(): ApiResult<ContinueLearningItemDto?> = apiExecutor.call {
        api.continueLearning().item
    }

    suspend fun recommendedLesson(): ApiResult<RecommendedLessonDto> = apiExecutor.call {
        api.recommendedLesson()
    }

    suspend fun lesson(lessonId: String): ApiResult<LessonDetailDto> = apiExecutor.call {
        api.lesson(lessonId)
    }

    suspend fun startLesson(lessonId: String): ApiResult<LessonProgressDto> = apiExecutor.call {
        api.startLesson(lessonId)
    }

    suspend fun updateLessonProgress(
        lessonId: String,
        progressPercent: Int? = null,
        lastBlockOrder: Int? = null,
        timeSpentSeconds: Int? = null,
    ): ApiResult<LessonProgressDto> = apiExecutor.call {
        api.updateLessonProgress(
            lessonId,
            UpdateLessonProgressRequest(
                progressPercent = progressPercent,
                lastBlockOrder = lastBlockOrder,
                timeSpentSeconds = timeSpentSeconds,
            ),
        )
    }

    suspend fun completeLesson(lessonId: String): ApiResult<LessonCompletionDto> = apiExecutor.call {
        api.completeLesson(lessonId)
    }

    suspend fun gamificationSummary(): ApiResult<GamificationSummaryDto> = apiExecutor.call {
        api.gamificationSummary()
    }

    suspend fun lessonQuiz(lessonId: String): ApiResult<LessonQuizDto> = apiExecutor.call {
        api.lessonQuiz(lessonId)
    }

    suspend fun startQuizAttempt(quizId: String): ApiResult<QuizAttemptStartDto> = apiExecutor.call {
        api.startQuizAttempt(quizId)
    }

    suspend fun saveQuizAnswer(
        attemptId: String,
        questionId: String,
        selectedOptionId: String,
    ): ApiResult<QuizAttemptDto> = apiExecutor.call {
        api.saveQuizAnswer(attemptId, AnswerQuizRequest(questionId, selectedOptionId))
    }

    suspend fun submitQuizAttempt(attemptId: String): ApiResult<QuizSubmissionDto> =
        apiExecutor.call {
            api.submitQuizAttempt(attemptId)
        }

    suspend fun quizResults(attemptId: String): ApiResult<QuizResultDto> = apiExecutor.call {
        api.quizResults(attemptId)
    }
}
