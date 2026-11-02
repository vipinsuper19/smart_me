package com.smartme.app.feature.onboarding

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.data.onboarding.OnboardingDraft

/** A completed-looking draft so every step shows both selected and unselected states. */
private val previewDraft = OnboardingDraft(
    learningGoal = "IMPROVE_ENGLISH",
    proficiency = "ELEMENTARY",
    explanationLanguage = "HINGLISH",
    dailyGoalMinutes = 10,
    interests = setOf("english-speaking", "money-basics"),
)

@Composable
private fun StepPreview(stepIndex: Int) {
    PreviewContainer {
        OnboardingContent(
            state = OnboardingUiState(stepIndex = stepIndex, draft = previewDraft),
            mode = OnboardingMode.PRE_AUTH,
            onBack = {},
            onContinue = {},
            onGoal = {},
            onProficiency = {},
            onLanguage = {},
            onDailyGoal = {},
            onInterest = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun OnboardingGoalPreview() {
    StepPreview(stepIndex = OnboardingStep.GOAL.ordinal)
}

@ScreenPreviews
@Composable
private fun OnboardingProficiencyPreview() {
    StepPreview(stepIndex = OnboardingStep.PROFICIENCY.ordinal)
}

@ScreenPreviews
@Composable
private fun OnboardingLanguagePreview() {
    StepPreview(stepIndex = OnboardingStep.LANGUAGE.ordinal)
}

@ScreenPreviews
@Composable
private fun OnboardingDailyGoalPreview() {
    StepPreview(stepIndex = OnboardingStep.DAILY_GOAL.ordinal)
}

@ScreenPreviews
@Composable
private fun OnboardingInterestsPreview() {
    StepPreview(stepIndex = OnboardingStep.INTERESTS.ordinal)
}
