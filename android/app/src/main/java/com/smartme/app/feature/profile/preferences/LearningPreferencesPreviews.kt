package com.smartme.app.feature.profile.preferences

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews

@ScreenPreviews
@Composable
private fun LearningPreferencesPreview() {
    PreviewContainer {
        PreferencesForm(
            state = PreferencesUiState(
                loading = false,
                learningGoal = "INTERVIEW_PREPARATION",
                proficiency = "INTERMEDIATE",
                explanationLanguage = "HINGLISH",
                dailyGoalMinutes = 10,
                interests = setOf("interviews", "workplace-communication"),
            ),
            onSelectGoal = {},
            onSelectProficiency = {},
            onSelectLanguage = {},
            onSelectDailyGoal = {},
            onToggleInterest = {},
            onSave = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun LearningPreferencesSavedPreview() {
    PreviewContainer {
        PreferencesForm(
            state = PreferencesUiState(
                loading = false,
                learningGoal = "CAREER_SKILLS",
                proficiency = "BEGINNER",
                explanationLanguage = "HINGLISH",
                dailyGoalMinutes = 15,
                interests = setOf("money-basics"),
                saved = true,
            ),
            onSelectGoal = {},
            onSelectProficiency = {},
            onSelectLanguage = {},
            onSelectDailyGoal = {},
            onToggleInterest = {},
            onSave = {},
        )
    }
}
