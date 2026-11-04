package com.smartme.app.core.network

import kotlinx.serialization.Serializable

// Progress dashboard and achievements wire shapes from docs/API-PROGRESS.md.

@Serializable
data class TopicProgressDto(
    val id: String = "",
    val slug: String = "",
    val title: String = "",
    val totalLessons: Int = 0,
    val startedLessons: Int = 0,
    val completedLessons: Int = 0,
    val percent: Int = 0,
)

@Serializable
data class ProgressOverviewDto(
    val lessonsStarted: Int = 0,
    val lessonsCompleted: Int = 0,
    val quizAttempts: Int = 0,
    val quizzesCompleted: Int = 0,
    val minutesLearned: Int = 0,
    val totalXp: Int = 0,
    val level: Int = 1,
    val levelProgress: LevelProgressDto = LevelProgressDto(),
    val currentStreak: Int = 0,
    val longestStreak: Int = 0,
    val dailyGoal: DailyGoalDto? = null,
    val topics: List<TopicProgressDto> = emptyList(),
)

@Serializable
data class WeeklyDayDto(
    val date: String = "",
    val lessonsCompleted: Int = 0,
    val quizzesCompleted: Int = 0,
    val minutesLearned: Int = 0,
    val xpEarned: Int = 0,
    val dailyGoalMinutes: Int = 10,
    val goalMet: Boolean = false,
)

@Serializable
data class WeeklyTotalsDto(
    val lessonsCompleted: Int = 0,
    val quizzesCompleted: Int = 0,
    val minutesLearned: Int = 0,
    val xpEarned: Int = 0,
    val goalDays: Int = 0,
    val activeDays: Int = 0,
)

@Serializable
data class WeeklyProgressDto(
    val timeZone: String = "Asia/Kolkata",
    val from: String = "",
    val to: String = "",
    val days: List<WeeklyDayDto> = emptyList(),
    val totals: WeeklyTotalsDto = WeeklyTotalsDto(),
)

@Serializable
data class AchievementProgressDto(
    val currentValue: Int = 0,
    val targetValue: Int = 0,
    val percent: Int = 0,
    val completedAt: String? = null,
)

@Serializable
data class AchievementDto(
    val code: String = "",
    val title: String = "",
    val description: String? = null,
    val iconUrl: String? = null,
    val xpReward: Int = 0,
    val order: Int = 0,
    val earned: Boolean = false,
    val earnedAt: String? = null,
    val progress: AchievementProgressDto? = null,
)

@Serializable
data class AchievementsDto(
    val items: List<AchievementDto> = emptyList(),
    val earnedCount: Int = 0,
    val totalCount: Int = 0,
)
