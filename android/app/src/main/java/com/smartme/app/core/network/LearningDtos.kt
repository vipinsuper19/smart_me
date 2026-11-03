package com.smartme.app.core.network

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

// Wire shapes for the learner content, quiz and gamification endpoints. These
// mirror docs/API-CONTENT.md, API-QUIZ.md and API-PROGRESS.md. Enum-like fields
// stay as strings so a new server value never crashes an older client.

@Serializable
data class PaginatedDto<T>(
    val items: List<T> = emptyList(),
    val page: Int = 1,
    val pageSize: Int = 20,
    val total: Int = 0,
)

@Serializable
data class ProgressSummaryDto(
    val totalLessons: Int = 0,
    val startedLessons: Int = 0,
    val completedLessons: Int = 0,
    val percent: Int = 0,
)

@Serializable
data class LessonProgressDto(
    val lessonId: String,
    val status: String,
    val progressPercent: Int = 0,
    val lastBlockOrder: Int? = null,
    val startedAt: String? = null,
    val lastAccessedAt: String? = null,
    val completedAt: String? = null,
    val timeSpentSeconds: Int = 0,
) {
    val isCompleted: Boolean get() = status == "COMPLETED"
}

@Serializable
data class PathRefDto(
    val id: String,
    val slug: String,
    val title: String,
)

@Serializable
data class CourseRefDto(
    val id: String,
    val slug: String,
    val title: String,
    val accessTier: String = "FREE",
    val locked: Boolean = false,
)

@Serializable
data class ModuleRefDto(
    val id: String,
    val slug: String,
    val title: String,
    val order: Int = 0,
)

@Serializable
data class MediaAssetDto(
    val id: String,
    val url: String,
    val type: String? = null,
    val mimeType: String? = null,
    val width: Int? = null,
    val height: Int? = null,
    val durationSeconds: Int? = null,
    val altText: String? = null,
)

@Serializable
data class LessonBlockDto(
    val id: String,
    val type: String,
    val order: Int = 0,
    val payload: JsonObject = JsonObject(emptyMap()),
    val caption: String? = null,
    val media: MediaAssetDto? = null,
)

@Serializable
data class LessonTranslationDto(
    val language: String,
    val title: String,
    val summary: String,
    val objective: String,
)

@Serializable
data class QuizSummaryDto(
    val id: String,
    val slug: String? = null,
    val title: String,
    val description: String? = null,
    val passingScore: Int = 60,
    val xpReward: Int = 0,
    val timeLimitSeconds: Int? = null,
    val questionCount: Int = 0,
    val required: Boolean = false,
    val attemptCount: Int = 0,
    val bestScore: Int? = null,
    val passed: Boolean = false,
    val activeAttemptId: String? = null,
)

@Serializable
data class LessonCardDto(
    val id: String,
    val slug: String,
    val title: String,
    val summary: String,
    val objective: String,
    val difficulty: String = "BEGINNER",
    val estimatedMinutes: Int = 5,
    val accessTier: String = "FREE",
    val effectiveAccessTier: String = "FREE",
    val locked: Boolean = false,
    val order: Int = 0,
    val requiresQuiz: Boolean = false,
    val module: ModuleRefDto,
    val course: CourseRefDto,
    val progress: LessonProgressDto? = null,
)

@Serializable
data class LearningPathDto(
    val id: String,
    val slug: String,
    val title: String,
    val description: String = "",
    val coverImageUrl: String? = null,
    val iconUrl: String? = null,
    val order: Int = 0,
    val availableLanguages: List<String> = emptyList(),
    val courseCount: Int = 0,
    val lessonCount: Int = 0,
    val hasPremiumContent: Boolean = false,
    val progress: ProgressSummaryDto = ProgressSummaryDto(),
    /** Present on the detail response only. */
    val courses: List<CourseCardDto> = emptyList(),
)

@Serializable
data class CourseCardDto(
    val id: String,
    val slug: String,
    val title: String,
    val shortDescription: String = "",
    val description: String? = null,
    val objectives: List<String> = emptyList(),
    val coverImageUrl: String? = null,
    val difficulty: String = "BEGINNER",
    val estimatedMinutes: Int = 0,
    val accessTier: String = "FREE",
    val locked: Boolean = false,
    val order: Int = 0,
    val availableLanguages: List<String> = emptyList(),
    val moduleCount: Int = 0,
    val lessonCount: Int = 0,
    val hasPremiumLessons: Boolean = false,
    val progress: ProgressSummaryDto = ProgressSummaryDto(),
    val learningPath: PathRefDto,
    /** Present on the course detail response only. */
    val modules: List<ModuleDto> = emptyList(),
    val prerequisites: List<CourseRefDto> = emptyList(),
)

@Serializable
data class ModuleDto(
    val id: String,
    val slug: String,
    val title: String,
    val description: String? = null,
    val order: Int = 0,
    val estimatedMinutes: Int? = null,
    val lessons: List<LessonCardDto> = emptyList(),
)

@Serializable
data class NextLessonDto(
    val id: String,
    val slug: String,
    val title: String,
    val summary: String,
    val estimatedMinutes: Int = 5,
    val accessTier: String = "FREE",
    val effectiveAccessTier: String = "FREE",
    val locked: Boolean = false,
    val module: ModuleRefDto,
)

@Serializable
data class LessonDetailDto(
    val id: String,
    val slug: String,
    val title: String,
    val summary: String,
    val objective: String,
    val difficulty: String = "BEGINNER",
    val estimatedMinutes: Int = 5,
    val accessTier: String = "FREE",
    val effectiveAccessTier: String = "FREE",
    val order: Int = 0,
    val version: Int = 1,
    val primaryLanguage: String = "ENGLISH",
    val requiresQuiz: Boolean = false,
    val publishedAt: String? = null,
    val availableLanguages: List<String> = emptyList(),
    val course: CourseRefDto,
    val module: ModuleRefDto,
    val blocks: List<LessonBlockDto> = emptyList(),
    val translations: List<LessonTranslationDto> = emptyList(),
    val quiz: QuizSummaryDto? = null,
    val progress: LessonProgressDto? = null,
    val nextLesson: NextLessonDto? = null,
)

@Serializable
data class CourseLessonsDto(
    val course: CourseCardDto,
    val items: List<LessonCardDto> = emptyList(),
    val page: Int = 1,
    val pageSize: Int = 20,
    val total: Int = 0,
)

@Serializable
data class RecommendedLessonDto(
    val lesson: LessonCardDto,
    val learningPath: PathRefDto,
    val reason: String = "FIRST_AVAILABLE",
)

@Serializable
data class ContinueLearningItemDto(
    val lesson: LessonCardDto,
    val learningPath: PathRefDto,
    val progress: LessonProgressDto,
)

@Serializable
data class ContinueLearningDto(val item: ContinueLearningItemDto? = null)

@Serializable
data class UpdateLessonProgressRequest(
    val progressPercent: Int? = null,
    val lastBlockOrder: Int? = null,
    val timeSpentSeconds: Int? = null,
)

@Serializable
data class LessonCompletionDto(
    val lessonId: String,
    val status: String,
    val progressPercent: Int = 100,
    val lastBlockOrder: Int? = null,
    val startedAt: String? = null,
    val lastAccessedAt: String? = null,
    val completedAt: String? = null,
    val timeSpentSeconds: Int = 0,
    val alreadyCompleted: Boolean = false,
    val rewards: RewardResultDto? = null,
)

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

@Serializable
data class QuizOptionDto(
    val id: String,
    val text: String,
    val order: Int = 0,
)

@Serializable
data class QuizQuestionDto(
    val id: String,
    val type: String = "SINGLE_CHOICE",
    val prompt: String,
    val scenario: String? = null,
    val order: Int = 0,
    val points: Int = 1,
    val options: List<QuizOptionDto> = emptyList(),
)

@Serializable
data class QuizSavedAnswerDto(
    val questionId: String,
    val selectedOptionId: String? = null,
    val answeredAt: String? = null,
)

@Serializable
data class QuizAttemptDto(
    val id: String,
    val quizId: String,
    val attemptNumber: Int = 1,
    val status: String = "IN_PROGRESS",
    val startedAt: String? = null,
    val submittedAt: String? = null,
    val score: Int? = null,
    val passingScore: Int = 60,
    val passed: Boolean = false,
    val correctCount: Int = 0,
    val totalQuestions: Int = 0,
    val answeredCount: Int = 0,
    val xpAwarded: Int = 0,
)

@Serializable
data class LatestAttemptDto(
    val id: String,
    val quizId: String,
    val attemptNumber: Int = 1,
    val status: String = "IN_PROGRESS",
    val startedAt: String? = null,
    val submittedAt: String? = null,
    val score: Int? = null,
    val passingScore: Int = 60,
    val passed: Boolean = false,
    val correctCount: Int = 0,
    val totalQuestions: Int = 0,
    val answeredCount: Int = 0,
    val xpAwarded: Int = 0,
    val quizTitle: String? = null,
    val answers: List<QuizSavedAnswerDto> = emptyList(),
) {
    val isInProgress: Boolean get() = status == "IN_PROGRESS"
}

@Serializable
data class LessonQuizDto(
    val id: String,
    val slug: String? = null,
    val title: String,
    val description: String? = null,
    val lessonId: String,
    val passingScore: Int = 60,
    val xpReward: Int = 0,
    val timeLimitSeconds: Int? = null,
    val questionCount: Int = 0,
    val totalPoints: Int = 0,
    val questions: List<QuizQuestionDto> = emptyList(),
    val latestAttempt: LatestAttemptDto? = null,
)

@Serializable
data class QuizAttemptStartDto(
    val quizId: String,
    val quizTitle: String = "",
    val passingScore: Int = 60,
    val xpReward: Int = 0,
    val timeLimitSeconds: Int? = null,
    val totalQuestions: Int = 0,
    val resumed: Boolean = false,
    val attempt: QuizAttemptDto,
    val answers: List<QuizSavedAnswerDto> = emptyList(),
)

@Serializable
data class AnswerQuizRequest(
    val questionId: String,
    val selectedOptionId: String,
)

@Serializable
data class QuizResultQuizDto(
    val id: String,
    val title: String,
    val passingScore: Int = 60,
    val xpReward: Int = 0,
)

@Serializable
data class QuizResultOptionDto(
    val id: String,
    val text: String,
    val order: Int = 0,
    val isCorrect: Boolean = false,
    val selected: Boolean = false,
    val feedback: String? = null,
)

@Serializable
data class QuizResultQuestionDto(
    val id: String,
    val type: String = "SINGLE_CHOICE",
    val prompt: String,
    val scenario: String? = null,
    val explanation: String = "",
    val order: Int = 0,
    val points: Int = 1,
    val selectedOptionId: String? = null,
    val isCorrect: Boolean = false,
    val earnedPoints: Int = 0,
    val options: List<QuizResultOptionDto> = emptyList(),
)

@Serializable
data class QuizResultDto(
    val quiz: QuizResultQuizDto,
    val attempt: QuizAttemptDto,
    val questions: List<QuizResultQuestionDto> = emptyList(),
)

@Serializable
data class QuizSubmissionDto(
    val quiz: QuizResultQuizDto,
    val attempt: QuizAttemptDto,
    val questions: List<QuizResultQuestionDto> = emptyList(),
    val firstAttempt: Boolean = false,
    val rewards: RewardResultDto? = null,
)

// ---------------------------------------------------------------------------
// Gamification and rewards
// ---------------------------------------------------------------------------

@Serializable
data class DailyGoalDto(
    val date: String,
    val targetMinutes: Int = 10,
    val minutesLearned: Int = 0,
    val percent: Int = 0,
    val met: Boolean = false,
)

@Serializable
data class LevelProgressDto(
    val level: Int = 1,
    val totalXp: Int = 0,
    val xpIntoLevel: Int = 0,
    val xpForNextLevel: Int = 100,
    val xpToNextLevel: Int = 100,
    val nextLevelAt: Int = 100,
    val progressPercent: Int = 0,
)

@Serializable
data class GamificationSummaryDto(
    val timeZone: String = "Asia/Kolkata",
    val totalXp: Int = 0,
    val level: Int = 1,
    val levelProgress: LevelProgressDto = LevelProgressDto(),
    val currentStreak: Int = 0,
    val longestStreak: Int = 0,
    val lastLearningDate: String? = null,
    val lessonsCompleted: Int = 0,
    val quizzesCompleted: Int = 0,
    val minutesLearned: Int = 0,
    val dailyGoal: DailyGoalDto? = null,
)

@Serializable
data class RewardBreakdownDto(
    val lessonXp: Int = 0,
    val quizXp: Int = 0,
    val dailyGoalXp: Int = 0,
    val achievementXp: Int = 0,
)

@Serializable
data class AchievementUnlockedDto(
    val code: String,
    val title: String,
    val description: String? = null,
    val iconUrl: String? = null,
    val xpReward: Int = 0,
    val earnedAt: String? = null,
)

@Serializable
data class RewardResultDto(
    val xpEarned: Int = 0,
    val totalXp: Int = 0,
    val level: Int = 1,
    val levelProgress: LevelProgressDto? = null,
    val xpBreakdown: RewardBreakdownDto? = null,
    val leveledUp: Boolean = false,
    val currentStreak: Int = 0,
    val longestStreak: Int = 0,
    val dailyGoal: DailyGoalDto? = null,
    val achievementsUnlocked: List<AchievementUnlockedDto> = emptyList(),
    val alreadyAwarded: Boolean = false,
)
