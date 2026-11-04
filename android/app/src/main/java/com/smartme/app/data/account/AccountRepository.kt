package com.smartme.app.data.account

import com.smartme.app.core.network.ApiExecutor
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.DeletionReasonRequest
import com.smartme.app.core.network.DeletionRequestDto
import com.smartme.app.core.network.NotificationPreferencesDto
import com.smartme.app.core.network.PreferencesDto
import com.smartme.app.core.network.ProfileDto
import com.smartme.app.core.network.SmartMeApi
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import javax.inject.Inject
import javax.inject.Singleton

/** One editable profile field, usable as a map key for validation errors. */
enum class ProfileField(val key: String) {
    NAME("name"),
    AVATAR_URL("avatarUrl"),
    HEADLINE("headline"),
    OCCUPATION("occupation"),
    CITY("city"),
    BIO("bio"),
    DATE_OF_BIRTH("dateOfBirth"),
}

/** Editable account fields. [clear] sends an explicit JSON null for a field. */
data class ProfileUpdate(
    val name: String? = null,
    val avatarUrl: String? = null,
    val headline: String? = null,
    val occupation: String? = null,
    val city: String? = null,
    val bio: String? = null,
    val dateOfBirth: String? = null,
    val clear: Set<ProfileField> = emptySet(),
) {
    fun toJson(): JsonObject = buildJsonObject {
        name?.let { put("name", it) }
        avatarUrl?.let { put("avatarUrl", it) }
        headline?.let { put("headline", it) }
        occupation?.let { put("occupation", it) }
        city?.let { put("city", it) }
        bio?.let { put("bio", it) }
        dateOfBirth?.let { put("dateOfBirth", it) }
        clear.forEach { field -> put(field.key, JsonNull) }
    }
}

/** One selectable learning preference update. Null goal/proficiency clears them. */
data class PreferencesUpdate(
    val learningGoal: String? = null,
    val proficiency: String? = null,
    val explanationLanguage: String? = null,
    val dailyGoalMinutes: Int? = null,
    val interests: List<String>? = null,
    val clearLearningGoal: Boolean = false,
    val clearProficiency: Boolean = false,
) {
    fun toJson(): JsonObject = buildJsonObject {
        when {
            clearLearningGoal -> put("learningGoal", JsonNull)
            learningGoal != null -> put("learningGoal", learningGoal)
        }
        when {
            clearProficiency -> put("proficiency", JsonNull)
            proficiency != null -> put("proficiency", proficiency)
        }
        explanationLanguage?.let { put("explanationLanguage", it) }
        dailyGoalMinutes?.let { put("dailyGoalMinutes", it) }
        interests?.let { values ->
            put(
                "interests",
                kotlinx.serialization.json.JsonArray(values.map { kotlinx.serialization.json.JsonPrimitive(it) }),
            )
        }
    }
}

/**
 * Profile, preferences, reminder settings and the account-deletion flow.
 *
 * Reads and writes return the server's view so the UI never guesses what was
 * persisted. Patch bodies are built as [JsonObject]s so cleared fields travel as
 * explicit nulls.
 */
@Singleton
class AccountRepository @Inject constructor(
    private val api: SmartMeApi,
    private val apiExecutor: ApiExecutor,
) {

    suspend fun profile(): ApiResult<ProfileDto> = apiExecutor.call { api.profile() }

    suspend fun updateProfile(update: ProfileUpdate): ApiResult<ProfileDto> = apiExecutor.call {
        api.updateProfile(update.toJson())
    }

    suspend fun preferences(): ApiResult<PreferencesDto> = apiExecutor.call { api.preferences() }

    suspend fun updatePreferences(update: PreferencesUpdate): ApiResult<PreferencesDto> =
        apiExecutor.call {
            api.updatePreferences(update.toJson())
        }

    suspend fun notificationPreferences(): ApiResult<NotificationPreferencesDto> =
        apiExecutor.call {
            api.notificationPreferences()
        }

    suspend fun updateNotificationPreferences(
        preferences: NotificationPreferencesDto,
    ): ApiResult<NotificationPreferencesDto> = apiExecutor.call {
        api.updateNotificationPreferences(
            buildJsonObject {
                put("dailyReminder", preferences.dailyReminder)
                put("incompleteLessonReminder", preferences.incompleteLessonReminder)
                put("streakReminder", preferences.streakReminder)
                put("newLessonAnnouncements", preferences.newLessonAnnouncements)
                put("reminderTimeLocal", preferences.reminderTimeLocal)
            },
        )
    }

    suspend fun deletionRequest(): ApiResult<DeletionRequestDto?> = apiExecutor.call {
        api.deletionRequest().request
    }

    suspend fun requestDeletion(reason: String?): ApiResult<DeletionRequestDto> = apiExecutor.call {
        api.requestDeletion(DeletionReasonRequest(reason = reason?.trim()?.takeIf { it.isNotEmpty() }))
    }

    suspend fun cancelDeletion(): ApiResult<DeletionRequestDto> = apiExecutor.call {
        api.cancelDeletion()
    }
}
