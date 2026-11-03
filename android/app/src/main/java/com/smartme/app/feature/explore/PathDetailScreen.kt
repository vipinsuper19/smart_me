package com.smartme.app.feature.explore

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.School
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.smartme.app.R
import com.smartme.app.core.designsystem.component.ErrorState
import com.smartme.app.core.designsystem.component.LoadingState
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.CourseCardDto
import com.smartme.app.core.network.LearningPathDto
import com.smartme.app.feature.learning.AccessTierBadge
import com.smartme.app.feature.learning.DifficultyLabel
import com.smartme.app.feature.learning.DurationLabel
import com.smartme.app.feature.learning.LearningProgressBar
import com.smartme.app.feature.learning.LearningTopBar

@Composable
fun PathDetailScreen(
    onBack: () -> Unit,
    onOpenCourse: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: PathDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LifecycleResumeEffect(Unit) {
        viewModel.onResumed()
        onPauseOrDispose { }
    }

    PathDetailContent(
        state = state,
        onBack = onBack,
        onRetry = viewModel::load,
        onOpenCourse = onOpenCourse,
        modifier = modifier,
    )
}

@Composable
internal fun PathDetailContent(
    state: UiState<LearningPathDto>,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onOpenCourse: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize()) {
        LearningTopBar(
            title = (state as? UiState.Content)?.data?.title
                ?: stringResource(R.string.explore_paths_title),
            onBack = onBack,
        )

        when (state) {
            is UiState.Loading -> LoadingState(modifier = Modifier.weight(1f))

            is UiState.Empty -> ErrorState(
                title = stringResource(R.string.path_detail_error_title),
                message = stringResource(R.string.explore_empty_body),
                onRetry = onRetry,
                modifier = Modifier.weight(1f),
            )

            is UiState.Error -> ErrorState(
                title = stringResource(R.string.path_detail_error_title),
                message = state.message,
                onRetry = onRetry,
                modifier = Modifier.weight(1f),
            )

            is UiState.Content -> PathDetailBody(
                path = state.data,
                onOpenCourse = onOpenCourse,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun PathDetailBody(
    path: LearningPathDto,
    onOpenCourse: (String) -> Unit,
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
                if (path.coverImageUrl != null) {
                    AsyncImage(
                        model = path.coverImageUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(140.dp)
                            .clip(RoundedCornerShape(16.dp)),
                    )
                }
                Text(
                    text = path.title,
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = path.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    AccessTierBadge(
                        accessTier = if (path.hasPremiumContent) "PREMIUM" else "FREE",
                        locked = false,
                    )
                    Text(
                        text = stringResource(
                            R.string.explore_path_meta,
                            path.courseCount,
                            path.lessonCount,
                        ),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (path.progress.totalLessons > 0) {
                    LearningProgressBar(percent = path.progress.percent)
                    Text(
                        text = stringResource(
                            R.string.learning_progress_percent,
                            path.progress.percent,
                        ),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(
                    text = stringResource(R.string.path_detail_courses),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }

        if (path.courses.isEmpty()) {
            item {
                Text(
                    text = stringResource(R.string.course_detail_empty),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            items(items = path.courses, key = { it.id }) { course ->
                CourseCard(course = course, onClick = { onOpenCourse(course.id) })
            }
        }
    }
}

@Composable
private fun CourseCard(course: CourseCardDto, onClick: () -> Unit) {
    OutlinedCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.outlinedCardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
    ) {
        Row(
            modifier = Modifier.padding(Spacing.lg),
            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Outlined.School,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.size(24.dp),
                )
                if (course.coverImageUrl != null) {
                    AsyncImage(
                        model = course.coverImageUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
            }

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(Spacing.xs),
            ) {
                Text(
                    text = course.title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = course.shortDescription,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    AccessTierBadge(accessTier = course.accessTier, locked = course.locked)
                    DifficultyLabel(difficulty = course.difficulty)
                    DurationLabel(minutes = course.estimatedMinutes)
                }
                Text(
                    text = stringResource(R.string.learning_lessons_count, course.lessonCount),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (course.progress.totalLessons > 0) {
                    LearningProgressBar(percent = course.progress.percent)
                }
            }
        }
    }
}
