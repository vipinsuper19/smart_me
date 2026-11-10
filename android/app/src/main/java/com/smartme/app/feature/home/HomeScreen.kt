package com.smartme.app.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
import com.smartme.app.core.network.LearningPathDto
import com.smartme.app.feature.learning.LearningProgressBar
import com.smartme.app.feature.learning.PathIconTile

/**
 * Home dashboard, following the product mock: greeting and notification bell,
 * streak/XP tiles, the daily goal, a continue-learning card and a subject grid.
 *
 * The continue card falls back to the recommended lesson when the learner has
 * no lesson in progress, so the section is never empty for a new account.
 */
@Composable
fun HomeScreen(
    userName: String,
    onOpenLesson: (String) -> Unit,
    onOpenPath: (String) -> Unit,
    onSeeAllPaths: () -> Unit,
    onOpenNotifications: () -> Unit,
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
        onOpenPath = onOpenPath,
        onSeeAllPaths = onSeeAllPaths,
        onOpenNotifications = onOpenNotifications,
        modifier = modifier,
    )
}

@Composable
internal fun HomeContent(
    state: UiState<HomeData>,
    userName: String,
    onRetry: () -> Unit,
    onOpenLesson: (String) -> Unit,
    onOpenPath: (String) -> Unit,
    onSeeAllPaths: () -> Unit,
    onOpenNotifications: () -> Unit,
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
            onOpenPath = onOpenPath,
            onSeeAllPaths = onSeeAllPaths,
            onOpenNotifications = onOpenNotifications,
            modifier = modifier,
        )
    }
}

@Composable
private fun HomeDashboard(
    data: HomeData,
    userName: String,
    onOpenLesson: (String) -> Unit,
    onOpenPath: (String) -> Unit,
    onSeeAllPaths: () -> Unit,
    onOpenNotifications: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val continueCard = continueCardData(data)

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = Spacing.screen,
            end = Spacing.screen,
            top = Spacing.xl,
            bottom = Spacing.xl,
        ),
        verticalArrangement = Arrangement.spacedBy(Spacing.xl),
    ) {
        item { HomeHeader(userName = userName, onOpenNotifications = onOpenNotifications) }

        item { StatTiles(summary = data.summary) }

        data.summary.dailyGoal?.let { goal ->
            item { DailyGoalLine(goal = goal) }
        }

        if (continueCard != null) {
            item {
                ContinueLearningSection(
                    card = continueCard,
                    onClick = { onOpenLesson(continueCard.lessonId) },
                )
            }
        }

        if (data.paths.isNotEmpty()) {
            item {
                ExploreSubjectsSection(
                    paths = data.paths,
                    onOpenPath = onOpenPath,
                    onSeeAllPaths = onSeeAllPaths,
                )
            }
        }

        if (continueCard == null && data.paths.isEmpty()) {
            item {
                EmptyState(
                    title = stringResource(R.string.home_no_content_title),
                    description = stringResource(R.string.home_no_content_body),
                )
            }
        }
    }
}

@Composable
private fun HomeHeader(
    userName: String,
    onOpenNotifications: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top,
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.xs),
        ) {
            Text(
                text = if (userName.isBlank()) {
                    stringResource(R.string.home_hi)
                } else {
                    stringResource(R.string.home_hi_with_name, userName)
                },
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = stringResource(R.string.home_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        IconButton(onClick = onOpenNotifications) {
            Icon(
                imageVector = Icons.Outlined.NotificationsNone,
                contentDescription = stringResource(R.string.home_notifications_action),
                tint = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Composable
private fun StatTiles(summary: GamificationSummaryDto) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        StatTile(
            icon = Icons.Filled.LocalFireDepartment,
            value = summary.currentStreak.toString(),
            label = stringResource(R.string.home_day_streak),
            tint = SmartMeTheme.colors.streak,
            modifier = Modifier.weight(1f),
        )
        StatTile(
            icon = Icons.Filled.Star,
            value = summary.totalXp.toString(),
            label = stringResource(R.string.home_total_xp),
            tint = SmartMeTheme.colors.xp,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun StatTile(
    icon: ImageVector,
    value: String,
    label: String,
    tint: Color,
    modifier: Modifier = Modifier,
) {
    OutlinedCard(
        modifier = modifier,
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.outlinedCardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = Spacing.lg, vertical = Spacing.md),
            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(30.dp),
            )
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                Text(
                    text = value,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = label,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun DailyGoalLine(goal: DailyGoalDto) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
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
                fontWeight = FontWeight.SemiBold,
                color = if (goal.met) {
                    MaterialTheme.colorScheme.secondary
                } else {
                    MaterialTheme.colorScheme.primary
                },
            )
        }
        LearningProgressBar(percent = goal.percent)
    }
}

@Composable
private fun ContinueLearningSection(
    card: ContinueCardData,
    onClick: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
        SectionHeader(title = stringResource(R.string.home_continue_title))
        OutlinedCard(
            onClick = onClick,
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.large,
            colors = CardDefaults.outlinedCardColors(
                containerColor = MaterialTheme.colorScheme.surface,
            ),
        ) {
            Row(
                modifier = Modifier.padding(Spacing.lg),
                horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PathIconTile(slug = card.pathSlug, size = 56.dp, iconSize = 28.dp)
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(Spacing.xs),
                ) {
                    Text(
                        text = card.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = card.pathTitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Row(
                        modifier = Modifier.padding(top = Spacing.xs),
                        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        LearningProgressBar(
                            percent = card.progressPercent,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = stringResource(
                                R.string.home_continue_progress,
                                card.progressPercent,
                            ),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Icon(
                    imageVector = Icons.Outlined.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(24.dp),
                )
            }
        }
    }
}

@Composable
private fun ExploreSubjectsSection(
    paths: List<LearningPathDto>,
    onOpenPath: (String) -> Unit,
    onSeeAllPaths: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
        SectionHeader(
            title = stringResource(R.string.home_explore_subjects),
            action = stringResource(R.string.home_see_all),
            onAction = onSeeAllPaths,
        )
        paths.chunked(SUBJECT_COLUMNS).forEach { rowPaths ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(IntrinsicSize.Min),
                horizontalArrangement = Arrangement.spacedBy(Spacing.md),
            ) {
                rowPaths.forEach { path ->
                    SubjectCard(
                        path = path,
                        onClick = { onOpenPath(path.id) },
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight(),
                    )
                }
                repeat(SUBJECT_COLUMNS - rowPaths.size) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun SubjectCard(
    path: LearningPathDto,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedCard(
        onClick = onClick,
        modifier = modifier.heightIn(min = 108.dp),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.outlinedCardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.sm, vertical = Spacing.md),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            PathIconTile(slug = path.slug, size = 48.dp, iconSize = 26.dp)
            Text(
                text = path.title,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    action: String? = null,
    onAction: () -> Unit = {},
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
        )
        if (action != null) {
            TextButton(
                onClick = onAction,
                contentPadding = PaddingValues(horizontal = Spacing.sm),
            ) {
                Text(
                    text = action,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

private data class ContinueCardData(
    val lessonId: String,
    val title: String,
    val pathTitle: String,
    val pathSlug: String,
    val progressPercent: Int,
)

private fun continueCardData(data: HomeData): ContinueCardData? {
    data.continueLearning?.let { item ->
        return ContinueCardData(
            lessonId = item.lesson.id,
            title = item.lesson.title,
            pathTitle = item.learningPath.title,
            pathSlug = item.learningPath.slug,
            progressPercent = item.progress.progressPercent,
        )
    }
    data.recommended?.let { item ->
        return ContinueCardData(
            lessonId = item.lesson.id,
            title = item.lesson.title,
            pathTitle = item.learningPath.title,
            pathSlug = item.learningPath.slug,
            progressPercent = item.lesson.progress?.progressPercent ?: 0,
        )
    }
    return null
}

private const val SUBJECT_COLUMNS = 3
