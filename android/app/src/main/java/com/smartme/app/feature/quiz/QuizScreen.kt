package com.smartme.app.feature.quiz

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.Button
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.RadioButton
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smartme.app.R
import com.smartme.app.core.designsystem.component.EmptyState
import com.smartme.app.core.designsystem.component.ErrorState
import com.smartme.app.core.designsystem.component.LoadingState
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.QuizOptionDto
import com.smartme.app.core.network.QuizResultOptionDto
import com.smartme.app.core.network.QuizResultQuestionDto
import com.smartme.app.core.network.QuizSubmissionDto
import com.smartme.app.feature.common.asString
import com.smartme.app.feature.learning.LearningTopBar

@Composable
fun QuizScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: QuizViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    QuizScreenContent(
        state = state,
        onBack = onBack,
        onRetry = viewModel::load,
        onSelectAnswer = viewModel::selectAnswer,
        onNext = viewModel::next,
        onPrevious = viewModel::previous,
        onSubmit = viewModel::submit,
        onRetryQuiz = viewModel::retry,
        onMessageShown = viewModel::onMessageShown,
        modifier = modifier,
    )
}

@Composable
internal fun QuizScreenContent(
    state: QuizUiState,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onSelectAnswer: (questionId: String, optionId: String) -> Unit,
    onNext: () -> Unit,
    onPrevious: () -> Unit,
    onSubmit: () -> Unit,
    onRetryQuiz: () -> Unit,
    modifier: Modifier = Modifier,
    onMessageShown: () -> Unit = {},
) {
    val snackbarHostState = remember { SnackbarHostState() }
    val messageText = state.message?.asString()

    LaunchedEffect(messageText) {
        if (messageText != null) {
            snackbarHostState.showSnackbar(messageText)
            onMessageShown()
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            LearningTopBar(
                title = state.quizContent?.quiz?.title ?: stringResource(R.string.quiz_title),
                onBack = onBack,
            )

            when (val content = state.content) {
                is UiState.Loading -> LoadingState(modifier = Modifier.weight(1f))

                is UiState.Empty -> EmptyState(
                    title = stringResource(R.string.quiz_empty),
                    modifier = Modifier.weight(1f),
                )

                is UiState.Error -> ErrorState(
                    title = stringResource(R.string.quiz_error_title),
                    message = content.message,
                    onRetry = onRetry,
                    modifier = Modifier.weight(1f),
                )

                is UiState.Content -> {
                    val result = state.result
                    if (result != null) {
                        QuizResultContent(
                            submission = result,
                            lessonCompleted = state.lessonCompleted,
                            onRetry = onRetryQuiz,
                            onBackToLesson = onBack,
                            modifier = Modifier.weight(1f),
                        )
                    } else {
                        QuizQuestionContent(
                            state = state,
                            content = content.data,
                            onSelectAnswer = onSelectAnswer,
                            onNext = onNext,
                            onPrevious = onPrevious,
                            onSubmit = onSubmit,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
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
private fun QuizQuestionContent(
    state: QuizUiState,
    content: QuizContent,
    onSelectAnswer: (questionId: String, optionId: String) -> Unit,
    onNext: () -> Unit,
    onPrevious: () -> Unit,
    onSubmit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val questions = content.quiz.questions
    val index = state.index.coerceIn(0, questions.lastIndex)
    val question = questions[index]
    val selectedOptionId = content.answers[question.id]
    val isLast = index == questions.lastIndex

    Column(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.padding(
                start = Spacing.screen,
                end = Spacing.screen,
                top = Spacing.sm,
            ),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(
                        R.string.quiz_question_progress,
                        index + 1,
                        questions.size,
                    ),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = stringResource(
                        R.string.quiz_pass_score,
                        content.quiz.passingScore,
                    ),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            LinearProgressIndicator(
                progress = { (index + 1).toFloat() / questions.size.coerceAtLeast(1) },
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(
                    start = Spacing.screen,
                    end = Spacing.screen,
                    top = Spacing.lg,
                    bottom = Spacing.lg,
                ),
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            if (!question.scenario.isNullOrBlank()) {
                Surface(
                    shape = MaterialTheme.shapes.medium,
                    color = MaterialTheme.colorScheme.surfaceVariant,
                ) {
                    Column(
                        modifier = Modifier.padding(Spacing.md),
                        verticalArrangement = Arrangement.spacedBy(Spacing.xs),
                    ) {
                        Text(
                            text = stringResource(R.string.quiz_scenario_label),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Text(
                            text = question.scenario,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }
                }
            }

            Text(
                text = question.prompt,
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )

            question.options.forEach { option ->
                QuizOptionRow(
                    option = option,
                    selected = option.id == selectedOptionId,
                    enabled = !state.submitting && !state.isSaving,
                    onClick = { onSelectAnswer(question.id, option.id) },
                )
            }

            if (state.isSaving) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(14.dp),
                        strokeWidth = 2.dp,
                    )
                    Text(
                        text = stringResource(R.string.quiz_submitting),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        QuizNavigation(
            index = index,
            total = questions.size,
            submitting = state.submitting,
            onPrevious = onPrevious,
            onNext = onNext,
            onSubmit = onSubmit,
        )
    }
}

@Composable
private fun QuizOptionRow(
    option: QuizOptionDto,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        color = if (selected) {
            MaterialTheme.colorScheme.primaryContainer
        } else {
            MaterialTheme.colorScheme.surface
        },
        border = BorderStroke(
            1.dp,
            if (selected) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.outlineVariant
            },
        ),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = Spacing.sm, vertical = Spacing.sm),
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RadioButton(
                selected = selected,
                onClick = null,
                enabled = enabled,
            )
            Text(
                text = option.text,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Composable
private fun QuizNavigation(
    index: Int,
    total: Int,
    submitting: Boolean,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onSubmit: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(
                start = Spacing.screen,
                end = Spacing.screen,
                top = Spacing.sm,
                bottom = Spacing.lg,
            ),
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (index > 0) {
            OutlinedButton(
                onClick = onPrevious,
                enabled = !submitting,
                modifier = Modifier.weight(1f),
                shape = MaterialTheme.shapes.medium,
            ) {
                Text(text = stringResource(R.string.quiz_previous))
            }
        } else {
            Spacer(modifier = Modifier.weight(1f))
        }

        Button(
            onClick = if (index == total - 1) onSubmit else onNext,
            enabled = !submitting,
            modifier = Modifier.weight(1f),
            shape = MaterialTheme.shapes.medium,
        ) {
            if (submitting) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary,
                )
            } else {
                Text(
                    text = stringResource(
                        if (index == total - 1) R.string.quiz_submit else R.string.quiz_next,
                    ),
                )
            }
        }
    }
}

@Composable
private fun QuizResultContent(
    submission: QuizSubmissionDto,
    lessonCompleted: Boolean,
    onRetry: () -> Unit,
    onBackToLesson: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val passed = submission.attempt.passed

    Column(modifier = modifier.fillMaxSize()) {        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(
                start = Spacing.screen,
                end = Spacing.screen,
                top = Spacing.lg,
                bottom = Spacing.lg,
            ),
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            item {
                ResultSummary(
                    submission = submission,
                    lessonCompleted = lessonCompleted,
                )
            }

            item {
                Text(
                    text = stringResource(R.string.quiz_review_title),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }

            items(items = submission.questions, key = { it.id }) { question ->
                ResultQuestionCard(question = question)
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(
                    start = Spacing.screen,
                    end = Spacing.screen,
                    top = Spacing.sm,
                    bottom = Spacing.lg,
                ),
            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            if (!passed) {
                OutlinedButton(
                    onClick = onRetry,
                    modifier = Modifier.weight(1f),
                    shape = MaterialTheme.shapes.medium,
                ) {
                    Text(text = stringResource(R.string.quiz_result_retry))
                }
            }
            Button(
                onClick = onBackToLesson,
                modifier = Modifier.weight(1f),
                shape = MaterialTheme.shapes.medium,
            ) {
                Text(text = stringResource(R.string.quiz_result_back))
            }
        }
    }
}

@Composable
private fun ResultSummary(
    submission: QuizSubmissionDto,
    lessonCompleted: Boolean,
) {
    val attempt = submission.attempt
    val passed = attempt.passed
    val containerColor = if (passed) {
        MaterialTheme.colorScheme.secondaryContainer
    } else {
        MaterialTheme.colorScheme.errorContainer
    }
    val contentColor = if (passed) {
        MaterialTheme.colorScheme.onSecondaryContainer
    } else {
        MaterialTheme.colorScheme.onErrorContainer
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = containerColor,
        contentColor = contentColor,
    ) {
        Column(
            modifier = Modifier.padding(Spacing.xl),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = if (passed) {
                        Icons.Outlined.CheckCircle
                    } else {
                        Icons.Outlined.Close
                    },
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                )
                Text(
                    text = stringResource(
                        if (passed) R.string.quiz_result_passed else R.string.quiz_result_failed,
                    ),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Text(
                text = stringResource(R.string.quiz_result_score, attempt.score ?: 0),
                style = MaterialTheme.typography.displaySmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = stringResource(
                    R.string.quiz_result_correct,
                    attempt.correctCount,
                    attempt.totalQuestions,
                ),
                style = MaterialTheme.typography.bodyMedium,
            )
            if (attempt.xpAwarded > 0) {
                Text(
                    text = stringResource(R.string.quiz_result_xp, attempt.xpAwarded),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            if (lessonCompleted) {
                Text(
                    text = stringResource(R.string.learning_completed),
                    style = MaterialTheme.typography.labelMedium,
                )
            }
            Text(
                text = stringResource(
                    R.string.quiz_attempt_number,
                    attempt.attemptNumber,
                ),
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}

@Composable
private fun ResultQuestionCard(question: QuizResultQuestionDto) {
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
                horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                verticalAlignment = Alignment.Top,
            ) {
                Icon(
                    imageVector = if (question.isCorrect) {
                        Icons.Outlined.CheckCircle
                    } else {
                        Icons.Outlined.Close
                    },
                    contentDescription = null,
                    tint = if (question.isCorrect) {
                        MaterialTheme.colorScheme.secondary
                    } else {
                        MaterialTheme.colorScheme.error
                    },
                    modifier = Modifier
                        .padding(top = 2.dp)
                        .size(18.dp),
                )
                Text(
                    text = question.prompt,
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
            if (!question.scenario.isNullOrBlank()) {
                Text(
                    text = question.scenario,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            question.options.forEach { option ->
                ResultOptionRow(option = option)
            }

            if (question.explanation.isNotBlank()) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Text(
                    text = stringResource(R.string.quiz_result_explanation),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = question.explanation,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}

@Composable
private fun ResultOptionRow(option: QuizResultOptionDto) {
    val containerColor = when {
        option.isCorrect -> MaterialTheme.colorScheme.secondaryContainer
        option.selected -> MaterialTheme.colorScheme.errorContainer
        else -> MaterialTheme.colorScheme.surface
    }
    val contentColor = when {
        option.isCorrect -> MaterialTheme.colorScheme.onSecondaryContainer
        option.selected -> MaterialTheme.colorScheme.onErrorContainer
        else -> MaterialTheme.colorScheme.onSurface
    }
    val label = when {
        option.selected -> stringResource(R.string.quiz_result_your_answer)
        option.isCorrect -> stringResource(R.string.quiz_result_correct_answer)
        else -> null
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(containerColor, RoundedCornerShape(8.dp))
            .padding(horizontal = Spacing.md, vertical = Spacing.sm),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            verticalAlignment = Alignment.Top,
        ) {
            if (option.isCorrect) {
                Icon(
                    imageVector = Icons.Outlined.CheckCircle,
                    contentDescription = null,
                    tint = contentColor,
                    modifier = Modifier
                        .padding(top = 2.dp)
                        .size(16.dp),
                )
            } else if (option.selected) {
                Icon(
                    imageVector = Icons.Outlined.Close,
                    contentDescription = null,
                    tint = contentColor,
                    modifier = Modifier
                        .padding(top = 2.dp)
                        .size(16.dp),
                )
            }
            Text(
                text = option.text,
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.bodyMedium,
                color = contentColor,
            )
        }
        if (label != null) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = contentColor,
            )
        }
        if (!option.feedback.isNullOrBlank()) {
            Text(
                text = option.feedback,
                style = MaterialTheme.typography.bodySmall,
                color = contentColor,
            )
        }
    }
}
