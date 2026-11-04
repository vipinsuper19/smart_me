package com.smartme.app.feature.progress

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material.icons.outlined.Quiz
import androidx.compose.material.icons.outlined.School
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smartme.app.R
import com.smartme.app.core.designsystem.component.EmptyState
import com.smartme.app.core.designsystem.component.ErrorState
import com.smartme.app.core.designsystem.component.LoadingState
import com.smartme.app.core.designsystem.theme.SmartMeTheme
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.AchievementDto
import com.smartme.app.core.network.AchievementsDto
import com.smartme.app.core.util.formatIsoDate
import com.smartme.app.feature.learning.LearningProgressBar
import com.smartme.app.feature.learning.LearningTopBar

@Composable
fun AchievementsScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: AchievementsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    Column(modifier = modifier.fillMaxSize()) {
        LearningTopBar(
            title = stringResource(R.string.achievements_title),
            onBack = onBack,
        )
        AchievementsContent(
            state = state,
            onRetry = viewModel::load,
        )
    }
}

@Composable
internal fun AchievementsContent(
    state: UiState<AchievementsDto>,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    when (state) {
        is UiState.Loading -> LoadingState(modifier = modifier)

        is UiState.Empty -> EmptyState(
            title = stringResource(R.string.achievements_empty_title),
            description = stringResource(R.string.achievements_empty_body),
            icon = Icons.Outlined.EmojiEvents,
            modifier = modifier,
        )

        is UiState.Error -> ErrorState(
            title = stringResource(R.string.achievements_load_error_title),
            message = state.message,
            onRetry = onRetry,
            modifier = modifier,
        )

        is UiState.Content -> AchievementList(
            achievements = state.data,
            modifier = modifier,
        )
    }
}

@Composable
private fun AchievementList(
    achievements: AchievementsDto,
    modifier: Modifier = Modifier,
) {
    val percent = if (achievements.totalCount == 0) {
        0
    } else {
        achievements.earnedCount * 100 / achievements.totalCount
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = Spacing.screen,
            end = Spacing.screen,
            top = Spacing.md,
            bottom = Spacing.xl,
        ),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
                color = SmartMeTheme.colors.xpContainer,
                contentColor = SmartMeTheme.colors.onXpContainer,
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
                            imageVector = Icons.Outlined.EmojiEvents,
                            contentDescription = null,
                            modifier = Modifier.size(24.dp),
                        )
                        Text(
                            text = stringResource(
                                R.string.achievements_summary,
                                achievements.earnedCount,
                                achievements.totalCount,
                            ),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    LearningProgressBar(percent = percent)
                }
            }
        }

        items(achievements.items, key = { it.code }) { achievement ->
            AchievementCard(achievement)
        }
    }
}

@Composable
private fun AchievementCard(achievement: AchievementDto) {
    val accent = if (achievement.earned) {
        SmartMeTheme.colors.xp
    } else {
        MaterialTheme.colorScheme.onSurfaceVariant
    }

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
                horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Surface(
                    shape = CircleShape,
                    color = if (achievement.earned) {
                        SmartMeTheme.colors.xpContainer
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    },
                    modifier = Modifier.size(44.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = achievementIcon(achievement.code),
                            contentDescription = null,
                            tint = accent,
                            modifier = Modifier.size(22.dp),
                        )
                    }
                }

                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(Spacing.xs),
                ) {
                    Text(
                        text = achievement.title,
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    achievement.description?.let { description ->
                        Text(
                            text = description,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                Surface(
                    shape = MaterialTheme.shapes.small,
                    color = if (achievement.earned) {
                        SmartMeTheme.colors.successContainer
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    },
                    contentColor = if (achievement.earned) {
                        SmartMeTheme.colors.onSuccessContainer
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                ) {
                    Text(
                        text = stringResource(
                            if (achievement.earned) {
                                R.string.achievements_earned
                            } else {
                                R.string.achievements_locked
                            },
                        ),
                        modifier = Modifier.padding(horizontal = Spacing.sm, vertical = Spacing.xs),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            if (!achievement.earned) {
                achievement.progress?.let { progress ->
                    if (progress.targetValue > 0) {
                        LearningProgressBar(percent = progress.percent)
                        Text(
                            text = stringResource(
                                R.string.achievements_progress,
                                progress.currentValue.coerceAtMost(progress.targetValue),
                                progress.targetValue,
                            ),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (achievement.earned) {
                    Text(
                        text = formatIsoDate(achievement.earnedAt)?.let { date ->
                            stringResource(R.string.achievements_earned_on, date)
                        }.orEmpty(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    Text(
                        text = stringResource(R.string.achievements_keep_going),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                if (achievement.xpReward > 0) {
                    Text(
                        text = stringResource(R.string.achievements_reward, achievement.xpReward),
                        style = MaterialTheme.typography.labelMedium,
                        color = accent,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}

private fun achievementIcon(code: String): ImageVector = when (code) {
    "FIRST_LESSON" -> Icons.Outlined.School
    "FIRST_QUIZ" -> Icons.Outlined.Quiz
    "STREAK_3", "STREAK_7" -> Icons.Outlined.LocalFireDepartment
    "LESSONS_10" -> Icons.AutoMirrored.Outlined.MenuBook
    "DAILY_GOAL_ACHIEVED" -> Icons.Outlined.Flag
    else -> Icons.Outlined.EmojiEvents
}
