package com.smartme.app.data.onboarding

import com.smartme.app.core.network.OnboardingCompleteRequest

/**
 * Choices collected by the onboarding wizard.
 *
 * The draft lives outside the auth screens because the PRD collects preferences
 * *before* account creation: the wizard fills this, then sign-up/sign-in consumes
 * it and submits it as the first authenticated write.
 */
data class OnboardingDraft(
    val learningGoal: String? = null,
    val proficiency: String? = null,
    val explanationLanguage: String = DEFAULT_EXPLANATION_LANGUAGE,
    val dailyGoalMinutes: Int = DEFAULT_DAILY_GOAL_MINUTES,
    val interests: Set<String> = emptySet(),
    /** Set once the learner finishes or skips the wizard. */
    val submitRequested: Boolean = false,
) {
    fun toRequest(): OnboardingCompleteRequest = OnboardingCompleteRequest(
        learningGoal = learningGoal,
        proficiency = proficiency,
        explanationLanguage = explanationLanguage,
        dailyGoalMinutes = dailyGoalMinutes,
        interests = interests.toList(),
    )

    companion object {
        const val DEFAULT_EXPLANATION_LANGUAGE = "HINGLISH"
        const val DEFAULT_DAILY_GOAL_MINUTES = 10
    }
}
