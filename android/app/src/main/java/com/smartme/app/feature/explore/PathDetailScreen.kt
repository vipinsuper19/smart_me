package com.smartme.app.feature.explore

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material.icons.outlined.Layers
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.PlayCircleOutline
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
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
import com.smartme.app.core.network.LearningPathDto
import com.smartme.app.feature.learning.LearningProgressBar
import com.smartme.app.feature.learning.PathIconTile
import kotlin.math.roundToInt

/**
 * Learning-path roadmap: a hero summary, a serpentine map of the path's courses
 * and a mastery banner. Course progress drives which level reads as completed,
 * current or locked, matching how the catalogue already gates content.
 */
@Composable
fun PathDetailScreen(
    onBack: () -> Unit,
    onOpenCourse: (String) -> Unit,
    onOpenAchievements: () -> Unit,
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
        onOpenAchievements = onOpenAchievements,
        modifier = modifier,
    )
}

@Composable
internal fun PathDetailContent(
    state: UiState<LearningPathDto>,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onOpenCourse: (String) -> Unit,
    onOpenAchievements: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize()) {
        PathDetailTopBar(
            title = (state as? UiState.Content)?.data?.title
                ?: stringResource(R.string.explore_paths_title),
            onBack = onBack,
            onOpenAchievements = onOpenAchievements,
            onRefresh = onRetry,
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
private fun PathDetailTopBar(
    title: String,
    onBack: () -> Unit,
    onOpenAchievements: () -> Unit,
    onRefresh: () -> Unit,
) {
    var menuExpanded by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.xs, vertical = Spacing.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onBack) {
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                contentDescription = stringResource(R.string.auth_back),
            )
        }
        Text(
            text = title,
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = Spacing.sm),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        IconButton(onClick = onOpenAchievements) {
            Icon(
                imageVector = Icons.Outlined.EmojiEvents,
                contentDescription = stringResource(R.string.path_detail_achievements),
                tint = MaterialTheme.colorScheme.onSurface,
            )
        }
        Box {
            IconButton(onClick = { menuExpanded = true }) {
                Icon(
                    imageVector = Icons.Outlined.MoreVert,
                    contentDescription = stringResource(R.string.path_detail_more_actions),
                    tint = MaterialTheme.colorScheme.onSurface,
                )
            }
            DropdownMenu(
                expanded = menuExpanded,
                onDismissRequest = { menuExpanded = false },
            ) {
                DropdownMenuItem(
                    text = { Text(text = stringResource(R.string.path_detail_refresh)) },
                    onClick = {
                        menuExpanded = false
                        onRefresh()
                    },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Outlined.Refresh,
                            contentDescription = null,
                        )
                    },
                )
            }
        }
    }
}

@Composable
private fun PathDetailBody(
    path: LearningPathDto,
    onOpenCourse: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val statuses = levelStatuses(path.courses)

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = Spacing.screen,
            end = Spacing.screen,
            top = Spacing.sm,
            bottom = Spacing.xl,
        ),
        verticalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        item { PathHero(path = path) }

        if (path.courses.isEmpty()) {
            item {
                Text(
                    text = stringResource(R.string.course_detail_empty),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            itemsIndexed(
                items = path.courses,
                key = { _, course -> course.id },
            ) { index, course ->
                Column {
                    LevelCard(
                        index = index,
                        course = course,
                        status = statuses[index],
                        alignedEnd = index % 2 == 1,
                        onOpenCourse = { onOpenCourse(course.id) },
                    )
                    if (index < path.courses.lastIndex) {
                        LevelConnector(
                            fromEnd = index % 2 == 1,
                            toEnd = (index + 1) % 2 == 1,
                        )
                    }
                }
            }
        }

        item {
            Box(modifier = Modifier.padding(top = Spacing.md)) {
                MasteryBanner(path = path)
            }
        }
    }
}

@Composable
private fun PathHero(path: LearningPathDto) {
    val scheme = MaterialTheme.colorScheme
    val levelCount = if (path.courses.isNotEmpty()) path.courses.size else path.courseCount
    val lessonCount = if (path.lessonCount > 0) {
        path.lessonCount
    } else {
        path.courses.sumOf { it.lessonCount }
    }
    val totalMinutes = path.courses.sumOf { it.estimatedMinutes }
    val minutesPerLesson = if (lessonCount > 0 && totalMinutes > 0) {
        (totalMinutes.toFloat() / lessonCount).roundToInt().coerceAtLeast(1)
    } else {
        5
    }
    val percent = if (path.progress.totalLessons > 0) path.progress.percent else 0

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        color = scheme.primaryContainer,
        contentColor = scheme.onPrimaryContainer,
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.lg),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PathIconTile(
                    slug = path.slug,
                    size = 52.dp,
                    iconSize = 28.dp,
                    containerColor = scheme.primary,
                    contentColor = scheme.onPrimary,
                )
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(Spacing.xs),
                ) {
                    Text(
                        text = path.title,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = scheme.onPrimaryContainer,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (path.description.isNotBlank()) {
                        Text(
                            text = path.description,
                            style = MaterialTheme.typography.bodySmall,
                            color = scheme.onPrimaryContainer.copy(alpha = 0.8f),
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(Spacing.xs),
                ) {
                    Box(
                        modifier = Modifier.size(68.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(
                            progress = { percent / 100f },
                            modifier = Modifier.fillMaxSize(),
                            color = scheme.primary,
                            trackColor = scheme.primary.copy(alpha = 0.18f),
                            strokeWidth = 7.dp,
                        )
                        Text(
                            text = "$percent%",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = scheme.onPrimaryContainer,
                        )
                    }
                    Text(
                        text = stringResource(R.string.path_detail_progress_label),
                        style = MaterialTheme.typography.labelSmall,
                        color = scheme.onPrimaryContainer.copy(alpha = 0.8f),
                    )
                }

                Spacer(modifier = Modifier.weight(1f))

                Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs + 2.dp)) {
                    HeroStat(
                        icon = Icons.Outlined.Layers,
                        text = pluralStringResource(
                            R.plurals.path_detail_levels_count,
                            levelCount,
                            levelCount,
                        ),
                    )
                    HeroStat(
                        icon = Icons.Outlined.PlayCircleOutline,
                        text = pluralStringResource(
                            R.plurals.path_detail_lessons_count,
                            lessonCount,
                            lessonCount,
                        ),
                    )
                    HeroStat(
                        icon = Icons.Outlined.Schedule,
                        text = stringResource(
                            R.string.path_detail_minutes_per_lesson,
                            minutesPerLesson,
                        ),
                    )
                }
            }
        }
    }
}

@Composable
private fun HeroStat(icon: ImageVector, text: String) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onPrimaryContainer,
            modifier = Modifier.size(16.dp),
        )
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onPrimaryContainer,
        )
    }
}

@Composable
private fun LevelCard(
    index: Int,
    course: CourseCardDto,
    status: LevelStatus,
    alignedEnd: Boolean,
    onOpenCourse: () -> Unit,
) {
    val scheme = MaterialTheme.colorScheme
    val isCurrent = status == LevelStatus.CURRENT
    val isLocked = status == LevelStatus.LOCKED

    val containerColor = if (isCurrent) scheme.primary else scheme.surface
    val contentColor = if (isCurrent) scheme.onPrimary else scheme.onSurface

    Box(modifier = Modifier.fillMaxWidth()) {
        Surface(
            onClick = onOpenCourse,
            enabled = !isLocked,
            modifier = Modifier
                .fillMaxWidth(if (isCurrent) 1f else 0.84f)
                .align(if (alignedEnd) Alignment.CenterEnd else Alignment.CenterStart),
            shape = RoundedCornerShape(20.dp),
            color = containerColor,
            contentColor = contentColor,
            shadowElevation = if (isCurrent) 6.dp else 1.dp,
            border = if (isCurrent) null else {
                BorderStroke(1.dp, scheme.outlineVariant)
            },
        ) {
            Row(
                modifier = Modifier.padding(
                    horizontal = Spacing.lg,
                    vertical = Spacing.md,
                ),
                horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                verticalAlignment = if (isCurrent) {
                    Alignment.CenterVertically
                } else {
                    Alignment.Top
                },
            ) {
                LevelNumber(index = index, status = status)

                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(Spacing.xs),
                ) {
                    Text(
                        text = course.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = contentColor,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (course.shortDescription.isNotBlank()) {
                        Text(
                            text = course.shortDescription,
                            style = MaterialTheme.typography.bodySmall,
                            color = if (isCurrent) {
                                scheme.onPrimary.copy(alpha = 0.85f)
                            } else {
                                scheme.onSurfaceVariant
                            },
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    if (isCurrent) {
                        Spacer(modifier = Modifier.height(Spacing.xs))
                        CurrentLevelProgress(
                            course = course,
                            onContinue = onOpenCourse,
                        )
                    }
                }

                if (!isCurrent) {
                    when (status) {
                        LevelStatus.COMPLETED -> Column(
                            horizontalAlignment = Alignment.End,
                            verticalArrangement = Arrangement.spacedBy(Spacing.xs + 2.dp),
                        ) {
                            StarRow()
                            StatusChip(
                                text = stringResource(R.string.learning_completed),
                                container = scheme.secondaryContainer,
                                content = scheme.onSecondaryContainer,
                                icon = Icons.Outlined.Check,
                            )
                        }

                        LevelStatus.LOCKED -> Column(
                            horizontalAlignment = Alignment.End,
                            verticalArrangement = Arrangement.spacedBy(Spacing.xs + 2.dp),
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Lock,
                                contentDescription = null,
                                tint = scheme.onSurfaceVariant,
                                modifier = Modifier.size(20.dp),
                            )
                            StatusChip(
                                text = stringResource(R.string.path_detail_locked),
                                container = scheme.surfaceVariant,
                                content = scheme.onSurfaceVariant,
                            )
                        }

                        LevelStatus.AVAILABLE -> StatusChip(
                            text = stringResource(R.string.path_detail_start),
                            container = scheme.primaryContainer,
                            content = scheme.onPrimaryContainer,
                        )

                        LevelStatus.CURRENT -> Unit
                    }
                }
            }
        }
    }
}

@Composable
private fun LevelNumber(index: Int, status: LevelStatus) {
    val scheme = MaterialTheme.colorScheme
    val container = when (status) {
        LevelStatus.CURRENT -> scheme.onPrimary.copy(alpha = 0.18f)
        LevelStatus.LOCKED -> scheme.surfaceVariant
        else -> scheme.primaryContainer
    }
    val content = when (status) {
        LevelStatus.CURRENT -> scheme.onPrimary
        LevelStatus.LOCKED -> scheme.onSurfaceVariant
        else -> scheme.primary
    }

    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(container),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "${index + 1}",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = content,
        )
    }
}

@Composable
private fun StarRow() {
    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        repeat(3) {
            Icon(
                imageVector = Icons.Filled.Star,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

@Composable
private fun StatusChip(
    text: String,
    container: Color,
    content: Color,
    icon: ImageVector? = null,
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(container)
            .padding(horizontal = Spacing.md, vertical = 3.dp),
        horizontalArrangement = Arrangement.spacedBy(Spacing.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = content,
                modifier = Modifier.size(12.dp),
            )
        }
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            color = content,
        )
    }
}

@Composable
private fun CurrentLevelProgress(
    course: CourseCardDto,
    onContinue: () -> Unit,
) {
    val scheme = MaterialTheme.colorScheme
    val total = if (course.progress.totalLessons > 0) {
        course.progress.totalLessons
    } else {
        course.lessonCount
    }
    val percent = course.progress.percent

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = pluralStringResource(
                    R.plurals.path_detail_lessons_ratio,
                    total,
                    course.progress.completedLessons,
                    total,
                ),
                style = MaterialTheme.typography.labelSmall,
                color = scheme.onPrimary.copy(alpha = 0.85f),
            )
            Text(
                text = "$percent%",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = scheme.onPrimary,
            )
        }
        LearningProgressBar(
            percent = percent,
            color = scheme.onPrimary,
            trackColor = scheme.onPrimary.copy(alpha = 0.25f),
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End,
        ) {
            Button(
                onClick = onContinue,
                shape = RoundedCornerShape(50),
                colors = ButtonDefaults.buttonColors(
                    containerColor = scheme.surface,
                    contentColor = scheme.primary,
                ),
                contentPadding = PaddingValues(
                    horizontal = Spacing.lg,
                    vertical = Spacing.xs,
                ),
            ) {
                Icon(
                    imageVector = Icons.Outlined.PlayArrow,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(modifier = Modifier.width(Spacing.xs))
                Text(
                    text = stringResource(R.string.path_detail_continue),
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
private fun LevelConnector(fromEnd: Boolean, toEnd: Boolean) {
    val scheme = MaterialTheme.colorScheme
    val lineColor = scheme.primary.copy(alpha = 0.30f)
    val dotFill = scheme.surface
    val dotStroke = scheme.primary.copy(alpha = 0.45f)

    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(44.dp),
    ) {
        val width = size.width
        val height = size.height
        val startX = if (fromEnd) width * 0.28f else width * 0.72f
        val endX = if (toEnd) width * 0.28f else width * 0.72f
        val startY = 6.dp.toPx()
        val endY = height - 6.dp.toPx()

        val path = Path().apply {
            moveTo(startX, startY)
            cubicTo(startX, height * 0.55f, endX, height * 0.45f, endX, endY)
        }
        drawPath(
            path = path,
            color = lineColor,
            style = Stroke(width = 9.dp.toPx(), cap = StrokeCap.Round),
        )

        val dotRadius = 6.dp.toPx()
        drawCircle(color = dotFill, radius = dotRadius, center = Offset(startX, startY))
        drawCircle(
            color = dotStroke,
            radius = dotRadius,
            center = Offset(startX, startY),
            style = Stroke(width = 3.dp.toPx()),
        )
        drawCircle(color = dotFill, radius = dotRadius, center = Offset(endX, endY))
        drawCircle(
            color = dotStroke,
            radius = dotRadius,
            center = Offset(endX, endY),
            style = Stroke(width = 3.dp.toPx()),
        )

        val midY = height / 2f
        val midX = (startX + endX) / 2f
        val direction = if (endX >= startX) 1f else -1f
        val chevronSize = 4.dp.toPx()
        val chevronStroke = 2.5.dp.toPx()
        for (offset in listOf(-7.dp.toPx(), 3.dp.toPx())) {
            val centerX = midX + offset
            val chevron = Path().apply {
                moveTo(centerX - chevronSize * direction, midY - chevronSize)
                lineTo(centerX + chevronSize * direction, midY)
                lineTo(centerX - chevronSize * direction, midY + chevronSize)
            }
            drawPath(
                path = chevron,
                color = lineColor,
                style = Stroke(width = chevronStroke, cap = StrokeCap.Round),
            )
        }
    }
}

@Composable
private fun MasteryBanner(path: LearningPathDto) {
    val scheme = MaterialTheme.colorScheme
    val levelCount = if (path.courses.isNotEmpty()) path.courses.size else path.courseCount

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = scheme.primaryContainer,
        contentColor = scheme.onPrimaryContainer,
    ) {
        Row(
            modifier = Modifier.padding(Spacing.lg),
            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Outlined.EmojiEvents,
                contentDescription = null,
                tint = scheme.primary,
                modifier = Modifier.size(34.dp),
            )
            Box(
                modifier = Modifier
                    .width(1.dp)
                    .height(40.dp)
                    .background(scheme.primary.copy(alpha = 0.25f)),
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = pluralStringResource(
                        R.plurals.path_detail_mastery_title,
                        levelCount,
                        levelCount,
                    ),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = scheme.primary,
                )
                Text(
                    text = stringResource(R.string.path_detail_mastery_body, path.title),
                    style = MaterialTheme.typography.bodySmall,
                    color = scheme.onPrimaryContainer,
                )
            }
            Icon(
                imageVector = Icons.Filled.Star,
                contentDescription = null,
                tint = scheme.primary,
                modifier = Modifier.size(26.dp),
            )
        }
    }
}

private enum class LevelStatus { COMPLETED, CURRENT, LOCKED, AVAILABLE }

private fun levelStatuses(courses: List<CourseCardDto>): List<LevelStatus> {
    val currentIndex = courses.indexOfFirst { !it.isCompleted() && !it.locked }
    return courses.mapIndexed { index, course ->
        when {
            course.locked -> LevelStatus.LOCKED
            course.isCompleted() -> LevelStatus.COMPLETED
            index == currentIndex -> LevelStatus.CURRENT
            else -> LevelStatus.AVAILABLE
        }
    }
}

private fun CourseCardDto.isCompleted(): Boolean =
    progress.totalLessons > 0 && progress.completedLessons >= progress.totalLessons
