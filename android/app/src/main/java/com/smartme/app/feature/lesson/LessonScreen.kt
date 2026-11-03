package com.smartme.app.feature.lesson

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Quiz
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smartme.app.R
import com.smartme.app.core.designsystem.component.EmptyState
import com.smartme.app.core.designsystem.component.ErrorState
import com.smartme.app.core.designsystem.component.LoadingState
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.LessonCompletionDto
import com.smartme.app.core.network.LessonDetailDto
import com.smartme.app.core.network.LessonProgressDto
import com.smartme.app.core.network.NextLessonDto
import com.smartme.app.feature.common.asString
import com.smartme.app.feature.learning.AccessTierBadge
import com.smartme.app.feature.learning.DifficultyLabel
import com.smartme.app.feature.learning.DurationLabel
import com.smartme.app.feature.learning.LearningProgressBar
import com.smartme.app.feature.learning.LearningTopBar
import com.smartme.app.feature.learning.LessonStatusLabel
import kotlinx.coroutines.flow.distinctUntilChanged

private const val HEADER_ITEMS = 1

/**
 * Lesson player from PRD §6.2: structured blocks, media, progress restoration
 * and completion. Quiz-gated lessons route to the quiz instead of completing.
 */
@Composable
fun LessonScreen(
    onBack: () -> Unit,
    onOpenQuiz: (String) -> Unit,
    onOpenLesson: (String) -> Unit,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: LessonViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LifecycleResumeEffect(Unit) {
        viewModel.onResumed()
        onPauseOrDispose { viewModel.flushProgress() }
    }

    LessonContent(
        state = state,
        onBack = onBack,
        onRetry = viewModel::load,
        onScrollChanged = viewModel::onScrollChanged,
        onComplete = viewModel::complete,
        onDismissCompletion = viewModel::dismissCompletion,
        onOpenQuiz = onOpenQuiz,
        onOpenLesson = onOpenLesson,
        onDone = onDone,
        onMessageShown = viewModel::onMessageShown,
        onSaveErrorShown = viewModel::onSaveErrorShown,
        modifier = modifier,
    )
}

@Composable
internal fun LessonContent(
    state: LessonUiState,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onScrollChanged: (blockOrder: Int, progressPercent: Int) -> Unit,
    onComplete: () -> Unit,
    onDismissCompletion: () -> Unit,
    onOpenQuiz: (String) -> Unit,
    onOpenLesson: (String) -> Unit,
    onDone: () -> Unit,
    modifier: Modifier = Modifier,
    onMessageShown: () -> Unit = {},
    onSaveErrorShown: () -> Unit = {},
) {
    val snackbarHostState = remember { SnackbarHostState() }
    val messageText = state.message?.asString()

    LaunchedEffect(messageText) {
        if (messageText != null) {
            snackbarHostState.showSnackbar(messageText)
            onMessageShown()
        }
    }

    state.completion?.let { completion ->
        LessonCompletionDialog(
            completion = completion,
            nextLesson = state.lesson?.nextLesson,
            onNext = {
                val next = state.lesson?.nextLesson
                onDismissCompletion()
                if (next != null) onOpenLesson(next.id) else onDone()
            },
            onDone = {
                onDismissCompletion()
                onDone()
            },
        )
    }

    Box(modifier = modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            LearningTopBar(
                title = state.lesson?.title ?: stringResource(R.string.lesson_title),
                onBack = onBack,
            )

            if (state.saveFailed) {
                SaveFailureBanner(onDismiss = onSaveErrorShown)
            }

            when (val content = state.content) {
                is UiState.Loading -> LoadingState(modifier = Modifier.weight(1f))

                is UiState.Empty -> EmptyState(
                    title = stringResource(R.string.home_no_content_title),
                    description = stringResource(R.string.home_no_content_body),
                    modifier = Modifier.weight(1f),
                )

                is UiState.Error -> ErrorState(
                    title = stringResource(R.string.lesson_error_title),
                    message = content.message,
                    onRetry = onRetry,
                    modifier = Modifier.weight(1f),
                )

                is UiState.Content -> LessonBody(
                    lesson = content.data,
                    completing = state.completing,
                    isCompleted = state.isCompleted,
                    onScrollChanged = onScrollChanged,
                    onComplete = onComplete,
                    onOpenQuiz = { onOpenQuiz(content.data.id) },
                    onOpenNext = content.data.nextLesson?.let { next ->
                        { onOpenLesson(next.id) }
                    },
                    modifier = Modifier.weight(1f),
                )
            }
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(Spacing.lg),
        )
    }
}

@Composable
private fun LessonBody(
    lesson: LessonDetailDto,
    completing: Boolean,
    isCompleted: Boolean,
    onScrollChanged: (blockOrder: Int, progressPercent: Int) -> Unit,
    onComplete: () -> Unit,
    onOpenQuiz: () -> Unit,
    onOpenNext: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val resumeIndex = remember(lesson.id, lesson.progress?.lastBlockOrder) {
        resumeBlockIndex(lesson.blocks, lesson.progress?.lastBlockOrder)
    }
    val listState = rememberLazyListState(
        initialFirstVisibleItemIndex = resumeIndex + HEADER_ITEMS,
    )

    LaunchedEffect(listState, lesson.id, lesson.blocks.size) {
        if (lesson.blocks.isEmpty()) return@LaunchedEffect
        snapshotFlow { listState.firstVisibleItemIndex }
            .distinctUntilChanged()
            .collect { firstVisible ->
                val index = (firstVisible - HEADER_ITEMS).coerceIn(0, lesson.blocks.lastIndex)
                val block = lesson.blocks[index]
                onScrollChanged(
                    block.order,
                    scrollProgressPercent(index, lesson.blocks.size),
                )
            }
    }

    LazyColumn(
        state = listState,
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(
            start = Spacing.screen,
            end = Spacing.screen,
            top = Spacing.sm,
            bottom = Spacing.xl,
        ),
        verticalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        item(key = "hero") {
            LessonHero(lesson = lesson, isCompleted = isCompleted)
        }

        items(items = lesson.blocks, key = { it.id }) { block ->
            LessonBlockContent(block = block)
        }

        item(key = "footer") {
            LessonFooter(
                lesson = lesson,
                completing = completing,
                isCompleted = isCompleted,
                onComplete = onComplete,
                onOpenQuiz = onOpenQuiz,
                onOpenNext = onOpenNext,
            )
        }
    }
}

@Composable
private fun LessonHero(lesson: LessonDetailDto, isCompleted: Boolean) {
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
                text = "${lesson.course.title} · ${lesson.module.title}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = lesson.title,
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = lesson.objective,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                AccessTierBadge(
                    accessTier = lesson.effectiveAccessTier,
                    locked = false,
                )
                DifficultyLabel(difficulty = lesson.difficulty)
                DurationLabel(minutes = lesson.estimatedMinutes)
                if (isCompleted) {
                    LessonStatusLabel(
                        progress = LessonProgressDto(
                            lessonId = lesson.id,
                            status = "COMPLETED",
                            progressPercent = 100,
                        ),
                    )
                }
            }
            if (!isCompleted && (lesson.progress?.progressPercent ?: 0) > 0) {
                lesson.progress?.let { progress ->
                    LearningProgressBar(percent = progress.progressPercent)
                    Text(
                        text = stringResource(R.string.lesson_resume),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun LessonFooter(
    lesson: LessonDetailDto,
    completing: Boolean,
    isCompleted: Boolean,
    onComplete: () -> Unit,
    onOpenQuiz: () -> Unit,
    onOpenNext: (() -> Unit)?,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        when {
            isCompleted -> {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.CheckCircle,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.secondary,
                        modifier = Modifier.size(22.dp),
                    )
                    Text(
                        text = stringResource(R.string.lesson_completed_title),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.secondary,
                    )
                }
                if (onOpenNext != null) {
                    PrimaryAction(
                        label = stringResource(R.string.lesson_next_lesson),
                        onClick = onOpenNext,
                    )
                }
            }

            lesson.requiresQuiz && lesson.quiz?.passed != true -> {
                val quiz = lesson.quiz
                Text(
                    text = stringResource(R.string.lesson_quiz_required_message),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                PrimaryAction(
                    label = stringResource(R.string.lesson_take_quiz),
                    onClick = onOpenQuiz,
                    icon = { QuizIcon() },
                    enabled = quiz != null,
                )
            }

            else -> {
                if (lesson.quiz?.passed == true) {
                    Text(
                        text = stringResource(R.string.lesson_quiz_passed),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.secondary,
                    )
                }
                PrimaryAction(
                    label = stringResource(R.string.lesson_complete_action),
                    onClick = onComplete,
                    busy = completing,
                )
                if (lesson.quiz != null && !lesson.requiresQuiz) {
                    TextButton(onClick = onOpenQuiz) {
                        Text(text = stringResource(R.string.lesson_take_quiz))
                    }
                }
            }
        }
    }
}

@Composable
private fun PrimaryAction(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    busy: Boolean = false,
    icon: (@Composable () -> Unit)? = null,
) {
    Button(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        enabled = enabled && !busy,
        shape = MaterialTheme.shapes.medium,
    ) {
        if (busy) {
            CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.onPrimary,
            )
        } else {
            Text(text = label)
            if (icon != null) {
                Spacer(modifier = Modifier.size(Spacing.xs))
                icon()
            } else {
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

@Composable
private fun QuizIcon() {
    Icon(
        imageVector = Icons.Outlined.Quiz,
        contentDescription = null,
        modifier = Modifier.size(18.dp),
    )
}

@Composable
private fun SaveFailureBanner(onDismiss: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.screen, vertical = Spacing.xs)
            .background(
                MaterialTheme.colorScheme.errorContainer,
                RoundedCornerShape(8.dp),
            )
            .padding(horizontal = Spacing.md, vertical = Spacing.sm),
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = Icons.Outlined.ErrorOutline,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onErrorContainer,
            modifier = Modifier.size(18.dp),
        )
        Text(
            text = stringResource(R.string.lesson_save_error),
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onErrorContainer,
        )
        TextButton(onClick = onDismiss) {
            Text(
                text = stringResource(R.string.action_close),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onErrorContainer,
            )
        }
    }
}

@Composable
private fun LessonCompletionDialog(
    completion: LessonCompletionDto,
    nextLesson: NextLessonDto?,
    onNext: () -> Unit,
    onDone: () -> Unit,
) {
    val xp = completion.rewards?.xpEarned ?: 0
    AlertDialog(
        onDismissRequest = onDone,
        icon = {
            Icon(
                imageVector = Icons.Outlined.CheckCircle,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.secondary,
            )
        },
        title = { Text(text = stringResource(R.string.lesson_completed_title)) },
        text = {
            Text(
                text = if (xp > 0) {
                    stringResource(R.string.lesson_completed_body, xp)
                } else {
                    stringResource(R.string.lesson_completed_no_xp)
                },
            )
        },
        confirmButton = {
            if (nextLesson != null) {
                TextButton(onClick = onNext) {
                    Text(text = stringResource(R.string.lesson_next_lesson))
                }
            } else {
                TextButton(onClick = onDone) {
                    Text(text = stringResource(R.string.lesson_done))
                }
            }
        },
        dismissButton = if (nextLesson != null) {
            {
                TextButton(onClick = onDone) {
                    Text(text = stringResource(R.string.lesson_done))
                }
            }
        } else {
            null
        },
    )
}
