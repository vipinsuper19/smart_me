package com.smartme.app.feature.profile

import com.smartme.app.core.network.NotificationPreferencesDto
import com.smartme.app.core.network.PreferencesDto
import com.smartme.app.core.network.ProfileDetailsDto
import com.smartme.app.core.network.ProfileDto

/** Fixtures for profile, preferences and reminder previews. */
object ProfileSamples {

    val profile = ProfileDto(
        id = "preview-user",
        email = "aarav.sharma@example.com",
        name = "Aarav Sharma",
        avatarUrl = null,
        emailVerifiedAt = "2026-10-20T09:30:00.000Z",
        timeZone = "Asia/Kolkata",
        locale = "en-IN",
        onboardingCompletedAt = "2026-10-20T09:30:00.000Z",
        createdAt = "2026-10-18T09:30:00.000Z",
        profile = ProfileDetailsDto(
            headline = "Learning every day",
            occupation = "Product designer",
            city = "Delhi",
            bio = "Working on my English for interviews and client conversations.",
            dateOfBirth = "1995-08-15",
            createdAt = "2026-10-18T09:30:00.000Z",
            updatedAt = "2026-10-20T09:30:00.000Z",
        ),
    )

    val preferences = PreferencesDto(
        learningGoal = "INTERVIEW_PREPARATION",
        proficiency = "INTERMEDIATE",
        explanationLanguage = "HINGLISH",
        dailyGoalMinutes = 10,
        interests = listOf("interviews", "workplace-communication"),
        updatedAt = "2026-10-24T18:10:00.000Z",
    )

    val notificationPreferences = NotificationPreferencesDto(
        dailyReminder = true,
        incompleteLessonReminder = true,
        streakReminder = true,
        newLessonAnnouncements = false,
        reminderTimeLocal = "19:00",
        timeZone = "Asia/Kolkata",
        updatedAt = "2026-10-24T18:10:00.000Z",
    )
}
