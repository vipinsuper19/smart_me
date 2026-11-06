package com.smartme.app.feature.subscription

import android.content.Intent
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smartme.app.R
import com.smartme.app.core.designsystem.component.EmptyState
import com.smartme.app.core.designsystem.component.ErrorState
import com.smartme.app.core.designsystem.component.LoadingState
import com.smartme.app.core.designsystem.theme.SmartMeTheme
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.core.network.SubscriptionDto
import com.smartme.app.core.network.SubscriptionMeDto
import com.smartme.app.core.network.SubscriptionPlanDto
import com.smartme.app.core.util.formatIsoDate
import com.smartme.app.data.billing.findActivity
import com.smartme.app.feature.common.asString
import com.smartme.app.feature.learning.LearningBadge
import com.smartme.app.feature.learning.LearningTopBar

private const val PlaySubscriptionsUrl = "https://play.google.com/store/account/subscriptions"

@Composable
fun SubscriptionScreen(
    userId: String,
    onBack: () -> Unit,
    onPurchaseResult: (status: String, reason: String?) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: SubscriptionViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val resources = LocalResources.current

    LaunchedEffect(viewModel, resources) {
        viewModel.events.collect { event ->
            when (event) {
                SubscriptionEvent.PurchaseSucceeded ->
                    onPurchaseResult(PurchaseResultStatus.Success, null)

                SubscriptionEvent.PurchasePending ->
                    onPurchaseResult(PurchaseResultStatus.Pending, null)

                is SubscriptionEvent.PurchaseFailed -> onPurchaseResult(
                    PurchaseResultStatus.Failure,
                    event.serverMessage ?: event.failure?.let { resources.getString(billingFailureRes(it)) }
                        ?: resources.getString(R.string.subscription_purchase_failed_body),
                )
            }
        }
    }

    Column(modifier = modifier.fillMaxSize()) {
        LearningTopBar(
            title = stringResource(R.string.subscription_title),
            onBack = onBack,
        )

        when {
            state.loading -> LoadingState(label = stringResource(R.string.subscription_loading))

            state.loadError != null -> ErrorState(
                title = stringResource(R.string.subscription_load_error_title),
                message = state.loadError.orEmpty(),
                onRetry = viewModel::load,
            )

            state.plans.isEmpty() && state.me?.premiumActive() != true -> EmptyState(
                title = stringResource(R.string.subscription_plans_empty),
                description = stringResource(R.string.subscription_plans_empty_body),
                icon = Icons.Outlined.WorkspacePremium,
                action = {
                    TextButton(onClick = viewModel::load) {
                        Text(text = stringResource(R.string.action_retry))
                    }
                },
            )

            else -> SubscriptionContent(
                state = state,
                onSelectPlan = viewModel::selectPlan,
                onSubscribe = { viewModel.subscribe(context.findActivity(), userId) },
                onRestore = viewModel::restore,
                onManage = {
                    runCatching {
                        context.startActivity(
                            Intent(Intent.ACTION_VIEW, PlaySubscriptionsUrl.toUri())
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                        )
                    }
                },
                onDismissMessage = viewModel::consumeActionMessage,
            )
        }
    }
}

@Composable
internal fun SubscriptionContent(
    state: SubscriptionUiState,
    onSelectPlan: (String) -> Unit,
    onSubscribe: () -> Unit,
    onRestore: () -> Unit,
    onManage: () -> Unit,
    onDismissMessage: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val me = state.me
    val premium = me?.entitlement?.premiumActive == true
    val selectedPlan = state.plans.firstOrNull { it.id == state.selectedPlanId }
    val selectedBenefits = selectedPlan?.benefits.orEmpty()

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
            Text(
                text = stringResource(R.string.subscription_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        if (premium) {
            item { PremiumStatusCard(me = me, plan = selectedPlan) }
            item { BenefitsCard(benefits = premiumBenefits(me, state.plans)) }
            item {
                Button(
                    onClick = onManage,
                    enabled = !state.busy,
                    modifier = Modifier.fillMaxWidth(),
                    shape = MaterialTheme.shapes.medium,
                ) {
                    Text(text = stringResource(R.string.subscription_manage))
                }
            }
        } else {
            item { PremiumHero() }

            if (me?.billingEnabled == false) {
                // Without billing, prices would advertise something the learner
                // cannot buy. Show the value proposition instead.
                item {
                    NoticeCard(
                        message = stringResource(R.string.subscription_billing_disabled),
                        tone = NoticeTone.Neutral,
                    )
                }
                val benefits = state.plans.flatMap { it.benefits }.distinct()
                if (benefits.isNotEmpty()) {
                    item { BenefitsCard(benefits = benefits) }
                }
            } else {
                item {
                    Text(
                        text = stringResource(R.string.subscription_plans_title),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }

                state.plans.forEach { plan ->
                    item(key = plan.id) {
                        PlanCard(
                            plan = plan,
                            selected = plan.id == state.selectedPlanId,
                            enabled = !state.busy,
                            onClick = { onSelectPlan(plan.id) },
                        )
                    }
                }

                if (selectedBenefits.isNotEmpty()) {
                    item { BenefitsCard(benefits = selectedBenefits) }
                }

                item {
                    Button(
                        onClick = onSubscribe,
                        enabled = !state.busy && selectedPlan != null,
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.medium,
                    ) {
                        if (state.busy) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                            )
                            Text(
                                text = stringResource(R.string.subscription_processing),
                                modifier = Modifier.padding(start = Spacing.sm),
                            )
                        } else {
                            Text(text = stringResource(R.string.subscription_subscribe))
                        }
                    }
                }

                item {
                    OutlinedButton(
                        onClick = onRestore,
                        enabled = !state.busy,
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.medium,
                    ) {
                        Text(text = stringResource(R.string.subscription_restore))
                    }
                }

                if (selectedPlan != null) {
                    item {
                        Text(
                            text = stringResource(
                                R.string.subscription_terms,
                                formatPriceInPaise(selectedPlan.priceInPaise, selectedPlan.currency),
                                stringResource(billingPeriodRes(selectedPlan.billingPeriod)),
                            ),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        if (state.busy) {
            item { LinearProgressIndicator(modifier = Modifier.fillMaxWidth()) }
        }

        state.actionMessage?.let { message ->
            item {
                NoticeCard(
                    message = message.asString(),
                    tone = NoticeTone.Neutral,
                    onDismiss = onDismissMessage,
                )
            }
        }
    }
}

@Composable
private fun PremiumHero() {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = SmartMeTheme.colors.xpContainer,
        contentColor = SmartMeTheme.colors.onXpContainer,
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Icon(
                imageVector = Icons.Outlined.WorkspacePremium,
                contentDescription = null,
                modifier = Modifier.size(32.dp),
            )
            Text(
                text = stringResource(R.string.subscription_hero_title),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = stringResource(R.string.subscription_hero_body),
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun PremiumStatusCard(me: SubscriptionMeDto?, plan: SubscriptionPlanDto?) {
    val subscription = me?.subscription
    val planName = subscription?.plan?.name?.takeIf { it.isNotBlank() }
        ?: plan?.name
        ?: stringResource(R.string.subscription_active_plan_fallback)
    val renewal = subscriptionRenewalLabel(subscription)

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = SmartMeTheme.colors.successContainer,
        contentColor = SmartMeTheme.colors.onSuccessContainer,
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
                    imageVector = Icons.Outlined.CheckCircle,
                    contentDescription = null,
                    modifier = Modifier.size(26.dp),
                )
                Text(
                    text = stringResource(R.string.subscription_active_title),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Text(
                text = planName,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Medium,
            )
            renewal?.let { label ->
                Text(
                    text = label,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            if (subscription != null) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    LearningBadge(
                        text = subscription.statusLabel(),
                        containerColor = SmartMeTheme.colors.onSuccessContainer.copy(alpha = 0.12f),
                        contentColor = SmartMeTheme.colors.onSuccessContainer,
                    )
                    LearningBadge(
                        text = stringResource(
                            if (subscription.autoRenewing) {
                                R.string.subscription_auto_renew_on
                            } else {
                                R.string.subscription_auto_renew_off
                            },
                        ),
                        containerColor = SmartMeTheme.colors.onSuccessContainer.copy(alpha = 0.12f),
                        contentColor = SmartMeTheme.colors.onSuccessContainer,
                    )
                }
            }
            Text(
                text = stringResource(R.string.subscription_active_body),
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun subscriptionRenewalLabel(subscription: SubscriptionDto?): String? {
    val date = formatIsoDate(subscription?.currentPeriodEnd)
    if (subscription == null || date == null) return null
    val renewing = subscription.autoRenewing && !subscription.cancelAtPeriodEnd
    return stringResource(
        if (renewing) R.string.subscription_renews_on else R.string.subscription_ends_on,
        date,
    )
}

@Composable
private fun premiumBenefits(
    me: SubscriptionMeDto?,
    plans: List<SubscriptionPlanDto>,
): List<String> {
    val fallback = listOf(
        stringResource(R.string.subscription_benefit_library),
        stringResource(R.string.subscription_benefit_practice),
        stringResource(R.string.subscription_benefit_audio),
        stringResource(R.string.subscription_benefit_paths),
    )
    val planId = me?.subscription?.plan?.id
    return plans.firstOrNull { it.id == planId }?.benefits.orEmpty().ifEmpty { fallback }
}

@Composable
private fun BenefitsCard(benefits: List<String>) {
    if (benefits.isEmpty()) return
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(
            modifier = Modifier.padding(Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            Text(
                text = stringResource(R.string.subscription_benefits_title),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            benefits.forEach { benefit ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                    verticalAlignment = Alignment.Top,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.CheckCircle,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.secondary,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = benefit,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun PlanCard(
    plan: SubscriptionPlanDto,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        enabled = enabled,
        shape = MaterialTheme.shapes.large,
        color = if (selected) {
            MaterialTheme.colorScheme.primaryContainer
        } else {
            MaterialTheme.colorScheme.surface
        },
        border = BorderStroke(
            width = if (selected) 2.dp else 1.dp,
            color = if (selected) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.outlineVariant
            },
        ),
    ) {
        Row(
            modifier = Modifier.padding(Spacing.md),
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RadioButton(selected = selected, onClick = null)
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(Spacing.xs),
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = plan.name,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    if (isYearly(plan.billingPeriod)) {
                        LearningBadge(
                            text = stringResource(R.string.subscription_best_value),
                            containerColor = MaterialTheme.colorScheme.tertiaryContainer,
                            contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
                        )
                    }
                }
                Text(
                    text = formatPriceInPaise(plan.priceInPaise, plan.currency),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = stringResource(billingPeriodRes(plan.billingPeriod)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

private enum class NoticeTone { Neutral }

@Composable
private fun NoticeCard(
    message: String,
    tone: NoticeTone,
    onDismiss: (() -> Unit)? = null,
) {
    val container = when (tone) {
        NoticeTone.Neutral -> MaterialTheme.colorScheme.surfaceVariant
    }
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        color = container,
    ) {
        Row(
            modifier = Modifier.padding(Spacing.md),
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Outlined.Info,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(18.dp),
            )
            Text(
                text = message,
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (onDismiss != null) {
                IconButton(onClick = onDismiss) {
                    Icon(
                        imageVector = Icons.Outlined.Close,
                        contentDescription = stringResource(R.string.action_close),
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun SubscriptionDto.statusLabel(): String = when (status.uppercase()) {
    "ACTIVE" -> stringResource(R.string.subscription_status_active)
    "GRACE_PERIOD" -> stringResource(R.string.subscription_status_grace)
    "PAUSED" -> stringResource(R.string.subscription_status_paused)
    "ON_HOLD" -> stringResource(R.string.subscription_status_on_hold)
    "CANCELED" -> stringResource(R.string.subscription_status_canceled)
    "EXPIRED" -> stringResource(R.string.subscription_status_expired)
    else -> stringResource(R.string.subscription_status_active)
}
