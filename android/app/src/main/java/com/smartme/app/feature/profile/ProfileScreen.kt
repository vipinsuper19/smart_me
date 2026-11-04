package com.smartme.app.feature.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
import com.smartme.app.core.model.UserSummary
import com.smartme.app.core.network.ProfileDto

@Composable
fun ProfileScreen(
    fallbackUser: UserSummary?,
    onSignOut: () -> Unit,
    onEditProfile: () -> Unit,
    onLearningPreferences: () -> Unit,
    onNotificationSettings: () -> Unit,
    onSubscription: () -> Unit,
    onSupport: () -> Unit,
    onPrivacy: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var confirmSignOut by remember { mutableStateOf(false) }

    LifecycleResumeEffect(Unit) {
        viewModel.onResumed()
        onPauseOrDispose { }
    }

    ProfileContent(
        state = state,
        fallbackUser = fallbackUser,
        onRetry = viewModel::load,
        onEditProfile = onEditProfile,
        onLearningPreferences = onLearningPreferences,
        onNotificationSettings = onNotificationSettings,
        onSubscription = onSubscription,
        onSupport = onSupport,
        onPrivacy = onPrivacy,
        onSignOut = { confirmSignOut = true },
        modifier = modifier,
    )

    if (confirmSignOut) {
        AlertDialog(
            onDismissRequest = { confirmSignOut = false },
            title = { Text(text = stringResource(R.string.profile_sign_out_title)) },
            text = { Text(text = stringResource(R.string.profile_sign_out_body)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmSignOut = false
                        onSignOut()
                    },
                ) {
                    Text(
                        text = stringResource(R.string.profile_sign_out),
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmSignOut = false }) {
                    Text(text = stringResource(R.string.action_cancel))
                }
            },
        )
    }
}

@Composable
internal fun ProfileContent(
    state: UiState<ProfileDto>,
    fallbackUser: UserSummary?,
    onRetry: () -> Unit,
    onEditProfile: () -> Unit,
    onLearningPreferences: () -> Unit,
    onNotificationSettings: () -> Unit,
    onSubscription: () -> Unit,
    onSupport: () -> Unit,
    onPrivacy: () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    when (state) {
        is UiState.Loading -> LoadingState(modifier = modifier)

        is UiState.Empty -> ProfileBody(
            profile = null,
            fallbackUser = fallbackUser,
            onEditProfile = onEditProfile,
            onLearningPreferences = onLearningPreferences,
            onNotificationSettings = onNotificationSettings,
            onSubscription = onSubscription,
            onSupport = onSupport,
            onPrivacy = onPrivacy,
            onSignOut = onSignOut,
            modifier = modifier,
        )

        is UiState.Error -> ErrorState(
            title = stringResource(R.string.profile_load_error_title),
            message = state.message,
            onRetry = onRetry,
            modifier = modifier,
        )

        is UiState.Content -> ProfileBody(
            profile = state.data,
            fallbackUser = fallbackUser,
            onEditProfile = onEditProfile,
            onLearningPreferences = onLearningPreferences,
            onNotificationSettings = onNotificationSettings,
            onSubscription = onSubscription,
            onSupport = onSupport,
            onPrivacy = onPrivacy,
            onSignOut = onSignOut,
            modifier = modifier,
        )
    }
}

@Composable
private fun ProfileBody(
    profile: ProfileDto?,
    fallbackUser: UserSummary?,
    onEditProfile: () -> Unit,
    onLearningPreferences: () -> Unit,
    onNotificationSettings: () -> Unit,
    onSubscription: () -> Unit,
    onSupport: () -> Unit,
    onPrivacy: () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Spacing.screen, vertical = Spacing.xl),
        verticalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        Text(
            text = stringResource(R.string.profile_title),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
        )

        AccountCard(profile = profile, fallbackUser = fallbackUser, onEditProfile = onEditProfile)

        SettingsSection(title = stringResource(R.string.profile_section_learning)) {
            ActionRow(
                icon = Icons.Outlined.Edit,
                title = stringResource(R.string.profile_edit_action),
                subtitle = stringResource(R.string.profile_edit_subtitle),
                onClick = onEditProfile,
            )
            HorizontalDivider()
            ActionRow(
                icon = Icons.Outlined.Tune,
                title = stringResource(R.string.profile_preferences_action),
                subtitle = stringResource(R.string.profile_preferences_subtitle),
                onClick = onLearningPreferences,
            )
            HorizontalDivider()
            ActionRow(
                icon = Icons.Outlined.Notifications,
                title = stringResource(R.string.profile_notifications_action),
                subtitle = stringResource(R.string.profile_notifications_subtitle),
                onClick = onNotificationSettings,
            )
        }

        SettingsSection(title = stringResource(R.string.profile_section_membership)) {
            ActionRow(
                icon = Icons.Outlined.WorkspacePremium,
                title = stringResource(R.string.profile_subscription_action),
                subtitle = stringResource(R.string.profile_subscription_subtitle),
                onClick = onSubscription,
            )
        }

        SettingsSection(title = stringResource(R.string.profile_section_support)) {
            ActionRow(
                icon = Icons.AutoMirrored.Outlined.HelpOutline,
                title = stringResource(R.string.profile_support_action),
                subtitle = stringResource(R.string.profile_support_subtitle),
                onClick = onSupport,
            )
            HorizontalDivider()
            ActionRow(
                icon = Icons.Outlined.Shield,
                title = stringResource(R.string.profile_privacy_action),
                subtitle = stringResource(R.string.profile_privacy_subtitle),
                onClick = onPrivacy,
            )
        }

        OutlinedButton(
            onClick = onSignOut,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = MaterialTheme.colorScheme.error,
            ),
            shape = MaterialTheme.shapes.medium,
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.Logout,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
            )
            Text(
                text = stringResource(R.string.profile_sign_out),
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.padding(start = Spacing.sm),
            )
        }

        Text(
            text = stringResource(R.string.profile_version, com.smartme.app.BuildConfig.VERSION_NAME),
            modifier = Modifier.fillMaxWidth(),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun AccountCard(
    profile: ProfileDto?,
    fallbackUser: UserSummary?,
    onEditProfile: () -> Unit,
) {
    val displayName = profile?.name
        ?.takeIf { it.isNotBlank() }
        ?: fallbackUser?.displayName
        ?: stringResource(R.string.profile_account_title)
    val email = profile?.email ?: fallbackUser?.email
    val avatarUrl = profile?.avatarUrl ?: fallbackUser?.avatarUrl
    val details = listOfNotNull(
        profile?.profile?.headline?.takeIf { it.isNotBlank() },
        profile?.profile?.occupation?.takeIf { it.isNotBlank() },
        profile?.profile?.city?.takeIf { it.isNotBlank() },
    )

    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.lg),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Avatar(name = displayName, avatarUrl = avatarUrl)

                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(Spacing.xs),
                ) {
                    Text(
                        text = stringResource(R.string.profile_signed_in_as),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = displayName,
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    email?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            if (details.isNotEmpty()) {
                Text(
                    text = details.joinToString(" · "),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            profile?.profile?.bio?.takeIf { it.isNotBlank() }?.let { bio ->
                Text(
                    text = bio,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }

            TextButton(onClick = onEditProfile) {
                Text(text = stringResource(R.string.profile_edit_action))
            }
        }
    }
}

@Composable
private fun Avatar(name: String, avatarUrl: String?) {
    Surface(
        shape = CircleShape,
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        modifier = Modifier.size(64.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            if (!avatarUrl.isNullOrBlank()) {
                AsyncImage(
                    model = avatarUrl,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                val initial = name.firstOrNull()?.uppercaseChar()?.toString()
                if (initial != null) {
                    Text(
                        text = initial,
                        style = MaterialTheme.typography.headlineSmall,
                        textAlign = TextAlign.Center,
                    )
                } else {
                    Icon(
                        imageVector = Icons.Outlined.Person,
                        contentDescription = null,
                        modifier = Modifier.size(30.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun SettingsSection(
    title: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        OutlinedCard(
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.large,
        ) {
            Column { content() }
        }
    }
}

@Composable
private fun ActionRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        color = MaterialTheme.colorScheme.surface,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = Spacing.lg, vertical = Spacing.md),
            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(22.dp),
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Icon(
                imageVector = Icons.Outlined.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}
