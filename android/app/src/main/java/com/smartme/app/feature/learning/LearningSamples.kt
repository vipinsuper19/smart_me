package com.smartme.app.feature.learning

import com.smartme.app.core.network.AchievementUnlockedDto
import com.smartme.app.core.network.ContinueLearningItemDto
import com.smartme.app.core.network.CourseCardDto
import com.smartme.app.core.network.CourseRefDto
import com.smartme.app.core.network.DailyGoalDto
import com.smartme.app.core.network.GamificationSummaryDto
import com.smartme.app.core.network.LatestAttemptDto
import com.smartme.app.core.network.LearningPathDto
import com.smartme.app.core.network.LessonBlockDto
import com.smartme.app.core.network.LessonCardDto
import com.smartme.app.core.network.LessonProgressDto
import com.smartme.app.core.network.LessonQuizDto
import com.smartme.app.core.network.LevelProgressDto
import com.smartme.app.core.network.ModuleDto
import com.smartme.app.core.network.ModuleRefDto
import com.smartme.app.core.network.PathRefDto
import com.smartme.app.core.network.ProgressSummaryDto
import com.smartme.app.core.network.QuizAttemptDto
import com.smartme.app.core.network.QuizOptionDto
import com.smartme.app.core.network.QuizQuestionDto
import com.smartme.app.core.network.QuizResultOptionDto
import com.smartme.app.core.network.QuizResultQuestionDto
import com.smartme.app.core.network.QuizResultQuizDto
import com.smartme.app.core.network.QuizSubmissionDto
import com.smartme.app.core.network.RecommendedLessonDto
import com.smartme.app.core.network.RewardBreakdownDto
import com.smartme.app.core.network.RewardResultDto
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Deterministic sample data for Compose previews. Previews never touch the
 * network, so every catalogue and player state is rendered from these fixtures.
 */
internal object LearningSamples {

    private val pathRef = PathRefDto(
        id = "path-english",
        slug = "english-communication",
        title = "English Communication",
    )

    private val courseRef = CourseRefDto(
        id = "course-foundations",
        slug = "everyday-english-foundations",
        title = "Everyday English Foundations",
    )

    private val moduleRef = ModuleRefDto(
        id = "module-starting-out",
        slug = "starting-out",
        title = "Starting Out",
        order = 0,
    )

    val inProgress = LessonProgressDto(
        lessonId = "lesson-intro",
        status = "IN_PROGRESS",
        progressPercent = 40,
        lastBlockOrder = 1,
        startedAt = "2026-10-21T10:10:00.000Z",
        lastAccessedAt = "2026-10-21T10:12:00.000Z",
        timeSpentSeconds = 120,
    )

    val completed = LessonProgressDto(
        lessonId = "lesson-intro",
        status = "COMPLETED",
        progressPercent = 100,
        lastBlockOrder = 4,
        startedAt = "2026-10-20T09:00:00.000Z",
        lastAccessedAt = "2026-10-20T09:08:00.000Z",
        completedAt = "2026-10-20T09:08:00.000Z",
        timeSpentSeconds = 480,
    )

    private val introLesson = LessonCardDto(
        id = "lesson-intro",
        slug = "tell-me-about-yourself",
        title = "Tell Me About Yourself",
        summary = "Introduce yourself in a few sentences with a clear structure.",
        objective = "Use a simple present-past-future introduction pattern.",
        difficulty = "BEGINNER",
        estimatedMinutes = 5,
        requiresQuiz = true,
        module = moduleRef,
        course = courseRef,
        progress = inProgress,
    )

    private val nextLesson = LessonCardDto(
        id = "lesson-impressions",
        slug = "first-impressions",
        title = "First Impressions",
        summary = "Make a strong first impression in a short conversation.",
        objective = "Open a conversation with a relevant, friendly question.",
        difficulty = "BEGINNER",
        estimatedMinutes = 6,
        module = moduleRef,
        course = courseRef,
    )

    private val secondModule = ModuleDto(
        id = "module-workplace",
        slug = "workplace-basics",
        title = "Workplace Basics",
        description = "Everyday exchanges with colleagues and managers.",
        order = 1,
        estimatedMinutes = 20,
        lessons = listOf(nextLesson),
    )

    private val firstModule = ModuleDto(
        id = moduleRef.id,
        slug = moduleRef.slug,
        title = moduleRef.title,
        description = "First conversations and introductions.",
        order = 0,
        estimatedMinutes = 15,
        lessons = listOf(introLesson),
    )

    val course = CourseCardDto(
        id = courseRef.id,
        slug = courseRef.slug,
        title = courseRef.title,
        shortDescription = "Start speaking with confidence.",
        description = "A practical course for everyday introductions and small talk.",
        objectives = listOf(
            "Introduce yourself clearly",
            "Ask simple follow-up questions",
        ),
        difficulty = "BEGINNER",
        estimatedMinutes = 45,
        moduleCount = 2,
        lessonCount = 2,
        hasPremiumLessons = true,
        progress = ProgressSummaryDto(
            totalLessons = 2,
            startedLessons = 1,
            completedLessons = 0,
            percent = 40,
        ),
        learningPath = pathRef,
        modules = listOf(firstModule, secondModule),
        prerequisites = emptyList(),
    )

    val path = LearningPathDto(
        id = pathRef.id,
        slug = pathRef.slug,
        title = pathRef.title,
        description = "Everyday and workplace English for confident conversations.",
        order = 0,
        availableLanguages = listOf("ENGLISH", "HINGLISH"),
        courseCount = 1,
        lessonCount = 2,
        hasPremiumContent = true,
        progress = ProgressSummaryDto(
            totalLessons = 2,
            startedLessons = 1,
            completedLessons = 0,
            percent = 40,
        ),
        courses = listOf(course),
    )

    val paths: List<LearningPathDto> = listOf(
        path,
        LearningPathDto(
            id = "path-finance",
            slug = "financial-literacy",
            title = "Financial Literacy",
            description = "Budgeting, saving and understanding money.",
            order = 1,
            courseCount = 2,
            lessonCount = 6,
            progress = ProgressSummaryDto(totalLessons = 6),
        ),
        LearningPathDto(
            id = "path-interview",
            slug = "interview-skills",
            title = "Interview Skills",
            description = "Answer questions with structure and confidence.",
            order = 2,
            courseCount = 1,
            lessonCount = 4,
            hasPremiumContent = true,
            progress = ProgressSummaryDto(
                totalLessons = 4,
                startedLessons = 1,
                completedLessons = 1,
                percent = 25,
            ),
        ),
    )

    val summary = GamificationSummaryDto(
        totalXp = 240,
        level = 3,
        levelProgress = LevelProgressDto(
            level = 3,
            totalXp = 240,
            xpIntoLevel = 40,
            xpForNextLevel = 150,
            xpToNextLevel = 110,
            nextLevelAt = 350,
            progressPercent = 27,
        ),
        currentStreak = 4,
        longestStreak = 9,
        lessonsCompleted = 12,
        quizzesCompleted = 5,
        minutesLearned = 86,
        dailyGoal = DailyGoalDto(
            date = "2026-11-03",
            targetMinutes = 10,
            minutesLearned = 6,
            percent = 60,
        ),
    )

    val continueItem = ContinueLearningItemDto(
        lesson = introLesson,
        learningPath = pathRef,
        progress = inProgress,
    )

    val recommendation = RecommendedLessonDto(
        lesson = nextLesson,
        learningPath = pathRef,
        reason = "PREFERENCE_MATCH",
    )

    val lessonBlocks: List<LessonBlockDto> = listOf(
        block(
            id = "block-heading",
            type = "HEADING",
            order = 0,
            payload = buildJsonObject { put("text", "Tell me about yourself") },
        ),
        block(
            id = "block-intro",
            type = "PARAGRAPH",
            order = 1,
            payload = buildJsonObject {
                put(
                    "text",
                    "A good introduction is short and structured. Start with who " +
                        "you are today, then add one relevant detail from your experience.",
                )
            },
        ),
        block(
            id = "block-points",
            type = "BULLET_LIST",
            order = 2,
            payload = buildJsonObject {
                put(
                    "items",
                    kotlinx.serialization.json.JsonArray(
                        listOf(
                            kotlinx.serialization.json.JsonPrimitive("Present: your role or study"),
                            kotlinx.serialization.json.JsonPrimitive("Past: one proof point"),
                            kotlinx.serialization.json.JsonPrimitive("Future: why you are here"),
                        ),
                    ),
                )
            },
        ),
        block(
            id = "block-callout",
            type = "CALLOUT",
            order = 3,
            payload = buildJsonObject {
                put("title", "Keep it brief")
                put("text", "Aim for 30–45 seconds, then invite a follow-up question.")
            },
        ),
        block(
            id = "block-conversation",
            type = "EXAMPLE_CONVERSATION",
            order = 4,
            payload = buildJsonObject {
                put(
                    "lines",
                    kotlinx.serialization.json.JsonArray(
                        listOf(
                            conversationLine("Interviewer", "Tell me about yourself."),
                            conversationLine(
                                "Candidate",
                                "I am a final-year student learning data analysis. Last " +
                                    "year I built a dashboard for a local shop, and I am " +
                                    "here to start my first analyst role.",
                            ),
                        ),
                    ),
                )
            },
        ),
        block(
            id = "block-recap",
            type = "RECAP",
            order = 5,
            payload = buildJsonObject {
                put(
                    "items",
                    kotlinx.serialization.json.JsonArray(
                        listOf(
                            kotlinx.serialization.json.JsonPrimitive("Present, past, future"),
                            kotlinx.serialization.json.JsonPrimitive("One proof point is enough"),
                        ),
                    ),
                )
            },
        ),
    )

    val lesson = com.smartme.app.core.network.LessonDetailDto(
        id = introLesson.id,
        slug = introLesson.slug,
        title = introLesson.title,
        summary = introLesson.summary,
        objective = introLesson.objective,
        difficulty = "BEGINNER",
        estimatedMinutes = 5,
        module = moduleRef,
        course = courseRef,
        blocks = lessonBlocks,
        quiz = quizSummary(),
        progress = inProgress,
        nextLesson = com.smartme.app.core.network.NextLessonDto(
            id = nextLesson.id,
            slug = nextLesson.slug,
            title = nextLesson.title,
            summary = nextLesson.summary,
            estimatedMinutes = nextLesson.estimatedMinutes,
            module = moduleRef,
        ),
    )

    private fun quizSummary() = com.smartme.app.core.network.QuizSummaryDto(
        id = "quiz-intro",
        title = "Check your introduction",
        description = "Two quick questions on structure.",
        passingScore = 60,
        xpReward = 5,
        questionCount = 2,
        required = true,
        attemptCount = 1,
        activeAttemptId = "attempt-1",
    )

    private val options = listOf(
        QuizOptionDto(id = "option-present", text = "Start with the present", order = 0),
        QuizOptionDto(id = "option-childhood", text = "Start with childhood", order = 1),
        QuizOptionDto(id = "option-job", text = "List every job you have had", order = 2),
    )

    val quiz = LessonQuizDto(
        id = "quiz-intro",
        title = "Check your introduction",
        description = "Two quick questions on structure.",
        lessonId = introLesson.id,
        passingScore = 60,
        xpReward = 5,
        questionCount = 2,
        totalPoints = 2,
        questions = listOf(
            QuizQuestionDto(
                id = "question-1",
                type = "SCENARIO",
                prompt = "How should you open your answer?",
                scenario = "An interviewer says: tell me about yourself.",
                order = 0,
                options = options,
            ),
            QuizQuestionDto(
                id = "question-2",
                prompt = "How long should the answer take?",
                order = 1,
                options = listOf(
                    QuizOptionDto(id = "option-short", text = "30–45 seconds", order = 0),
                    QuizOptionDto(id = "option-long", text = "5 minutes", order = 1),
                ),
            ),
        ),
        latestAttempt = LatestAttemptDto(
            id = "attempt-1",
            quizId = "quiz-intro",
            status = "IN_PROGRESS",
            passingScore = 60,
            totalQuestions = 2,
            answeredCount = 1,
        ),
    )

    val attempt = QuizAttemptDto(
        id = "attempt-1",
        quizId = "quiz-intro",
        attemptNumber = 1,
        status = "IN_PROGRESS",
        startedAt = "2026-11-03T09:00:00.000Z",
        passingScore = 60,
        totalQuestions = 2,
        answeredCount = 1,
    )

    val quizSubmission = QuizSubmissionDto(
        quiz = QuizResultQuizDto(
            id = "quiz-intro",
            title = "Check your introduction",
            passingScore = 60,
            xpReward = 5,
        ),
        attempt = QuizAttemptDto(
            id = "attempt-1",
            quizId = "quiz-intro",
            attemptNumber = 1,
            status = "SUBMITTED",
            passingScore = 60,
            passed = true,
            score = 100,
            correctCount = 2,
            totalQuestions = 2,
            answeredCount = 2,
            xpAwarded = 5,
        ),
        questions = listOf(
            QuizResultQuestionDto(
                id = "question-1",
                prompt = "How should you open your answer?",
                scenario = "An interviewer says: tell me about yourself.",
                explanation = "Start with the present, then add a proof point.",
                order = 0,
                selectedOptionId = "option-present",
                isCorrect = true,
                earnedPoints = 1,
                options = listOf(
                    QuizResultOptionDto(
                        id = "option-present",
                        text = "Start with the present",
                        order = 0,
                        isCorrect = true,
                        selected = true,
                        feedback = "Correct. Keep it relevant.",
                    ),
                    QuizResultOptionDto(
                        id = "option-childhood",
                        text = "Start with childhood",
                        order = 1,
                        feedback = "Too much backstory.",
                    ),
                ),
            ),
        ),
        firstAttempt = true,
        rewards = RewardResultDto(
            xpEarned = 5,
            totalXp = 245,
            level = 3,
            xpBreakdown = RewardBreakdownDto(quizXp = 5),
            currentStreak = 4,
            longestStreak = 9,
            achievementsUnlocked = listOf(
                AchievementUnlockedDto(
                    code = "FIRST_QUIZ",
                    title = "First quiz",
                    description = "Passed your first quiz.",
                    xpReward = 5,
                ),
            ),
        ),
    )

    private fun block(
        id: String,
        type: String,
        order: Int,
        payload: JsonObject,
    ) = LessonBlockDto(id = id, type = type, order = order, payload = payload)

    private fun conversationLine(speaker: String, text: String): JsonObject =
        buildJsonObject {
            put("speaker", speaker)
            put("text", text)
        }
}
