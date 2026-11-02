package com.smartme.app.data.onboarding

import com.smartme.app.core.network.ApiResult
import com.smartme.app.data.auth.AuthRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OnboardingRepository @Inject constructor(
    private val authRepository: AuthRepository,
    private val draftStore: OnboardingDraftStore,
) {

    /**
     * Saves the draft as the learner's first preferences and marks onboarding
     * complete. An empty draft is valid and implements "skip".
     */
    suspend fun complete(draft: OnboardingDraft): ApiResult<Unit> {
        val result = authRepository.completeOnboarding(draft.toRequest())
        if (result is ApiResult.Success) {
            draftStore.clear()
        }
        return result
    }
}
