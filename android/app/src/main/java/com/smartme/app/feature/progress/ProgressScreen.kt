package com.smartme.app.feature.progress

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material.icons.outlined.Quiz
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
import com.smartme.app.core.network.ProgressOverviewDto
import com.smartme.app.core.network.WeeklyDayDto
import com.smartme.app.core.network.WeeklyProgressDto
import com.smartme.app.feature.learning.LearningProgressBar

@Composable
fun ProgressScreen(
    onOpenAchievements: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ProgressViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LifecycleResumeEffect(Unit) {
        viewModel.onResumed()
        onPauseOrDispose { }
    }

    ProgressContent(
        state = state,
        onRetry = viewModel::load,
        onOpenAchievements = onOpenAchievements,
        modifier = modifier,
    )
}

@Composable
internal fun ProgressContent(
    state: UiState<ProgressData>,
    onRetry: () -> Unit,
    onOpenAchievements: () -> Unit,
    modifier: Modifier = Modifier,
) {
    when (state) {
        is UiState.Loading -> LoadingState(modifier = modifier)

        is UiState.Empty -> EmptyState(
            title = stringResource(R.string.progress_empty_title),
            description = stringResource(R.string.progress_empty_body),
            icon = Icons.AutoMirrored.Outlined.MenuBook,
            modifier = modifier,
        )

        is UiState.Error -> ErrorState(
            title = stringResource(R.string.progress_load_error_title),
            message = state.message,
            onRetry = onRetry,
            modifier = modifier,
        )

        is UiState.Content -> ProgressDashboard(
            data = state.data,
            achievements = state.data.achievements,
            onOpenAchievements = onOpenAchievements,
            modifier = modifier,
        )
    }
}

@Composable
private fun ProgressDashboard(
    data: ProgressData,
    achievements: com.smartme.app.core.network.AchievementsDto?,
    onOpenAchievements: () -> Unit,
    modifier: Modifier = Modifier,
) {
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
                    text = stringResource(R.string.progress_title),
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = stringResource(R.string.progress_subtitle),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        item { LevelCard(overview = data.overview) }
        data.overview.dailyGoal?.let { goal -> item { DailyGoalCard(goal) } }
        item { WeeklyCard(weekly = data.weekly) }
        item { StatsCard(overview = data.overview) }
        item { AchievementsEntryCard(achievements = achievements, onClick = onOpenAchievements) }
        item { TopicsSection(overview = data.overview) }
    }
}

@Composable
private fun LevelCard(overview: ProgressOverviewDto) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
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
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                    Text(
                        text = stringResource(R.string.home_level, overview.level),
                        style = MaterialTheme.typography.labelMedium,
                    )
                    Text(
                        text = "${overview.totalXp} XP",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(Spacing.xs),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.LocalFireDepartment,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                        )
                        Text(
                            text = if (overview.currentStreak == 1) {
                                stringResource(R.string.home_streak_one_day)
                            } else {
                                stringResource(R.string.home_streak_days, overview.currentStreak)
                            },
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    Text(
                        text = pluralStringResource(
                            R.plurals.progress_longest_streak,
                            overview.longestStreak,
                            overview.longestStreak,
                        ),
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
            }

            LinearLevelProgress(percent = overview.levelProgress.progressPercent)

            Text(
                text = stringResource(
                    R.string.progress_level_progress,
                    overview.levelProgress.progressPercent,
                    overview.level + 1,
                ),
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                text = stringResource(
                    R.string.home_xp_to_next,
                    overview.levelProgress.xpToNextLevel,
                    overview.level + 1,
                ),
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}

@Composable
private fun LinearLevelProgress(percent: Int) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(8.dp)
            .background(
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.18f),
                shape = RoundedCornerShape(6.dp),
            ),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth((percent.coerceIn(0, 100) / 100f))
                .height(8.dp)
                .background(
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    shape = RoundedCornerShape(6.dp),
                ),
        )
    }
}

@Composable
private fun DailyGoalCard(goal: DailyGoalDto) {
    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.surface),
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
private fun WeeklyCard(weekly: WeeklyProgressDto) {
    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                    Text(
                        text = stringResource(R.string.progress_weekly_title),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = pluralStringResource(
                            R.plurals.progress_weekly_totals,
                            weekly.totals.lessonsCompleted,
                            weekly.totals.lessonsCompleted,
                            weekly.totals.minutesLearned,
                        ),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    text = pluralStringResource(
                        R.plurals.progress_weekly_goal_days,
                        weekly.totals.goalDays,
                        weekly.totals.goalDays,
                    ),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.secondary,
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                verticalAlignment = Alignment.Bottom,
            ) {
                weekly.days.forEach { day ->
                    WeeklyBar(day = day, days = weekly.days, modifier = Modifier.weight(1f))
                }
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .background(MaterialTheme.colorScheme.secondary, RoundedCornerShape(6.dp)),
                )
                Text(
                    text = stringResource(R.string.progress_weekly_legend),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun WeeklyBar(
    day: WeeklyDayDto,
    days: List<WeeklyDayDto>,
    modifier: Modifier = Modifier,
) {
    val fraction = weeklyBarFraction(day.minutesLearned, days)
    val barColor = if (day.goalMet) {
        MaterialTheme.colorScheme.secondary
    } else {
        MaterialTheme.colorScheme.primary
    }

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.xs),
    ) {
        Text(
            text = stringResource(R.string.progress_weekly_minutes, day.minutesLearned),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            textAlign = TextAlign.Center,
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(72.dp),
            contentAlignment = Alignment.BottomCenter,
        ) {
            Box(
                modifier = Modifier
                    .width(18.dp)
                    .height((72f * fraction).coerceAtLeast(3f).dp)
                    .background(barColor, RoundedCornerShape(6.dp)),
            )
        }
        Text(
            text = weekdayInitial(day.date),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurface,
            fontWeight = FontWeight.Medium,
        )
        Box(
            modifier = Modifier
                .size(4.dp)
                .background(
                    color = if (day.goalMet) {
                        MaterialTheme.colorScheme.secondary
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    },
                    shape = RoundedCornerShape(6.dp),
                ),
        )
    }
}

@Composable
private fun StatsCard(overview: ProgressOverviewDto) {
    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            Text(
                text = stringResource(R.string.progress_stats_title),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                StatTile(
                    icon = Icons.AutoMirrored.Outlined.MenuBook,
                    value = overview.lessonsCompleted.toString(),
                    label = stringResource(R.string.progress_stat_lessons),
                    modifier = Modifier.weight(1f),
                )
                StatTile(
                    icon = Icons.Outlined.Quiz,
                    value = overview.quizzesCompleted.toString(),
                    label = stringResource(R.string.progress_stat_quizzes),
                    modifier = Modifier.weight(1f),
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                StatTile(
                    icon = Icons.Outlined.Schedule,
                    value = overview.minutesLearned.toString(),
                    label = stringResource(R.string.progress_stat_minutes),
                    modifier = Modifier.weight(1f),
                )
                StatTile(
                    icon = Icons.Outlined.Star,
                    value = overview.lessonsStarted.toString(),
                    label = stringResource(R.string.progress_stat_started),
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun StatTile(
    icon: ImageVector,
    value: String,
    label: String,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.surfaceVariant,
    ) {
        Column(
            modifier = Modifier.padding(Spacing.md),
            verticalArrangement = Arrangement.spacedBy(Spacing.xs),
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(18.dp),
            )
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun AchievementsEntryCard(
    achievements: com.smartme.app.core.network.AchievementsDto?,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        shape = MaterialTheme.shapes.large,
        color = SmartMeTheme.colors.xpContainer,
        contentColor = SmartMeTheme.colors.onXpContainer,
    ) {
        Row(
            modifier = Modifier.padding(Spacing.lg),
            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Outlined.EmojiEvents,
                contentDescription = null,
                modifier = Modifier.size(28.dp),
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(Spacing.xs),
            ) {
                Text(
                    text = stringResource(R.string.progress_achievements_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = if (achievements != null) {
                        stringResource(
                            R.string.progress_achievements_body,
                            achievements.earnedCount,
                            achievements.totalCount,
                        )
                    } else {
                        stringResource(R.string.progress_achievements_body_unknown)
                    },
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

@Composable
private fun TopicsSection(overview: ProgressOverviewDto) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
        Text(
            text = stringResource(R.string.progress_topics_title),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        if (overview.topics.isEmpty()) {
            OutlinedCard(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
                colors = CardDefaults.outlinedCardColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                ),
            ) {
                Text(
                    text = stringResource(R.string.progress_topics_empty),
                    modifier = Modifier.padding(Spacing.lg),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            overview.topics.forEach { topic ->
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
                                text = topic.title,
                                modifier = Modifier.weight(1f),
                                style = MaterialTheme.typography.titleSmall,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Text(
                                text = stringResource(
                                    R.string.learning_progress_percent,
                                    topic.percent,
                                ),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        LearningProgressBar(percent = topic.percent)
                        Text(
                            text = stringResource(
                                R.string.progress_topic_lessons,
                                topic.completedLessons,
                                topic.totalLessons,
                            ),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}
