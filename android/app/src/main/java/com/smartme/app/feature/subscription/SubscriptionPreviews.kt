package com.smartme.app.feature.subscription

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.feature.common.UiText

@ScreenPreviews
@Composable
private fun SubscriptionFreePreview() {
    PreviewContainer {
        SubscriptionContent(
            state = SubscriptionUiState(
                loading = false,
                plans = SubscriptionSamples.plans,
                me = SubscriptionSamples.freeMe,
                selectedPlanId = SubscriptionSamples.yearlyPlan.id,
            ),
            onSelectPlan = {},
            onSubscribe = {},
            onRestore = {},
            onManage = {},
            onDismissMessage = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun SubscriptionPremiumPreview() {
    PreviewContainer {
        SubscriptionContent(
            state = SubscriptionUiState(
                loading = false,
                plans = SubscriptionSamples.plans,
                me = SubscriptionSamples.premiumMe,
                selectedPlanId = SubscriptionSamples.monthlyPlan.id,
            ),
            onSelectPlan = {},
            onSubscribe = {},
            onRestore = {},
            onManage = {},
            onDismissMessage = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun SubscriptionBillingDisabledPreview() {
    PreviewContainer {
        SubscriptionContent(
            state = SubscriptionUiState(
                loading = false,
                plans = SubscriptionSamples.plans,
                me = SubscriptionSamples.freeMe.copy(billingEnabled = false),
                selectedPlanId = SubscriptionSamples.monthlyPlan.id,
                actionMessage = UiText.Plain("Purchases are unavailable right now."),
            ),
            onSelectPlan = {},
            onSubscribe = {},
            onRestore = {},
            onManage = {},
            onDismissMessage = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun PurchaseSuccessPreview() {
    PreviewContainer {
        PurchaseResultContent(
            status = PurchaseResultStatus.Success,
            reason = null,
            onDone = {},
            onTryAgain = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun PurchasePendingPreview() {
    PreviewContainer {
        PurchaseResultContent(
            status = PurchaseResultStatus.Pending,
            reason = null,
            onDone = {},
            onTryAgain = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun PurchaseFailurePreview() {
    PreviewContainer {
        PurchaseResultContent(
            status = PurchaseResultStatus.Failure,
            reason = "Check your connection and try again.",
            onDone = {},
            onTryAgain = {},
        )
    }
}
