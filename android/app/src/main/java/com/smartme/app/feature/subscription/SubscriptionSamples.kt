package com.smartme.app.feature.subscription

import com.smartme.app.core.network.EntitlementDto
import com.smartme.app.core.network.SubscriptionDto
import com.smartme.app.core.network.SubscriptionMeDto
import com.smartme.app.core.network.SubscriptionPlanDto
import com.smartme.app.core.network.SubscriptionPlanSummaryDto

/** Fixtures for the subscription and purchase-result previews. */
object SubscriptionSamples {

    val monthlyPlan = SubscriptionPlanDto(
        id = "plan-monthly",
        code = "premium-monthly",
        name = "Premium Monthly",
        billingPeriod = "MONTHLY",
        priceInPaise = 24900,
        currency = "INR",
        googlePlayProductId = "smartme_premium_monthly",
        benefits = listOf(
            "Full course library",
            "Premium practice sets",
            "Expanded audio access",
        ),
        order = 1,
    )

    val yearlyPlan = SubscriptionPlanDto(
        id = "plan-yearly",
        code = "premium-annual",
        name = "Premium Annual",
        billingPeriod = "YEARLY",
        priceInPaise = 179900,
        currency = "INR",
        googlePlayProductId = "smartme_premium_annual",
        benefits = listOf(
            "Full course library",
            "Premium practice sets",
            "Expanded audio access",
            "Two months free compared with monthly",
        ),
        order = 2,
    )

    val plans = listOf(monthlyPlan, yearlyPlan)

    val freeMe = SubscriptionMeDto(
        entitlement = EntitlementDto(
            tier = "FREE",
            isActive = false,
            source = null,
            validUntil = null,
            premiumActive = false,
        ),
        subscription = null,
        purchases = emptyList(),
        billingEnabled = true,
    )

    val premiumMe = SubscriptionMeDto(
        entitlement = EntitlementDto(
            tier = "PREMIUM",
            isActive = true,
            source = "SUBSCRIPTION",
            validUntil = "2026-12-04T10:00:00.000Z",
            premiumActive = true,
        ),
        subscription = SubscriptionDto(
            id = "sub-1",
            status = "ACTIVE",
            provider = "GOOGLE_PLAY",
            plan = SubscriptionPlanSummaryDto(
                id = monthlyPlan.id,
                code = monthlyPlan.code,
                name = monthlyPlan.name,
                billingPeriod = monthlyPlan.billingPeriod,
                priceInPaise = monthlyPlan.priceInPaise,
                currency = monthlyPlan.currency,
            ),
            autoRenewing = true,
            cancelAtPeriodEnd = false,
            startedAt = "2026-11-04T10:00:00.000Z",
            currentPeriodStart = "2026-11-04T10:00:00.000Z",
            currentPeriodEnd = "2026-12-04T10:00:00.000Z",
            lastVerifiedAt = "2026-11-04T10:00:05.000Z",
            createdAt = "2026-11-04T10:00:05.000Z",
            updatedAt = "2026-11-04T10:00:05.000Z",
        ),
        purchases = emptyList(),
        billingEnabled = true,
    )
}

/** Current plan name for a premium subscription, or null when there is none. */
fun SubscriptionMeDto.currentPlanName(): String? =
    subscription?.plan?.name?.takeIf { it.isNotBlank() } ?: if (premiumActive()) "Premium" else null

fun SubscriptionMeDto.premiumActive(): Boolean = entitlement.premiumActive
