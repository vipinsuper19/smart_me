package com.smartme.app.feature.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.core.network.ApiResult
import com.smartme.app.data.onboarding.OnboardingDraft
import com.smartme.app.data.onboarding.OnboardingDraftStore
import com.smartme.app.data.onboarding.OnboardingRepository
import com.smartme.app.feature.common.UiText
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class OnboardingUiState(
    val stepIndex: Int = 0,
    val draft: OnboardingDraft = OnboardingDraft(),
    val submitting: Boolean = false,
    val error: UiText? = null,
) {
    val step: OnboardingStep get() = OnboardingStep.entries[stepIndex]
    val isLastStep: Boolean get() = stepIndex == OnboardingStep.entries.lastIndex
    val canGoBack: Boolean get() = stepIndex > 0
    val progress: Float get() = (stepIndex + 1).toFloat() / OnboardingStep.entries.size
}

/**
 * Wizard state. Choices are written to [OnboardingDraftStore] on every tap so a
 * pre-auth run survives the navigation to registration and a post-auth failure
 * can retry without re-entering anything.
 */
@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val draftStore: OnboardingDraftStore,
    private val onboardingRepository: OnboardingRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(OnboardingUiState(draft = draftStore.current()))
    val state: StateFlow<OnboardingUiState> = _state.asStateFlow()

    fun selectGoal(value: String) = updateDraft { it.copy(learningGoal = value) }

    fun selectProficiency(value: String) = updateDraft { it.copy(proficiency = value) }

    fun selectLanguage(value: String) = updateDraft { it.copy(explanationLanguage = value) }

    fun selectDailyGoal(minutes: Int) = updateDraft { it.copy(dailyGoalMinutes = minutes) }

    fun toggleInterest(value: String) = updateDraft {
        it.copy(interests = if (value in it.interests) it.interests - value else it.interests + value)
    }

    fun goNext() {
        _state.update {
            it.copy(
                stepIndex = (it.stepIndex + 1).coerceAtMost(OnboardingStep.entries.lastIndex),
                error = null,
            )
        }
    }

    fun goBack() {
        _state.update {
            it.copy(stepIndex = (it.stepIndex - 1).coerceAtLeast(0), error = null)
        }
    }

    /** Marks the draft for submission once an account exists. */
    fun markSubmitRequested() {
        val draft = draftStore.current().copy(submitRequested = true)
        draftStore.update { draft }
        _state.update { it.copy(draft = draft) }
    }

    /**
     * Post-auth completion. An empty or partial draft is still valid; the API
     * treats missing fields as "keep the current/default value".
     */
    fun complete(onSuccess: () -> Unit) {
        if (_state.value.submitting) return

        val draft = draftStore.current().let {
            if (it.submitRequested) it else it.copy(submitRequested = true)
        }
        draftStore.update { draft }

        viewModelScope.launch {
            _state.update { it.copy(submitting = true, error = null) }
            when (val result = onboardingRepository.complete(draft)) {
                is ApiResult.Success -> {
                    _state.update { it.copy(submitting = false) }
                    onSuccess()
                }

                is ApiResult.Failure -> _state.update {
                    it.copy(submitting = false, error = UiText.Plain(result.error.message))
                }
            }
        }
    }

    private fun updateDraft(transform: (OnboardingDraft) -> OnboardingDraft) {
        val updated = transform(draftStore.current())
        draftStore.update { updated }
        _state.update { it.copy(draft = updated, error = null) }
    }
}
