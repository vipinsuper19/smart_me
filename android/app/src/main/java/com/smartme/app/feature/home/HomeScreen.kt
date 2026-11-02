package com.smartme.app.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smartme.app.R
import com.smartme.app.core.designsystem.theme.SmartMeTheme
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.core.model.UiState
import java.time.LocalTime

/**
 * Task 12 home tab: a greeting, the backend connectivity card and two preview
 * cards. Task 14 replaces the preview cards with the real plan, streak and
 * quick-practice content.
 */
@Composable
fun HomeScreen(
    modifier: Modifier = Modifier,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    HomeContent(
        state = state,
        onRetry = viewModel::checkConnection,
        modifier = modifier,
    )
}

@Composable
internal fun HomeContent(
    state: UiState<BackendStatus>,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val greeting = remember { greetingResForHour(LocalTime.now().hour) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Spacing.screen, vertical = Spacing.xl),
        verticalArrangement = Arrangement.spacedBy(Spacing.lg),
    ) {
        Text(
            text = stringResource(greeting),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = stringResource(R.string.home_subtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        BackendStatusCard(state = state, onRetry = onRetry)

        InfoCard(
            icon = Icons.Outlined.CalendarMonth,
            title = stringResource(R.string.home_card_plan_title),
            body = stringResource(R.string.home_card_plan_body),
        )
        InfoCard(
            icon = Icons.Outlined.LocalFireDepartment,
            title = stringResource(R.string.home_card_rewards_title),
            body = stringResource(R.string.home_card_rewards_body),
        )
    }
}

/** Maps the current hour to a greeting without touching the clock, so it is testable. */
internal fun greetingResForHour(hour: Int): Int = when {
    hour < 0 || hour > 23 -> R.string.home_greeting_day
    hour < 12 -> R.string.home_greeting_morning
    hour < 17 -> R.string.home_greeting_afternoon
    else -> R.string.home_greeting_evening
}

@Composable
private fun BackendStatusCard(
    state: UiState<BackendStatus>,
    onRetry: () -> Unit,
) {
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
                text = stringResource(R.string.home_status_title),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            when (state) {
                is UiState.Loading -> StatusRow(
                    icon = { CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp) },
                    text = stringResource(R.string.home_status_loading),
                )

                is UiState.Content -> Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                    StatusRow(
                        icon = {
                            Icon(
                                imageVector = Icons.Outlined.CloudDone,
                                contentDescription = null,
                                tint = SmartMeTheme.colors.success,
                                modifier = Modifier.size(18.dp),
                            )
                        },
                        text = stringResource(R.string.home_status_connected, state.data.service),
                    )
                    if (state.data.version != null) {
                        Text(
                            text = stringResource(R.string.home_status_version, state.data.version),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                is UiState.Empty -> StatusRow(
                    icon = {
                        Icon(
                            imageVector = Icons.Outlined.Info,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp),
                        )
                    },
                    text = stringResource(R.string.home_status_unknown),
                )

                is UiState.Error -> Column(verticalArrangement = Arrangement.spacedBy(Spacing.xs)) {
                    StatusRow(
                        icon = {
                            Icon(
                                imageVector = Icons.Outlined.ErrorOutline,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(18.dp),
                            )
                        },
                        text = stringResource(R.string.home_status_unreachable),
                    )
                    Text(
                        text = state.message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    TextButton(onClick = onRetry) {
                        Text(text = stringResource(R.string.action_retry))
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusRow(
    icon: @Composable () -> Unit,
    text: String,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        Box(modifier = Modifier.size(18.dp), contentAlignment = Alignment.Center) { icon() }
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}

@Composable
private fun InfoCard(
    icon: ImageVector,
    title: String,
    body: String,
) {
    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
    ) {
        Row(
            modifier = Modifier.padding(Spacing.lg),
            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(24.dp),
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(Spacing.xs),
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
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
}
