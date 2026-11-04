package com.smartme.app.feature.profile.preferences

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.PreferencesDto
import com.smartme.app.data.account.AccountRepository
import com.smartme.app.data.account.PreferencesUpdate
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PreferencesUiState(
    val loading: Boolean = true,
    val loadError: String? = null,
    val learningGoal: String? = null,
    val proficiency: String? = null,
    val explanationLanguage: String = "HINGLISH",
    val dailyGoalMinutes: Int = 10,
    val interests: Set<String> = emptySet(),
    val saving: Boolean = false,
    val saveError: String? = null,
    val saved: Boolean = false,
)

@HiltViewModel
class LearningPreferencesViewModel @Inject constructor(
    private val repository: AccountRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(PreferencesUiState())
    val state: StateFlow<PreferencesUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, loadError = null)
            when (val result = repository.preferences()) {
                is ApiResult.Success -> _state.value = result.data.toUiState()
                is ApiResult.Failure -> _state.value = _state.value.copy(
                    loading = false,
                    loadError = result.error.message,
                )
            }
        }
    }

    fun selectGoal(value: String) {
        _state.value = _state.value.copy(
            learningGoal = if (_state.value.learningGoal == value) null else value,
            saved = false,
            saveError = null,
        )
    }

    fun selectProficiency(value: String) {
        _state.value = _state.value.copy(
            proficiency = if (_state.value.proficiency == value) null else value,
            saved = false,
            saveError = null,
        )
    }

    fun selectLanguage(value: String) {
        _state.value = _state.value.copy(
            explanationLanguage = value,
            saved = false,
            saveError = null,
        )
    }

    fun selectDailyGoal(minutes: Int) {
        _state.value = _state.value.copy(
            dailyGoalMinutes = minutes,
            saved = false,
            saveError = null,
        )
    }

    fun toggleInterest(value: String) {
        val current = _state.value.interests
        _state.value = _state.value.copy(
            interests = if (value in current) current - value else current + value,
            saved = false,
            saveError = null,
        )
    }

    fun save() {
        val current = _state.value
        if (current.saving) return

        viewModelScope.launch {
            _state.value = current.copy(saving = true, saveError = null, saved = false)
            val update = PreferencesUpdate(
                learningGoal = current.learningGoal,
                proficiency = current.proficiency,
                explanationLanguage = current.explanationLanguage,
                dailyGoalMinutes = current.dailyGoalMinutes,
                interests = current.interests.toList(),
                clearLearningGoal = current.learningGoal == null,
                clearProficiency = current.proficiency == null,
            )
            when (val result = repository.updatePreferences(update)) {
                is ApiResult.Success -> _state.value = result.data.toUiState(saved = true)
                is ApiResult.Failure -> _state.value = _state.value.copy(
                    saving = false,
                    saveError = result.error.message,
                )
            }
        }
    }
}

private fun PreferencesDto.toUiState(saved: Boolean = false) = PreferencesUiState(
    loading = false,
    learningGoal = learningGoal,
    proficiency = proficiency,
    explanationLanguage = explanationLanguage,
    dailyGoalMinutes = dailyGoalMinutes,
    interests = interests.toSet(),
    saved = saved,
)
