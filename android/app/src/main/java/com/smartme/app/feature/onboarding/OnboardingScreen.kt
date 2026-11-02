package com.smartme.app.feature.onboarding

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.TrendingUp
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material.icons.outlined.BusinessCenter
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.RocketLaunch
import androidx.compose.material.icons.outlined.Savings
import androidx.compose.material.icons.outlined.TrackChanges
import androidx.compose.material.icons.outlined.Translate
import androidx.compose.material.icons.outlined.WorkOutline
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smartme.app.R
import com.smartme.app.core.designsystem.component.PrimaryButton
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.data.onboarding.OnboardingDraft
import com.smartme.app.data.onboarding.OnboardingOptions
import com.smartme.app.feature.common.asString

/**
 * One wizard for both onboarding paths.
 *
 * Pre-auth, finishing hands control to the registration screen and the draft is
 * submitted automatically once the account exists. Post-auth, finishing saves
 * the draft directly so a learner whose account was created elsewhere can
 * complete onboarding without signing up again.
 *
 * The visual structure follows the onboarding design reference: a compact
 * back/progress header, one question per step, icon-led option cards with a
 * trailing selection mark, and a two-column topic grid on the last step.
 */
@Composable
fun OnboardingScreen(
    mode: OnboardingMode,
    onRequireAuth: () -> Unit,
    onFinished: () -> Unit,
    modifier: Modifier = Modifier,
    onClose: (() -> Unit)? = null,
    viewModel: OnboardingViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    BackHandler(enabled = state.canGoBack && !state.submitting) { viewModel.goBack() }

    val finish: () -> Unit = {
        viewModel.markSubmitRequested()
        when (mode) {
            OnboardingMode.PRE_AUTH -> onRequireAuth()
            OnboardingMode.POST_AUTH -> viewModel.complete(onFinished)
        }
    }

    Scaffold(modifier = modifier) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = Spacing.screen, vertical = Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            OnboardingHeader(
                stepIndex = state.stepIndex,
                totalSteps = OnboardingStep.entries.size,
                progress = state.progress,
                showBack = state.canGoBack || onClose != null,
                onBack = {
                    if (state.canGoBack) viewModel.goBack() else onClose?.invoke()
                },
            )

            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(Spacing.sm),
            ) {
                Text(
                    text = stringResource(state.step.titleRes),
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = stringResource(state.step.subtitleRes),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(Spacing.sm))

                StepOptions(
                    step = state.step,
                    draft = state.draft,
                    onGoal = viewModel::selectGoal,
                    onProficiency = viewModel::selectProficiency,
                    onLanguage = viewModel::selectLanguage,
                    onDailyGoal = viewModel::selectDailyGoal,
                    onInterest = viewModel::toggleInterest,
                )
            }

            state.error?.let { error ->
                Text(
                    text = error.asString(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }

            PrimaryButton(
                text = stringResource(
                    when {
                        !state.isLastStep -> R.string.onboarding_continue
                        mode == OnboardingMode.PRE_AUTH -> R.string.onboarding_continue_to_account
                        else -> R.string.onboarding_finish
                    },
                ),
                onClick = {
                    if (state.isLastStep) finish() else viewModel.goNext()
                },
                modifier = Modifier.fillMaxWidth(),
                loading = state.submitting,
            )
        }
    }
}

@Composable
private fun OnboardingHeader(
    stepIndex: Int,
    totalSteps: Int,
    progress: Float,
    showBack: Boolean,
    onBack: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        if (showBack) {
            IconButton(
                onClick = onBack,
                modifier = Modifier.size(Spacing.minTouchTarget),
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                    contentDescription = stringResource(R.string.auth_back),
                )
            }
        } else {
            Spacer(modifier = Modifier.size(Spacing.minTouchTarget))
        }

        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier
                .weight(1f)
                .height(6.dp),
            color = MaterialTheme.colorScheme.primary,
            trackColor = MaterialTheme.colorScheme.outlineVariant,
            strokeCap = StrokeCap.Round,
            gapSize = 0.dp,
            drawStopIndicator = {},
        )

        Text(
            text = stringResource(R.string.onboarding_progress, stepIndex + 1, totalSteps),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun StepOptions(
    step: OnboardingStep,
    draft: OnboardingDraft,
    onGoal: (String) -> Unit,
    onProficiency: (String) -> Unit,
    onLanguage: (String) -> Unit,
    onDailyGoal: (Int) -> Unit,
    onInterest: (String) -> Unit,
) {
    when (step) {
        OnboardingStep.GOAL -> OptionList {
            OnboardingOptions.learningGoals.forEach { option ->
                OptionRow(
                    label = stringResource(option.labelRes),
                    icon = iconFor(step, option.value),
                    selected = draft.learningGoal == option.value,
                    onClick = { onGoal(option.value) },
                )
            }
        }

        OnboardingStep.PROFICIENCY -> OptionList {
            OnboardingOptions.proficiencyLevels.forEach { option ->
                OptionRow(
                    label = stringResource(option.labelRes),
                    description = option.descriptionRes?.let { stringResource(it) },
                    icon = iconFor(step, option.value),
                    selected = draft.proficiency == option.value,
                    onClick = { onProficiency(option.value) },
                )
            }
        }

        OnboardingStep.LANGUAGE -> OptionList {
            OnboardingOptions.explanationLanguages.forEach { option ->
                OptionRow(
                    label = stringResource(option.labelRes),
                    description = option.descriptionRes?.let { stringResource(it) },
                    icon = iconFor(step, option.value),
                    selected = draft.explanationLanguage == option.value,
                    onClick = { onLanguage(option.value) },
                )
            }
        }

        OnboardingStep.DAILY_GOAL -> OptionList {
            OnboardingOptions.dailyGoals.forEach { minutes ->
                OptionRow(
                    label = stringResource(OnboardingOptions.dailyGoalLabelRes(minutes)),
                    description = stringResource(
                        OnboardingOptions.dailyGoalDescriptionRes(minutes),
                    ),
                    icon = iconFor(step, minutes.toString()),
                    selected = draft.dailyGoalMinutes == minutes,
                    onClick = { onDailyGoal(minutes) },
                )
            }
        }

        OnboardingStep.INTERESTS -> InterestGrid(
            draft = draft,
            onInterest = onInterest,
        )
    }
}

@Composable
private fun OptionList(content: @Composable () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        content()
    }
}

@Composable
private fun InterestGrid(
    draft: OnboardingDraft,
    onInterest: (String) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        OnboardingOptions.interests.chunked(2).forEach { rowOptions ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Spacing.md),
            ) {
                rowOptions.forEach { option ->
                    InterestTile(
                        label = stringResource(option.labelRes),
                        icon = iconFor(OnboardingStep.INTERESTS, option.value),
                        selected = option.value in draft.interests,
                        onClick = { onInterest(option.value) },
                        modifier = Modifier.weight(1f),
                    )
                }
                if (rowOptions.size == 1) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun OptionRow(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    description: String? = null,
    icon: ImageVector? = null,
    role: Role = Role.RadioButton,
) {
    val interaction = if (role == Role.Checkbox) {
        Modifier.toggleable(value = selected, role = role, onValueChange = { onClick() })
    } else {
        Modifier.selectable(selected = selected, role = role, onClick = onClick)
    }

    OutlinedCard(
        modifier = modifier
            .fillMaxWidth()
            .then(interaction),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.outlinedCardColors(
            containerColor = optionContainerColor(selected),
        ),
        border = if (selected) {
            BorderStroke(2.dp, MaterialTheme.colorScheme.primary)
        } else {
            CardDefaults.outlinedCardBorder()
        },
    ) {
        Row(
            modifier = Modifier.padding(horizontal = Spacing.lg, vertical = Spacing.md),
            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (icon != null) {
                IconTile(icon = icon)
            }

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.titleSmall,
                    color = if (selected) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
                )
                if (description != null) {
                    Text(
                        text = description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            SelectionMark(selected = selected)
        }
    }
}

@Composable
private fun InterestTile(
    label: String,
    icon: ImageVector?,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedCard(
        modifier = modifier
            .height(120.dp)
            .toggleable(value = selected, role = Role.Checkbox, onValueChange = { onClick() }),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.outlinedCardColors(
            containerColor = optionContainerColor(selected),
        ),
        border = if (selected) {
            BorderStroke(2.dp, MaterialTheme.colorScheme.primary)
        } else {
            CardDefaults.outlinedCardBorder()
        },
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(Spacing.md),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (icon != null) {
                    IconTile(icon = icon)
                }
                if (selected) {
                    SelectionMark(selected = true)
                }
            }

            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = if (selected) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurface
                },
                maxLines = 2,
            )
        }
    }
}

/** Small tinted square that carries the option icon. */
@Composable
private fun IconTile(icon: ImageVector) {
    Box(
        modifier = Modifier
            .size(40.dp)
            .background(
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                shape = MaterialTheme.shapes.medium,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(22.dp),
        )
    }
}

/** Blue-tinted fill that stays subtle in both light and dark themes. */
@Composable
private fun optionContainerColor(selected: Boolean) = if (selected) {
    MaterialTheme.colorScheme.primary.copy(alpha = 0.14f)
} else {
    MaterialTheme.colorScheme.surface
}

/** Blue check when selected, an empty ring when not. */
@Composable
private fun SelectionMark(selected: Boolean) {
    if (selected) {
        Box(
            modifier = Modifier
                .size(22.dp)
                .background(MaterialTheme.colorScheme.primary, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Outlined.Check,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier.size(14.dp),
            )
        }
    } else {
        Box(
            modifier = Modifier
                .size(22.dp)
                .border(1.5.dp, MaterialTheme.colorScheme.outline, CircleShape),
        )
    }
}

/** Icons used by the design's option cards. */
private fun iconFor(step: OnboardingStep, value: String): ImageVector? = when (step) {
    OnboardingStep.GOAL -> when (value) {
        "IMPROVE_ENGLISH" -> Icons.Outlined.Translate
        "INTERVIEW_PREPARATION" -> Icons.Outlined.WorkOutline
        "CAREER_SKILLS" -> Icons.AutoMirrored.Outlined.TrendingUp
        else -> Icons.Outlined.TrackChanges
    }

    OnboardingStep.PROFICIENCY -> null

    OnboardingStep.LANGUAGE -> when (value) {
        "ENGLISH" -> Icons.Outlined.Language
        else -> Icons.Outlined.Translate
    }

    OnboardingStep.DAILY_GOAL -> Icons.Outlined.Bolt

    OnboardingStep.INTERESTS -> when (value) {
        "english-speaking" -> Icons.Outlined.ChatBubbleOutline
        "interviews" -> Icons.Outlined.WorkOutline
        "workplace-communication" -> Icons.Outlined.BusinessCenter
        "money-basics" -> Icons.Outlined.Savings
        else -> Icons.Outlined.RocketLaunch
    }
}
