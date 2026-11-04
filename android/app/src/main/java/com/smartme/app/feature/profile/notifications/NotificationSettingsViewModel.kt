package com.smartme.app.feature.profile.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.NotificationPreferencesDto
import com.smartme.app.data.account.AccountRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class NotificationSettingsUiState(
    val loading: Boolean = true,
    val loadError: String? = null,
    val dailyReminder: Boolean = true,
    val incompleteLessonReminder: Boolean = true,
    val streakReminder: Boolean = true,
    val newLessonAnnouncements: Boolean = true,
    val reminderTimeLocal: String = "19:00",
    val timeZone: String = "Asia/Kolkata",
    val saving: Boolean = false,
    val saveError: String? = null,
    val saved: Boolean = false,
)

@HiltViewModel
class NotificationSettingsViewModel @Inject constructor(
    private val repository: AccountRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(NotificationSettingsUiState())
    val state: StateFlow<NotificationSettingsUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, loadError = null)
            when (val result = repository.notificationPreferences()) {
                is ApiResult.Success -> _state.value = result.data.toUiState()
                is ApiResult.Failure -> _state.value = _state.value.copy(
                    loading = false,
                    loadError = result.error.message,
                )
            }
        }
    }

    fun setDailyReminder(enabled: Boolean) = update { it.copy(dailyReminder = enabled) }

    fun setIncompleteLessonReminder(enabled: Boolean) =
        update { it.copy(incompleteLessonReminder = enabled) }

    fun setStreakReminder(enabled: Boolean) = update { it.copy(streakReminder = enabled) }

    fun setNewLessonAnnouncements(enabled: Boolean) =
        update { it.copy(newLessonAnnouncements = enabled) }

    fun setReminderTime(value: String) = update { it.copy(reminderTimeLocal = value) }

    fun save() {
        val current = _state.value
        if (current.saving) return
        if (parseReminderTime(current.reminderTimeLocal) == null) {
            _state.value = current.copy(
                saveError = "Use a 24-hour time such as 19:00.",
                saved = false,
            )
            return
        }

        viewModelScope.launch {
            _state.value = current.copy(saving = true, saveError = null, saved = false)
            val request = NotificationPreferencesDto(
                dailyReminder = current.dailyReminder,
                incompleteLessonReminder = current.incompleteLessonReminder,
                streakReminder = current.streakReminder,
                newLessonAnnouncements = current.newLessonAnnouncements,
                reminderTimeLocal = current.reminderTimeLocal,
                timeZone = current.timeZone,
            )
            when (val result = repository.updateNotificationPreferences(request)) {
                is ApiResult.Success -> _state.value = result.data.toUiState(saved = true)
                is ApiResult.Failure -> _state.value = _state.value.copy(
                    saving = false,
                    saveError = result.error.message,
                )
            }
        }
    }

    private fun update(transform: (NotificationSettingsUiState) -> NotificationSettingsUiState) {
        _state.value = transform(_state.value).copy(
            saved = false,
            saveError = null,
        )
    }
}

private fun NotificationPreferencesDto.toUiState(saved: Boolean = false) =
    NotificationSettingsUiState(
        loading = false,
        dailyReminder = dailyReminder,
        incompleteLessonReminder = incompleteLessonReminder,
        streakReminder = streakReminder,
        newLessonAnnouncements = newLessonAnnouncements,
        reminderTimeLocal = reminderTimeLocal,
        timeZone = timeZone,
        saved = saved,
    )
