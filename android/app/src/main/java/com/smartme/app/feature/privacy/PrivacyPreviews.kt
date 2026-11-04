package com.smartme.app.feature.privacy

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.core.network.DeletionRequestDto

private val pendingDeletion = DeletionRequestDto(
    id = "deletion-preview",
    status = "PENDING",
    reason = "Starting a new account later",
    requestedAt = "2026-11-04T09:15:00.000Z",
    scheduledFor = "2026-12-04T09:15:00.000Z",
    retentionNotice = "Some billing records may be retained for legal and tax requirements.",
)

@ScreenPreviews
@Composable
private fun PrivacyDefaultPreview() {
    PreviewContainer {
        PrivacyContent(
            state = PrivacyUiState(loading = false),
            onRequestDeletion = {},
            onCancelDeletion = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun PrivacyPendingPreview() {
    PreviewContainer {
        PrivacyContent(
            state = PrivacyUiState(loading = false, request = pendingDeletion),
            onRequestDeletion = {},
            onCancelDeletion = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun PrivacyCanceledPreview() {
    PreviewContainer {
        PrivacyContent(
            state = PrivacyUiState(loading = false, canceled = true),
            onRequestDeletion = {},
            onCancelDeletion = {},
        )
    }
}
