package com.smartme.app.feature.learning

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.smartme.app.R
import com.smartme.app.core.network.ApiError
import com.smartme.app.core.network.LessonProgressDto
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.feature.common.UiText

/** Small rounded label used for free/premium, status and difficulty. */
@Composable
fun LearningBadge(
    text: String,
    modifier: Modifier = Modifier,
    containerColor: Color = MaterialTheme.colorScheme.surfaceVariant,
    contentColor: Color = MaterialTheme.colorScheme.onSurfaceVariant,
    icon: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = modifier
            .background(containerColor, RoundedCornerShape(6.dp))
            .padding(horizontal = Spacing.sm, vertical = Spacing.xs),
        horizontalArrangement = Arrangement.spacedBy(Spacing.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon?.invoke()
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Medium,
            color = contentColor,
        )
    }
}

@Composable
fun AccessTierBadge(accessTier: String, locked: Boolean, modifier: Modifier = Modifier) {
    val premium = locked || accessTier.equals("PREMIUM", ignoreCase = true)
    if (!premium) {
        LearningBadge(
            text = stringResource(R.string.learning_free),
            modifier = modifier,
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
            contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        )
        return
    }

    LearningBadge(
        text = stringResource(R.string.learning_premium),
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.tertiaryContainer,
        contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
        icon = if (locked) {
            {
                Icon(
                    imageVector = Icons.Outlined.Lock,
                    contentDescription = null,
                    modifier = Modifier.size(12.dp),
                )
            }
        } else {
            null
        },
    )
}

@Composable
fun DifficultyLabel(difficulty: String, modifier: Modifier = Modifier) {
    Text(
        text = stringResource(difficultyRes(difficulty)),
        modifier = modifier,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@StringRes
fun difficultyRes(difficulty: String): Int = when (difficulty.uppercase()) {
    "ELEMENTARY" -> R.string.difficulty_elementary
    "INTERMEDIATE" -> R.string.difficulty_intermediate
    "ADVANCED" -> R.string.difficulty_advanced
    else -> R.string.difficulty_beginner
}

@Composable
fun DurationLabel(minutes: Int, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(Spacing.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = Icons.Outlined.Schedule,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(14.dp),
        )
        Text(
            text = stringResource(R.string.learning_minutes, minutes),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
fun LearningProgressBar(percent: Int, modifier: Modifier = Modifier) {    LinearProgressIndicator(
        progress = { (percent.coerceIn(0, 100) / 100f) },
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.primary,
        trackColor = MaterialTheme.colorScheme.surfaceVariant,
    )
}

@Composable
fun LessonStatusLabel(progress: LessonProgressDto?, modifier: Modifier = Modifier) {
    if (progress == null) return
    val completed = progress.isCompleted
    LearningBadge(
        text = stringResource(
            if (completed) R.string.learning_completed else R.string.learning_in_progress,
        ),
        modifier = modifier,
        containerColor = if (completed) {
            MaterialTheme.colorScheme.secondaryContainer
        } else {
            MaterialTheme.colorScheme.primaryContainer
        },
        contentColor = if (completed) {
            MaterialTheme.colorScheme.onSecondaryContainer
        } else {
            MaterialTheme.colorScheme.onPrimaryContainer
        },
    )
}

/** Maps API failures to learner-facing copy, keeping the server message as the default. */
fun ApiError.toLearningMessage(): UiText = when (code) {
    "PREMIUM_REQUIRED" -> UiText.Resource(R.string.learning_premium_required_body)
    "QUIZ_REQUIRED" -> UiText.Resource(R.string.lesson_quiz_required_message)
    else -> UiText.Plain(message)
}

/** Horizontal padding shared by catalogue cards and lesson blocks. */
val LearningCardPadding = PaddingValues(Spacing.lg)

/** Back affordance used by the catalogue and player screens above the tab graph. */
@Composable
fun LearningTopBar(
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
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
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(modifier = Modifier.width(Spacing.minTouchTarget))
    }
}

@Composable
fun PremiumRequiredDialog(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = Icons.Outlined.Lock,
                contentDescription = null,
            )
        },
        title = { Text(text = stringResource(R.string.learning_premium_required_title)) },
        text = { Text(text = stringResource(R.string.learning_premium_required_body)) },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(R.string.action_close))
            }
        },
    )
}
