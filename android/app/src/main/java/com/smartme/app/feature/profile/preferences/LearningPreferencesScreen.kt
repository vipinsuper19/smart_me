package com.smartme.app.feature.profile.preferences

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import com.smartme.app.data.onboarding.OnboardingOption
import com.smartme.app.data.onboarding.OnboardingOptions
import com.smartme.app.feature.learning.LearningTopBar

@Composable
fun LearningPreferencesScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: LearningPreferencesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    Column(modifier = modifier.fillMaxSize()) {
        LearningTopBar(
            title = stringResource(R.string.preferences_title),
            onBack = onBack,
        )
        when {
            state.loading -> LoadingState()
            state.loadError != null -> ErrorState(
                title = stringResource(R.string.preferences_load_error_title),
                message = state.loadError.orEmpty(),
                onRetry = viewModel::load,
            )

            else -> PreferencesForm(
                state = state,
                onSelectGoal = viewModel::selectGoal,
                onSelectProficiency = viewModel::selectProficiency,
                onSelectLanguage = viewModel::selectLanguage,
                onSelectDailyGoal = viewModel::selectDailyGoal,
                onToggleInterest = viewModel::toggleInterest,
                onSave = viewModel::save,
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun PreferencesForm(
    state: PreferencesUiState,
    onSelectGoal: (String) -> Unit,
    onSelectProficiency: (String) -> Unit,
    onSelectLanguage: (String) -> Unit,
    onSelectDailyGoal: (Int) -> Unit,
    onToggleInterest: (String) -> Unit,
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
            PreferenceSection(
                title = stringResource(R.string.onboarding_step_goal_title),
                subtitle = stringResource(R.string.onboarding_step_goal_subtitle),
            ) {
                OnboardingOptions.learningGoals.forEach { option ->
                    OptionRow(
                        option = option,
                        selected = state.learningGoal == option.value,
                        onClick = { onSelectGoal(option.value) },
                    )
                }
            }
        }

        item {
            PreferenceSection(
                title = stringResource(R.string.onboarding_step_proficiency_title),
                subtitle = stringResource(R.string.onboarding_step_proficiency_subtitle),
            ) {
                OnboardingOptions.proficiencyLevels.forEach { option ->
                    OptionRow(
                        option = option,
                        selected = state.proficiency == option.value,
                        onClick = { onSelectProficiency(option.value) },
                    )
                }
            }
        }

        item {
            PreferenceSection(
                title = stringResource(R.string.onboarding_step_language_title),
                subtitle = stringResource(R.string.onboarding_step_language_subtitle),
            ) {
                OnboardingOptions.explanationLanguages.forEach { option ->
                    OptionRow(
                        option = option,
                        selected = state.explanationLanguage == option.value,
                        onClick = { onSelectLanguage(option.value) },
                    )
                }
            }
        }

        item {
            PreferenceSection(
                title = stringResource(R.string.onboarding_step_daily_title),
                subtitle = stringResource(R.string.onboarding_step_daily_subtitle),
            ) {
                OnboardingOptions.dailyGoals.forEach { minutes ->
                    OptionRow(
                        option = OnboardingOption(
                            value = minutes.toString(),
                            labelRes = OnboardingOptions.dailyGoalLabelRes(minutes),
                            descriptionRes = OnboardingOptions.dailyGoalDescriptionRes(minutes),
                        ),
                        selected = state.dailyGoalMinutes == minutes,
                        onClick = { onSelectDailyGoal(minutes) },
                    )
                }
            }
        }

        item {
            PreferenceSection(
                title = stringResource(R.string.onboarding_step_interests_title),
                subtitle = stringResource(R.string.onboarding_step_interests_subtitle),
            ) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                    verticalArrangement = Arrangement.spacedBy(Spacing.sm),
                ) {
                    OnboardingOptions.interests.forEach { option ->
                        FilterChip(
                            selected = option.value in state.interests,
                            onClick = { onToggleInterest(option.value) },
                            label = { Text(text = stringResource(option.labelRes)) },
                        )
                    }
                }
            }
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
                Row(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.xs),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.CheckCircle,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.secondary,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = stringResource(R.string.preferences_saved),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.secondary,
                    )
                }
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
                        text = stringResource(R.string.preferences_saving),
                        modifier = Modifier.padding(start = Spacing.sm),
                    )
                } else {
                    Text(text = stringResource(R.string.preferences_save))
                }
            }
        }
    }
}

@Composable
private fun PreferenceSection(
    title: String,
    subtitle: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        content()
    }
}

@Composable
private fun OptionRow(
    option: OnboardingOption,
    selected: Boolean,
    onClick: () -> Unit,
) {
    OutlinedCard(
        modifier = Modifier
            .fillMaxWidth()
            .selectable(selected = selected, onClick = onClick),
        shape = MaterialTheme.shapes.medium,
        border = if (selected) {
            BorderStroke(2.dp, MaterialTheme.colorScheme.primary)
        } else {
            BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
        },
    ) {
        Row(
            modifier = Modifier.padding(horizontal = Spacing.md, vertical = Spacing.sm),
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RadioButton(selected = selected, onClick = onClick)
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = stringResource(option.labelRes),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                option.descriptionRes?.let { description ->
                    Text(
                        text = stringResource(description),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
