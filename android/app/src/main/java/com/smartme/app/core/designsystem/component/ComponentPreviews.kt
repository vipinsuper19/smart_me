package com.smartme.app.core.designsystem.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.core.designsystem.theme.Spacing

@ScreenPreviews
@Composable
private fun PrimaryButtonPreview() {
    PreviewContainer {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            PrimaryButton(
                text = "Continue",
                onClick = {},
                modifier = Modifier.fillMaxWidth(),
                trailingIcon = Icons.AutoMirrored.Outlined.ArrowForward,
            )
            PrimaryButton(
                text = "Continue",
                onClick = {},
                modifier = Modifier.fillMaxWidth(),
                loading = true,
            )
            PrimaryButton(
                text = "Continue",
                onClick = {},
                modifier = Modifier.fillMaxWidth(),
                enabled = false,
            )
        }
    }
}

@ScreenPreviews
@Composable
private fun LoadingStatePreview() {
    PreviewContainer {
        LoadingState(label = "Loading your plan…")
    }
}

@ScreenPreviews
@Composable
private fun EmptyStatePreview() {
    PreviewContainer {
        EmptyState(
            title = "Nothing here yet",
            description = "New lessons will appear here as soon as they are published.",
        )
    }
}

@ScreenPreviews
@Composable
private fun ErrorStatePreview() {
    PreviewContainer {
        ErrorState(
            title = "Something went wrong",
            message = "We couldn't load this screen. Please try again.",
            onRetry = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun OfflineBannerPreview() {
    PreviewContainer {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            OfflineBanner(visible = true, modifier = Modifier.fillMaxWidth())
            Text(
                text = "Screen content stays usable while offline.",
                modifier = Modifier.padding(horizontal = Spacing.screen),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
