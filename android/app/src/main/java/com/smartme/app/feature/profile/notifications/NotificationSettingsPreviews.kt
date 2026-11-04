package com.smartme.app.feature.profile.notifications

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews

@ScreenPreviews
@Composable
private fun NotificationSettingsPreview() {
    PreviewContainer {
        NotificationSettingsForm(
            state = NotificationSettingsUiState(
                loading = false,
                dailyReminder = true,
                incompleteLessonReminder = true,
                streakReminder = true,
                newLessonAnnouncements = false,
                reminderTimeLocal = "19:00",
                timeZone = "Asia/Kolkata",
            ),
            onDailyReminder = {},
            onIncompleteLessonReminder = {},
            onStreakReminder = {},
            onNewLessonAnnouncements = {},
            onReminderTime = {},
            onSave = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun NotificationSettingsSavedPreview() {
    PreviewContainer {
        NotificationSettingsForm(
            state = NotificationSettingsUiState(
                loading = false,
                dailyReminder = true,
                incompleteLessonReminder = false,
                streakReminder = true,
                newLessonAnnouncements = true,
                reminderTimeLocal = "07:30",
                timeZone = "Asia/Kolkata",
                saved = true,
            ),
            onDailyReminder = {},
            onIncompleteLessonReminder = {},
            onStreakReminder = {},
            onNewLessonAnnouncements = {},
            onReminderTime = {},
            onSave = {},
        )
    }
}
