package com.smartme.app.feature.explore

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
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Quiz
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smartme.app.R
import com.smartme.app.core.designsystem.component.ErrorState
import com.smartme.app.core.designsystem.component.LoadingState
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.CourseCardDto
import com.smartme.app.core.network.LessonCardDto
import com.smartme.app.core.network.ModuleDto
import com.smartme.app.feature.learning.AccessTierBadge
import com.smartme.app.feature.learning.DifficultyLabel
import com.smartme.app.feature.learning.DurationLabel
import com.smartme.app.feature.learning.LearningProgressBar
import com.smartme.app.feature.learning.LearningTopBar
import com.smartme.app.feature.learning.PremiumRequiredDialog

@Composable
fun CourseDetailScreen(
    onBack: () -> Unit,
    onOpenLesson: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: CourseDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LifecycleResumeEffect(Unit) {
        viewModel.onResumed()
        onPauseOrDispose { }
    }

    CourseDetailContent(
        state = state,
        onBack = onBack,
        onRetry = viewModel::load,
        onOpenLesson = onOpenLesson,
        modifier = modifier,
    )
}

@Composable
internal fun CourseDetailContent(
    state: UiState<CourseCardDto>,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onOpenLesson: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var premiumDialogVisible by remember { mutableStateOf(false) }

    if (premiumDialogVisible) {
        PremiumRequiredDialog(onDismiss = { premiumDialogVisible = false })
    }

    Column(modifier = modifier.fillMaxSize()) {
        LearningTopBar(
            title = (state as? UiState.Content)?.data?.title
                ?: stringResource(R.string.course_detail_contents),
            onBack = onBack,
        )

        when (state) {
            is UiState.Loading -> LoadingState(modifier = Modifier.weight(1f))

            is UiState.Empty -> ErrorState(
                title = stringResource(R.string.course_detail_error_title),
                message = stringResource(R.string.course_detail_empty),
                onRetry = onRetry,
                modifier = Modifier.weight(1f),
            )

            is UiState.Error -> ErrorState(
                title = stringResource(R.string.course_detail_error_title),
                message = state.message,
                onRetry = onRetry,
                modifier = Modifier.weight(1f),
            )

            is UiState.Content -> CourseDetailBody(
                course = state.data,
                onOpenLesson = { lesson ->
                    if (lesson.locked) premiumDialogVisible = true else onOpenLesson(lesson.id)
                },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun CourseDetailBody(
    course: CourseCardDto,
    onOpenLesson: (LessonCardDto) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(
            start = Spacing.screen,
            end = Spacing.screen,
            top = Spacing.sm,
            bottom = Spacing.xl,
        ),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                Text(
                    text = course.title,
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = course.shortDescription,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    AccessTierBadge(accessTier = course.accessTier, locked = course.locked)
                    DifficultyLabel(difficulty = course.difficulty)
                    DurationLabel(minutes = course.estimatedMinutes)
                    Text(
                        text = pluralStringResource(
                            R.plurals.learning_lessons_count,
                            course.lessonCount,
                            course.lessonCount,
                        ),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (course.progress.totalLessons > 0) {
                    LearningProgressBar(percent = course.progress.percent)
                    Text(
                        text = stringResource(
                            R.string.learning_progress_percent,
                            course.progress.percent,
                        ),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (course.objectives.isNotEmpty()) {
                    Text(
                        text = stringResource(R.string.course_detail_objectives),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    course.objectives.forEach { objective ->
                        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                            Text(
                                text = "•",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.primary,
                            )
                            Text(
                                text = objective,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                Text(
                    text = stringResource(R.string.course_detail_contents),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }

        if (course.modules.isEmpty()) {
            item {
                Text(
                    text = stringResource(R.string.course_detail_empty),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(items = course.modules, key = { it.id }) { module ->
                ModuleCard(module = module, onOpenLesson = onOpenLesson)
            }
        }

        if (course.prerequisites.isNotEmpty()) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                    Text(
                        text = stringResource(R.string.course_detail_prerequisites),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    course.prerequisites.forEach { prerequisite ->
                        Text(
                            text = prerequisite.title,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ModuleCard(module: ModuleDto, onOpenLesson: (LessonCardDto) -> Unit) {
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
            Text(
                text = module.title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            )
            if (module.description != null) {
                Text(
                    text = module.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (module.estimatedMinutes != null) {
                DurationLabel(minutes = module.estimatedMinutes)
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            module.lessons.forEach { lesson ->
                LessonRow(lesson = lesson, onClick = { onOpenLesson(lesson) })
            }
        }
    }
}

@Composable
private fun LessonRow(lesson: LessonCardDto, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = Spacing.sm),
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val completed = lesson.progress?.isCompleted == true
        Icon(
            imageVector = when {
                lesson.locked -> Icons.Outlined.Lock
                completed -> Icons.Outlined.CheckCircle
                else -> Icons.Outlined.PlayArrow
            },
            contentDescription = null,
            tint = when {
                lesson.locked -> MaterialTheme.colorScheme.onSurfaceVariant
                completed -> MaterialTheme.colorScheme.secondary
                else -> MaterialTheme.colorScheme.primary
            },
            modifier = Modifier.size(22.dp),
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = lesson.title,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                DurationLabel(minutes = lesson.estimatedMinutes)
                if (lesson.requiresQuiz && !completed) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(Spacing.xs),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Quiz,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = stringResource(R.string.learning_quiz_required),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                if (completed) {
                    Text(
                        text = stringResource(R.string.learning_completed),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.secondary,
                    )
                } else if (lesson.progress != null) {
                    Text(
                        text = stringResource(R.string.learning_in_progress),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                if (lesson.locked) {
                    AccessTierBadge(
                        accessTier = lesson.effectiveAccessTier,
                        locked = true,
                    )
                }
            }
        }
    }
}
