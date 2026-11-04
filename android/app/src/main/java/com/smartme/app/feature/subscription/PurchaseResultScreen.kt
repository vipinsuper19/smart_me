package com.smartme.app.feature.subscription

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.smartme.app.R
import com.smartme.app.core.designsystem.theme.SmartMeTheme
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.feature.learning.LearningTopBar

/**
 * Full-screen outcome for a Play purchase or restore attempt. The status is a
 * route argument; no entitlement is ever inferred from it locally.
 */
@Composable
fun PurchaseResultScreen(
    status: String,
    reason: String?,
    onDone: () -> Unit,
    onTryAgain: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize()) {
        LearningTopBar(
            title = stringResource(R.string.purchase_result_title),
            onBack = onDone,
        )
        PurchaseResultContent(
            status = status,
            reason = reason,
            onDone = onDone,
            onTryAgain = onTryAgain,
        )
    }
}

@Composable
internal fun PurchaseResultContent(
    status: String,
    reason: String?,
    onDone: () -> Unit,
    onTryAgain: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val result = purchaseResultStatus(status)

    Box(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = Spacing.xl, vertical = Spacing.lg),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.widthIn(max = 420.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            when (result) {
                PurchaseResultStatus.Success -> ResultBadge(
                    icon = Icons.Outlined.CheckCircle,
                    tint = MaterialTheme.colorScheme.secondary,
                    container = SmartMeTheme.colors.successContainer,
                )

                PurchaseResultStatus.Pending -> ResultBadge(
                    icon = Icons.Outlined.Schedule,
                    tint = MaterialTheme.colorScheme.tertiary,
                    container = MaterialTheme.colorScheme.tertiaryContainer,
                )

                else -> ResultBadge(
                    icon = Icons.Outlined.ErrorOutline,
                    tint = MaterialTheme.colorScheme.error,
                    container = MaterialTheme.colorScheme.errorContainer,
                )
            }

            Text(
                text = stringResource(
                    when (result) {
                        PurchaseResultStatus.Success -> R.string.purchase_success_title
                        PurchaseResultStatus.Pending -> R.string.purchase_pending_title
                        else -> R.string.purchase_failure_title
                    },
                ),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
            )

            Text(
                text = when (result) {
                    PurchaseResultStatus.Success -> stringResource(R.string.purchase_success_body)
                    PurchaseResultStatus.Pending -> stringResource(R.string.purchase_pending_body)
                    else -> reason?.takeIf { it.isNotBlank() }
                        ?: stringResource(R.string.purchase_failure_body)
                },
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )

            when (result) {
                PurchaseResultStatus.Success -> {
                    Button(
                        onClick = onDone,
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.medium,
                    ) {
                        Text(text = stringResource(R.string.purchase_success_action))
                    }
                }

                PurchaseResultStatus.Pending -> {
                    Text(
                        text = stringResource(R.string.purchase_pending_note),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                    Button(
                        onClick = onDone,
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.medium,
                    ) {
                        Text(text = stringResource(R.string.purchase_pending_action))
                    }
                }

                else -> {
                    Button(
                        onClick = onTryAgain,
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.medium,
                    ) {
                        Text(text = stringResource(R.string.purchase_failure_action))
                    }
                    TextButton(onClick = onDone) {
                        Text(text = stringResource(R.string.purchase_failure_dismiss))
                    }
                }
            }

            if (result != PurchaseResultStatus.Failure) {
                Text(
                    text = stringResource(R.string.purchase_verified_note),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

@Composable
private fun ResultBadge(
    icon: ImageVector,
    tint: Color,
    container: Color,
) {
    Box(
        modifier = Modifier
            .size(84.dp)
            .background(container, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(44.dp),
        )
    }
}
