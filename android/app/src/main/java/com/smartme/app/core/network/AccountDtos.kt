package com.smartme.app.core.network

import kotlinx.serialization.Serializable

// Wire shapes for `/profile`, `/preferences`, `/notifications/preferences` and
// `/account/deletion-request`. See docs/API-PROFILE.md, API-NOTIFICATIONS.md and
// API-AUTH.md. Nullable fields stay nullable so a cleared value round-trips.

@Serializable
data class ProfileDetailsDto(
    val headline: String? = null,
    val occupation: String? = null,
    val city: String? = null,
    val bio: String? = null,
    val dateOfBirth: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

@Serializable
data class ProfileDto(
    val id: String = "",
    val email: String = "",
    val name: String? = null,
    val avatarUrl: String? = null,
    val emailVerifiedAt: String? = null,
    val timeZone: String = "Asia/Kolkata",
    val locale: String = "en-IN",
    val onboardingCompletedAt: String? = null,
    val createdAt: String? = null,
    val profile: ProfileDetailsDto = ProfileDetailsDto(),
)

@Serializable
data class PreferencesDto(
    val learningGoal: String? = null,
    val proficiency: String? = null,
    val explanationLanguage: String = "HINGLISH",
    val dailyGoalMinutes: Int = 10,
    val interests: List<String> = emptyList(),
    val updatedAt: String? = null,
)

@Serializable
data class NotificationPreferencesDto(
    val dailyReminder: Boolean = true,
    val incompleteLessonReminder: Boolean = true,
    val streakReminder: Boolean = true,
    val newLessonAnnouncements: Boolean = true,
    val reminderTimeLocal: String = "19:00",
    val timeZone: String = "Asia/Kolkata",
    val updatedAt: String? = null,
)

@Serializable
data class DeletionReasonRequest(val reason: String? = null)

@Serializable
data class DeletionRequestDto(
    val id: String = "",
    val status: String = "PENDING",
    val reason: String? = null,
    val requestedAt: String? = null,
    val scheduledFor: String? = null,
    val completedAt: String? = null,
    val canceledAt: String? = null,
    val retentionNotice: String? = null,
) {
    val isPending: Boolean get() = status == "PENDING"
}

@Serializable
data class DeletionRequestEnvelope(val request: DeletionRequestDto? = null)
