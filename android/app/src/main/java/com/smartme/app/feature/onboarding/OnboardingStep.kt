package com.smartme.app.feature.onboarding

import androidx.annotation.StringRes
import com.smartme.app.R

/** Whether the wizard runs before account creation or after signing in. */
enum class OnboardingMode {
    /** Collect choices, then hand the learner to registration. */
    PRE_AUTH,

    /** The account exists but has not finished onboarding; save directly. */
    POST_AUTH,
}

/**
 * The five questions from PRD §7.2, in order. Keeping them here means the
 * progress indicator, back behaviour and screen copy cannot drift apart.
 */
enum class OnboardingStep(
    @param:StringRes val titleRes: Int,
    @param:StringRes val subtitleRes: Int,
) {
    GOAL(R.string.onboarding_step_goal_title, R.string.onboarding_step_goal_subtitle),
    PROFICIENCY(
        R.string.onboarding_step_proficiency_title,
        R.string.onboarding_step_proficiency_subtitle,
    ),
    LANGUAGE(R.string.onboarding_step_language_title, R.string.onboarding_step_language_subtitle),
    DAILY_GOAL(R.string.onboarding_step_daily_title, R.string.onboarding_step_daily_subtitle),
    INTERESTS(
        R.string.onboarding_step_interests_title,
        R.string.onboarding_step_interests_subtitle,
    ),
}
