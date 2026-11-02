package com.smartme.app.data.onboarding

import androidx.annotation.StringRes
import com.smartme.app.R

/**
 * One selectable onboarding answer: the API value, its display label and an
 * optional supporting line.
 */
data class OnboardingOption(
    val value: String,
    @param:StringRes val labelRes: Int,
    @param:StringRes val descriptionRes: Int? = null,
)

/**
 * The curated onboarding choices.
 *
 * These mirror the backend's `GET /onboarding` options. They are local because
 * the wizard runs before the learner has an access token; when the lists become
 * dynamic they should be fetched after sign-in and cached.
 */
object OnboardingOptions {

    val learningGoals = listOf(
        OnboardingOption("IMPROVE_ENGLISH", R.string.goal_improve_english),
        OnboardingOption("INTERVIEW_PREPARATION", R.string.goal_interview_prep),
        OnboardingOption("CAREER_SKILLS", R.string.goal_career_skills),
        OnboardingOption("CONFIDENCE_COMMUNICATION", R.string.goal_confidence),
    )

    val proficiencyLevels = listOf(
        OnboardingOption(
            "BEGINNER",
            R.string.proficiency_beginner,
            R.string.proficiency_beginner_description,
        ),
        OnboardingOption(
            "ELEMENTARY",
            R.string.proficiency_elementary,
            R.string.proficiency_elementary_description,
        ),
        OnboardingOption(
            "INTERMEDIATE",
            R.string.proficiency_intermediate,
            R.string.proficiency_intermediate_description,
        ),
        OnboardingOption(
            "ADVANCED",
            R.string.proficiency_advanced,
            R.string.proficiency_advanced_description,
        ),
    )

    // English + Hindi first: it is the recommended choice for most learners.
    val explanationLanguages = listOf(
        OnboardingOption(
            "HINGLISH",
            R.string.language_hinglish,
            R.string.language_hinglish_description,
        ),
        OnboardingOption(
            "ENGLISH",
            R.string.language_english,
            R.string.language_english_description,
        ),
        OnboardingOption(
            "HINDI",
            R.string.language_hindi,
            R.string.language_hindi_description,
        ),
    )

    val dailyGoals = listOf(5, 10, 15)

    /** Maps the API's minute values to their display label. */
    @StringRes
    fun dailyGoalLabelRes(minutes: Int): Int = when (minutes) {
        5 -> R.string.daily_goal_5
        15 -> R.string.daily_goal_15
        else -> R.string.daily_goal_10
    }

    /** Maps the API's minute values to the supporting line. */
    @StringRes
    fun dailyGoalDescriptionRes(minutes: Int): Int = when (minutes) {
        5 -> R.string.daily_goal_5_description
        15 -> R.string.daily_goal_15_description
        else -> R.string.daily_goal_10_description
    }

    val interests = listOf(
        OnboardingOption("english-speaking", R.string.interest_english_speaking),
        OnboardingOption("interviews", R.string.interest_interviews),
        OnboardingOption("workplace-communication", R.string.interest_workplace),
        OnboardingOption("money-basics", R.string.interest_money_basics),
        OnboardingOption("confidence", R.string.interest_confidence),
    )
}
