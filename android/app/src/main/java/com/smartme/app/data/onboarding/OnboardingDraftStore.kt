package com.smartme.app.data.onboarding

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * In-memory draft shared by the pre-auth wizard and the session gate.
 *
 * Losing the draft on process death is acceptable: the learner simply sees the
 * wizard again or finishes onboarding from the profile later.
 */
@Singleton
class OnboardingDraftStore @Inject constructor() {

    private val _draft = MutableStateFlow(OnboardingDraft())
    val draft: StateFlow<OnboardingDraft> = _draft.asStateFlow()

    fun current(): OnboardingDraft = _draft.value

    fun update(transform: (OnboardingDraft) -> OnboardingDraft) {
        _draft.value = transform(_draft.value)
    }

    fun clear() {
        _draft.value = OnboardingDraft()
    }
}
