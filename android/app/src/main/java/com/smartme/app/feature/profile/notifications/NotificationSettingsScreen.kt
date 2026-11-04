package com.smartme.app.feature.profile.notifications

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smartme.app.R
import com.smartme.app.core.designsystem.component.ErrorState
import com.smartme.app.core.designsystem.component.LoadingState
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.feature.learning.LearningTopBar

@Composable
fun NotificationSettingsScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: NotificationSettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    Column(modifier = modifier.fillMaxSize()) {
        LearningTopBar(
            title = stringResource(R.string.notifications_title),
            onBack = onBack,
        )
        when {
            state.loading -> LoadingState()
            state.loadError != null -> ErrorState(
                title = stringResource(R.string.notifications_load_error_title),
                message = state.loadError.orEmpty(),
                onRetry = viewModel::load,
            )

            else -> NotificationSettingsForm(
                state = state,
                onDailyReminder = viewModel::setDailyReminder,
                onIncompleteLessonReminder = viewModel::setIncompleteLessonReminder,
                onStreakReminder = viewModel::setStreakReminder,
                onNewLessonAnnouncements = viewModel::setNewLessonAnnouncements,
                onReminderTime = viewModel::setReminderTime,
                onSave = viewModel::save,
            )
        }
    }
}

@Composable
internal fun NotificationSettingsForm(
    state: NotificationSettingsUiState,
    onDailyReminder: (Boolean) -> Unit,
    onIncompleteLessonReminder: (Boolean) -> Unit,
    onStreakReminder: (Boolean) -> Unit,
    onNewLessonAnnouncements: (Boolean) -> Unit,
    onReminderTime: (String) -> Unit,
    onSave: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = Spacing.screen,
            end = Spacing.screen,
            top = Spacing.md,
            bottom = Spacing.xl,
        ),
        verticalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        item {
            Text(
                text = stringResource(R.string.notifications_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        item {
            OutlinedCard(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
            ) {
                Column {
                    SwitchRow(
                        title = stringResource(R.string.notifications_daily_title),
                        subtitle = stringResource(R.string.notifications_daily_body),
                        checked = state.dailyReminder,
                        onCheckedChange = onDailyReminder,
                    )
                    HorizontalDivider()
                    SwitchRow(
                        title = stringResource(R.string.notifications_incomplete_title),
                        subtitle = stringResource(R.string.notifications_incomplete_body),
                        checked = state.incompleteLessonReminder,
                        onCheckedChange = onIncompleteLessonReminder,
                    )
                    HorizontalDivider()
                    SwitchRow(
                        title = stringResource(R.string.notifications_streak_title),
                        subtitle = stringResource(R.string.notifications_streak_body),
                        checked = state.streakReminder,
                        onCheckedChange = onStreakReminder,
                    )
                    HorizontalDivider()
                    SwitchRow(
                        title = stringResource(R.string.notifications_new_lesson_title),
                        subtitle = stringResource(R.string.notifications_new_lesson_body),
                        checked = state.newLessonAnnouncements,
                        onCheckedChange = onNewLessonAnnouncements,
                    )
                }
            }
        }

        item { ReminderTimeRow(value = state.reminderTimeLocal, onTimeChange = onReminderTime) }

        item {
            Text(
                text = stringResource(R.string.notifications_timezone, state.timeZone),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        state.saveError?.let { message ->
            item {
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }

        if (state.saved) {
            item {
                Text(
                    text = stringResource(R.string.notifications_saved),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.secondary,
                )
            }
        }

        item {
            Button(
                onClick = onSave,
                enabled = !state.saving,
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
            ) {
                if (state.saving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                    )
                    Text(
                        text = stringResource(R.string.notifications_saving),
                        modifier = Modifier.padding(start = Spacing.sm),
                    )
                } else {
                    Text(text = stringResource(R.string.notifications_save))
                }
            }
        }
    }
}

@Composable
private fun SwitchRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) }
            .padding(horizontal = Spacing.lg, vertical = Spacing.md),
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ReminderTimeRow(
    value: String,
    onTimeChange: (String) -> Unit,
) {
    var showPicker by remember { mutableStateOf(false) }
    val initial = parseReminderTime(value) ?: (19 to 0)

    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { showPicker = true }
                .padding(Spacing.lg),
            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Outlined.Schedule,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(22.dp),
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = stringResource(R.string.notifications_time_title),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = stringResource(R.string.notifications_time_body),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                text = value,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }

    if (showPicker) {
        val pickerState = rememberTimePickerState(
            initialHour = initial.first,
            initialMinute = initial.second,
            is24Hour = true,
        )
        AlertDialog(
            onDismissRequest = { showPicker = false },
            title = { Text(text = stringResource(R.string.notifications_time_title)) },
            text = { TimePicker(state = pickerState) },
            confirmButton = {
                TextButton(
                    onClick = {
                        onTimeChange(formatReminderTime(pickerState.hour, pickerState.minute))
                        showPicker = false
                    },
                ) {
                    Text(text = stringResource(R.string.notifications_time_set))
                }
            },
            dismissButton = {
                TextButton(onClick = { showPicker = false }) {
                    Text(text = stringResource(R.string.action_cancel))
                }
            },
        )
    }
}
