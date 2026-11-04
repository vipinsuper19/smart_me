package com.smartme.app.feature.privacy

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DeleteForever
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smartme.app.R
import com.smartme.app.core.designsystem.component.ErrorState
import com.smartme.app.core.designsystem.component.LoadingState
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.core.network.DeletionRequestDto
import com.smartme.app.core.util.formatIsoDate
import com.smartme.app.feature.learning.LearningTopBar

private const val ReasonMaxLength = 500

@Composable
fun PrivacyScreen(
    onBack: () -> Unit,
    onSignedOut: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: PrivacyViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(state.justRequested) {
        if (state.justRequested) showConfirm = false
    }

    Column(modifier = modifier.fillMaxSize()) {
        LearningTopBar(
            title = stringResource(R.string.privacy_title),
            onBack = onBack,
        )

        when {
            state.loading -> LoadingState()

            state.loadError != null -> ErrorState(
                title = stringResource(R.string.privacy_load_error_title),
                message = state.loadError.orEmpty(),
                onRetry = viewModel::load,
            )

            else -> PrivacyContent(
                state = state,
                onRequestDeletion = { showConfirm = true },
                onCancelDeletion = viewModel::cancelDeletion,
            )
        }
    }

    if (showConfirm) {
        DeletionConfirmDialog(
            requesting = state.requesting,
            error = state.requestError,
            onConfirm = { reason -> viewModel.requestDeletion(reason) },
            onDismiss = { showConfirm = false },
        )
    }

    if (state.justRequested) {
        DeletionScheduledDialog(
            request = state.request,
            onAcknowledge = {
                viewModel.acknowledgeRequest()
                onSignedOut()
            },
        )
    }
}

@Composable
internal fun PrivacyContent(
    state: PrivacyUiState,
    onRequestDeletion: () -> Unit,
    onCancelDeletion: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val pending = state.request?.takeIf { it.isPending }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = Spacing.screen,
            end = Spacing.screen,
            top = Spacing.sm,
            bottom = Spacing.xl,
        ),
        verticalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        item {
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
                    Icon(
                        imageVector = Icons.Outlined.Shield,
                        contentDescription = null,
                        modifier = Modifier.size(30.dp),
                    )
                    Text(
                        text = stringResource(R.string.privacy_intro_title),
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = stringResource(R.string.privacy_intro_body),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }

        item {
            PrivacySection(
                title = stringResource(R.string.privacy_data_title),
                body = stringResource(R.string.privacy_data_body),
            )
        }
        item {
            PrivacySection(
                title = stringResource(R.string.privacy_use_title),
                body = stringResource(R.string.privacy_use_body),
            )
        }
        item {
            PrivacySection(
                title = stringResource(R.string.privacy_retention_title),
                body = stringResource(R.string.privacy_retention_body),
            )
        }

        if (pending != null) {
            item {
                PendingDeletionCard(
                    request = pending,
                    cancelling = state.cancelling,
                    cancelError = state.cancelError,
                    onCancel = onCancelDeletion,
                )
            }
        } else {
            item {
                DeletionCard(
                    error = state.requestError,
                    onRequest = onRequestDeletion,
                )
            }
        }

        if (state.canceled) {
            item {
                Text(
                    text = stringResource(R.string.privacy_cancel_success),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.secondary,
                )
            }
        }

        item {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.xs),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Outlined.Lock,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(14.dp),
                )
                Text(
                    text = stringResource(R.string.privacy_contact_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun PrivacySection(title: String, body: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.xs),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = body,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun DeletionCard(
    error: String?,
    onRequest: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.errorContainer,
        contentColor = MaterialTheme.colorScheme.onErrorContainer,
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
                    imageVector = Icons.Outlined.DeleteForever,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                )
                Text(
                    text = stringResource(R.string.privacy_delete_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Text(
                text = stringResource(R.string.privacy_delete_body),
                style = MaterialTheme.typography.bodyMedium,
            )
            if (error != null) {
                Text(
                    text = error,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Button(
                onClick = onRequest,
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error,
                    contentColor = MaterialTheme.colorScheme.onError,
                ),
            ) {
                Text(text = stringResource(R.string.privacy_delete_action))
            }
        }
    }
}

@Composable
private fun PendingDeletionCard(
    request: DeletionRequestDto,
    cancelling: Boolean,
    cancelError: String?,
    onCancel: () -> Unit,
) {
    val requested = formatIsoDate(request.requestedAt)
    val scheduled = formatIsoDate(request.scheduledFor)
    val body = if (requested != null && scheduled != null) {
        stringResource(R.string.privacy_pending_body, requested, scheduled)
    } else {
        stringResource(R.string.privacy_pending_body_unknown)
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.tertiaryContainer,
        contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
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
                    imageVector = Icons.Outlined.Schedule,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                )
                Text(
                    text = stringResource(R.string.privacy_pending_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Text(
                text = body,
                style = MaterialTheme.typography.bodyMedium,
            )
            request.retentionNotice?.takeIf { it.isNotBlank() }?.let { notice ->
                Text(
                    text = notice,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            if (cancelError != null) {
                Text(
                    text = cancelError,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            OutlinedButton(
                onClick = onCancel,
                enabled = !cancelling,
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
            ) {
                if (cancelling) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                    )
                    Text(
                        text = stringResource(R.string.privacy_pending_cancelling),
                        modifier = Modifier.padding(start = Spacing.sm),
                    )
                } else {
                    Text(text = stringResource(R.string.privacy_pending_cancel_action))
                }
            }
        }
    }
}

@Composable
private fun DeletionConfirmDialog(
    requesting: Boolean,
    error: String?,
    onConfirm: (String?) -> Unit,
    onDismiss: () -> Unit,
) {
    var reason by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = { if (!requesting) onDismiss() },
        icon = {
            Icon(
                imageVector = Icons.Outlined.DeleteForever,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.error,
            )
        },
        title = { Text(text = stringResource(R.string.privacy_delete_confirm_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                Text(text = stringResource(R.string.privacy_delete_confirm_body))
                OutlinedTextField(
                    value = reason,
                    onValueChange = { next ->
                        if (next.length <= ReasonMaxLength) reason = next
                    },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(text = stringResource(R.string.privacy_delete_reason_label)) },
                    minLines = 2,
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.Sentences,
                    ),
                    supportingText = {
                        Text(text = "${reason.length}/$ReasonMaxLength")
                    },
                    shape = MaterialTheme.shapes.medium,
                )
                if (error != null) {
                    Text(
                        text = error,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(reason.trim().ifBlank { null }) },
                enabled = !requesting,
            ) {
                if (requesting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text(
                        text = stringResource(R.string.privacy_delete_confirm_action),
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !requesting) {
                Text(text = stringResource(R.string.privacy_delete_cancel))
            }
        },
    )
}

@Composable
private fun DeletionScheduledDialog(
    request: DeletionRequestDto?,
    onAcknowledge: () -> Unit,
) {
    val scheduled = formatIsoDate(request?.scheduledFor)
    val body = if (scheduled != null) {
        stringResource(R.string.privacy_requested_body, scheduled)
    } else {
        stringResource(R.string.privacy_requested_body_unknown)
    }

    AlertDialog(
        onDismissRequest = { },
        icon = {
            Icon(
                imageVector = Icons.Outlined.Schedule,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.tertiary,
            )
        },
        title = { Text(text = stringResource(R.string.privacy_requested_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                Text(text = body)
                request?.retentionNotice?.takeIf { it.isNotBlank() }?.let { notice ->
                    Text(
                        text = notice,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onAcknowledge) {
                Text(text = stringResource(R.string.privacy_requested_action))
            }
        },
    )
}
