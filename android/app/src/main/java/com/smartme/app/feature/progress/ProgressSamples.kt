package com.smartme.app.feature.progress

import com.smartme.app.core.network.AchievementDto
import com.smartme.app.core.network.AchievementProgressDto
import com.smartme.app.core.network.AchievementsDto
import com.smartme.app.core.network.DailyGoalDto
import com.smartme.app.core.network.LevelProgressDto
import com.smartme.app.core.network.ProgressOverviewDto
import com.smartme.app.core.network.TopicProgressDto
import com.smartme.app.core.network.WeeklyDayDto
import com.smartme.app.core.network.WeeklyProgressDto
import com.smartme.app.core.network.WeeklyTotalsDto

/** Deterministic fixtures shared by previews and pure formatting tests. */
object ProgressSamples {

    val dailyGoal = DailyGoalDto(
        date = "2026-11-04",
        targetMinutes = 10,
        minutesLearned = 7,
        percent = 70,
        met = false,
    )

    val overview = ProgressOverviewDto(
        lessonsStarted = 14,
        lessonsCompleted = 9,
        quizAttempts = 4,
        quizzesCompleted = 3,
        minutesLearned = 95,
        totalXp = 340,
        level = 3,
        levelProgress = LevelProgressDto(
            level = 3,
            totalXp = 340,
            xpIntoLevel = 90,
            xpForNextLevel = 250,
            xpToNextLevel = 160,
            nextLevelAt = 500,
            progressPercent = 36,
        ),
        currentStreak = 5,
        longestStreak = 11,
        dailyGoal = dailyGoal,
        topics = listOf(
            TopicProgressDto(
                id = "path-1",
                slug = "english-communication",
                title = "English Communication",
                totalLessons = 12,
                startedLessons = 8,
                completedLessons = 6,
                percent = 50,
            ),
            TopicProgressDto(
                id = "path-2",
                slug = "interview-preparation",
                title = "Interview Preparation",
                totalLessons = 8,
                startedLessons = 4,
                completedLessons = 3,
                percent = 38,
            ),
        ),
    )

    val weekly = WeeklyProgressDto(
        timeZone = "Asia/Kolkata",
        from = "2026-10-29",
        to = "2026-11-04",
        days = listOf(
            WeeklyDayDto("2026-10-29", 1, 0, 10, 15, 10, true),
            WeeklyDayDto("2026-10-30", 2, 1, 22, 35, 10, true),
            WeeklyDayDto("2026-10-31", 0, 0, 0, 0, 10, false),
            WeeklyDayDto("2026-11-01", 1, 0, 12, 15, 10, true),
            WeeklyDayDto("2026-11-02", 1, 1, 16, 25, 10, true),
            WeeklyDayDto("2026-11-03", 0, 0, 5, 5, 10, false),
            WeeklyDayDto("2026-11-04", 0, 0, 7, 0, 10, false),
        ),
        totals = WeeklyTotalsDto(
            lessonsCompleted = 5,
            quizzesCompleted = 2,
            minutesLearned = 72,
            xpEarned = 95,
            goalDays = 4,
            activeDays = 5,
        ),
    )

    val achievements = AchievementsDto(
        items = listOf(
            AchievementDto(
                code = "FIRST_LESSON",
                title = "First Lesson",
                description = "Complete your first lesson.",
                order = 1,
                earned = true,
                earnedAt = "2026-10-20T09:30:00.000Z",
                progress = AchievementProgressDto(9, 1, 100, "2026-10-20T09:30:00.000Z"),
            ),
            AchievementDto(
                code = "FIRST_QUIZ",
                title = "First Quiz",
                description = "Complete your first quiz.",
                order = 2,
                earned = true,
                earnedAt = "2026-10-24T18:10:00.000Z",
                progress = AchievementProgressDto(3, 1, 100, "2026-10-24T18:10:00.000Z"),
            ),
            AchievementDto(
                code = "STREAK_3",
                title = "Three-Day Streak",
                description = "Learn three days in a row.",
                order = 3,
                earned = true,
                earnedAt = "2026-10-29T19:05:00.000Z",
                progress = AchievementProgressDto(5, 3, 100, "2026-10-29T19:05:00.000Z"),
            ),
            AchievementDto(
                code = "STREAK_7",
                title = "Seven-Day Streak",
                description = "Learn seven days in a row.",
                order = 4,
                earned = false,
                progress = AchievementProgressDto(5, 7, 71, null),
            ),
            AchievementDto(
                code = "LESSONS_10",
                title = "Ten Lessons",
                description = "Complete ten lessons.",
                order = 5,
                earned = false,
                progress = AchievementProgressDto(9, 10, 90, null),
            ),
            AchievementDto(
                code = "DAILY_GOAL_ACHIEVED",
                title = "Goal Getter",
                description = "Reach your daily learning goal.",
                order = 6,
                earned = false,
                progress = AchievementProgressDto(0, 1, 0, null),
            ),
        ),
        earnedCount = 3,
        totalCount = 6,
    )
}

/** Short weekday initial for a `YYYY-MM-DD` date, e.g. `2026-11-04` → `W`. */
fun weekdayInitial(date: String): String = runCatching {
    when (java.time.LocalDate.parse(date).dayOfWeek.value) {
        1 -> "M"
        2 -> "T"
        3 -> "W"
        4 -> "T"
        5 -> "F"
        6 -> "S"
        else -> "S"
    }
}.getOrDefault("")

/** Fraction of the tallest weekly bar, kept in the 0..1 range. */
fun weeklyBarFraction(minutes: Int, days: List<WeeklyDayDto>): Float {
    val max = days.maxOfOrNull { it.minutesLearned } ?: 0
    if (max <= 0) return 0f
    return (minutes.coerceAtLeast(0).toFloat() / max.toFloat()).coerceIn(0f, 1f)
}
