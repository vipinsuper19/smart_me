package com.smartme.app.feature.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material.icons.outlined.PlayCircle
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.Button
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smartme.app.R
import com.smartme.app.core.designsystem.component.EmptyState
import com.smartme.app.core.designsystem.component.ErrorState
import com.smartme.app.core.designsystem.component.LoadingState
import com.smartme.app.core.designsystem.theme.SmartMeTheme
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.DailyGoalDto
import com.smartme.app.core.network.GamificationSummaryDto
import com.smartme.app.core.network.LessonCardDto
import com.smartme.app.feature.learning.AccessTierBadge
import com.smartme.app.feature.learning.DifficultyLabel
import com.smartme.app.feature.learning.DurationLabel
import com.smartme.app.feature.learning.LearningProgressBar
import java.time.LocalTime

/**
 * Home dashboard from PRD §6.1: greeting, daily goal, streak, XP, continue
 * learning and a recommendation.
 *
 * The daily challenge card is intentionally absent until the backend exposes a
 * daily-challenge endpoint; showing a card with invented progress would be
 * worse than leaving it for that follow-up.
 */
@Composable
fun HomeScreen(
    userName: String,
    onOpenLesson: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LifecycleResumeEffect(Unit) {
        viewModel.onResumed()
        onPauseOrDispose { }
    }

    HomeContent(
        state = state,
        userName = userName,
        onRetry = viewModel::load,
        onOpenLesson = onOpenLesson,
        modifier = modifier,
    )
}

@Composable
internal fun HomeContent(
    state: UiState<HomeData>,
    userName: String,
    onRetry: () -> Unit,
    onOpenLesson: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    when (state) {
        is UiState.Loading -> LoadingState(modifier = modifier)

        is UiState.Empty -> EmptyState(
            title = stringResource(R.string.home_no_content_title),
            description = stringResource(R.string.home_no_content_body),
            modifier = modifier,
        )

        is UiState.Error -> ErrorState(
            title = stringResource(R.string.home_load_error_title),
            message = state.message,
            onRetry = onRetry,
            modifier = modifier,
        )

        is UiState.Content -> HomeDashboard(
            data = state.data,
            userName = userName,
            onOpenLesson = onOpenLesson,
            modifier = modifier,
        )
    }
}

@Composable
private fun HomeDashboard(
    data: HomeData,
    userName: String,
    onOpenLesson: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val greeting = remember { greetingResForHour(LocalTime.now().hour) }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(
            start = Spacing.screen,
            end = Spacing.screen,
            top = Spacing.xl,
            bottom = Spacing.xl,
        ),
        verticalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                Text(
                    text = if (userName.isBlank()) {
                        stringResource(greeting)
                    } else {
                        stringResource(
                            R.string.home_greeting_with_name,
                            stringResource(greeting),
                            userName,
                        )
                    },
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = stringResource(R.string.home_subtitle),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        item { DailyGoalCard(summary = data.summary) }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
                StreakCard(
                    streak = data.summary.currentStreak,
                    modifier = Modifier.weight(1f),
                )
                XpCard(summary = data.summary, modifier = Modifier.weight(1f))
            }
        }

        data.continueLearning?.let { item ->
            item {
                ContinueLearningCard(
                    item = item,
                    onClick = { onOpenLesson(item.lesson.id) },
                )
            }
        }

        data.recommended?.let { recommended ->
            item {
                RecommendedLessonCard(
                    lesson = recommended.lesson,
                    reason = recommended.reason,
                    onClick = { onOpenLesson(recommended.lesson.id) },
                )
            }
        }

        if (data.continueLearning == null && data.recommended == null) {
            item {
                EmptyState(
                    title = stringResource(R.string.home_no_content_title),
                    description = stringResource(R.string.home_no_content_body),
                )
            }
        }
    }
}

/** Maps the current hour to a greeting without touching the clock, so it is testable. */
internal fun greetingResForHour(hour: Int): Int = when {
    hour < 0 || hour > 23 -> R.string.home_greeting_day
    hour < 12 -> R.string.home_greeting_morning
    hour < 17 -> R.string.home_greeting_afternoon
    else -> R.string.home_greeting_evening
}

@Composable
private fun DailyGoalCard(summary: GamificationSummaryDto) {
    val goal = summary.dailyGoal ?: DailyGoalDto(
        date = "",
        minutesLearned = summary.minutesLearned,
    )

    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.outlinedCardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.home_goal_title),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = if (goal.met) {
                        stringResource(R.string.home_goal_met)
                    } else {
                        stringResource(
                            R.string.home_goal_remaining,
                            (goal.targetMinutes - goal.minutesLearned).coerceAtLeast(0),
                        )
                    },
                    style = MaterialTheme.typography.labelMedium,
                    color = if (goal.met) {
                        MaterialTheme.colorScheme.secondary
                    } else {
                        MaterialTheme.colorScheme.primary
                    },
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Text(
                text = stringResource(
                    R.string.home_goal_minutes,
                    goal.minutesLearned,
                    goal.targetMinutes,
                ),
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )
            LearningProgressBar(percent = goal.percent)
        }
    }
}

@Composable
private fun StreakCard(streak: Int, modifier: Modifier = Modifier) {
    OutlinedCard(
        modifier = modifier,
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.outlinedCardColors(
            containerColor = SmartMeTheme.colors.streakContainer,
        ),
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.xs),
        ) {
            Icon(
                imageVector = Icons.Outlined.LocalFireDepartment,
                contentDescription = null,
                tint = SmartMeTheme.colors.onStreakContainer,
                modifier = Modifier.size(22.dp),
            )
            Text(
                text = stringResource(R.string.home_streak_title),
                style = MaterialTheme.typography.labelMedium,
                color = SmartMeTheme.colors.onStreakContainer,
            )
            Text(
                text = if (streak == 1) {
                    stringResource(R.string.home_streak_one_day)
                } else {
                    stringResource(R.string.home_streak_days, streak)
                },
                style = MaterialTheme.typography.titleLarge,
                color = SmartMeTheme.colors.onStreakContainer,
            )
        }
    }
}

@Composable
private fun XpCard(summary: GamificationSummaryDto, modifier: Modifier = Modifier) {
    OutlinedCard(
        modifier = modifier,
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.outlinedCardColors(
            containerColor = SmartMeTheme.colors.xpContainer,
        ),
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.xs),
        ) {
            Icon(
                imageVector = Icons.Outlined.Star,
                contentDescription = null,
                tint = SmartMeTheme.colors.onXpContainer,
                modifier = Modifier.size(22.dp),
            )
            Text(
                text = stringResource(R.string.home_level, summary.level),
                style = MaterialTheme.typography.labelMedium,
                color = SmartMeTheme.colors.onXpContainer,
            )
            Text(
                text = "${summary.totalXp} XP",
                style = MaterialTheme.typography.titleLarge,
                color = SmartMeTheme.colors.onXpContainer,
            )
            Text(
                text = stringResource(
                    R.string.home_xp_to_next,
                    summary.levelProgress.xpToNextLevel,
                    summary.level + 1,
                ),
                style = MaterialTheme.typography.bodySmall,
                color = SmartMeTheme.colors.onXpContainer,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun ContinueLearningCard(
    item: com.smartme.app.core.network.ContinueLearningItemDto,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Outlined.PlayCircle,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                )
                Text(
                    text = stringResource(R.string.home_continue_title),
                    style = MaterialTheme.typography.labelMedium,
                )
            }
            Text(
                text = item.lesson.title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = "${item.learningPath.title} · ${item.lesson.module.title}",
                style = MaterialTheme.typography.bodySmall,
            )
            LearningProgressBar(percent = item.progress.progressPercent)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(
                        R.string.learning_progress_percent,
                        item.progress.progressPercent,
                    ),
                    style = MaterialTheme.typography.labelMedium,
                )
                Button(onClick = onClick, shape = MaterialTheme.shapes.medium) {
                    Text(text = stringResource(R.string.home_continue_action))
                    Spacer(modifier = Modifier.size(Spacing.xs))
                    Icon(
                        imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun RecommendedLessonCard(
    lesson: LessonCardDto,
    reason: String,
    onClick: () -> Unit,
) {
    OutlinedCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.outlinedCardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Text(
                text = stringResource(R.string.home_recommended_title),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            Text(
                text = lesson.title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = lesson.summary,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                AccessTierBadge(accessTier = lesson.effectiveAccessTier, locked = lesson.locked)
                DifficultyLabel(difficulty = lesson.difficulty)
                DurationLabel(minutes = lesson.estimatedMinutes)
            }
            Text(
                text = stringResource(recommendationReasonRes(reason)),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(onClick = onClick, shape = MaterialTheme.shapes.medium) {
                Text(text = stringResource(R.string.home_start_lesson))
                Spacer(modifier = Modifier.size(Spacing.xs))
                Icon(
                    imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
    }
}

private fun recommendationReasonRes(reason: String): Int = when (reason) {
    "PREFERENCE_MATCH" -> R.string.home_recommended_preference
    "PREMIUM_CONTENT" -> R.string.home_recommended_premium
    else -> R.string.home_recommended_first
}
