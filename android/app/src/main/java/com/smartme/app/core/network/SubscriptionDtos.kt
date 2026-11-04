package com.smartme.app.core.network

import kotlinx.serialization.Serializable

// Wire shapes for docs/API-SUBSCRIPTIONS.md. The server is the only authority
// for premium access; these DTOs only describe what it decided.

@Serializable
data class SubscriptionPlanDto(
    val id: String = "",
    val code: String = "",
    val name: String = "",
    val billingPeriod: String = "MONTHLY",
    val priceInPaise: Int = 0,
    val currency: String = "INR",
    val googlePlayProductId: String? = null,
    val benefits: List<String> = emptyList(),
    val order: Int = 0,
)

@Serializable
data class SubscriptionPlansDto(val items: List<SubscriptionPlanDto> = emptyList())

@Serializable
data class EntitlementDto(
    val tier: String = "FREE",
    val isActive: Boolean = false,
    val source: String? = null,
    val validUntil: String? = null,
    val premiumActive: Boolean = false,
)

@Serializable
data class SubscriptionPlanSummaryDto(
    val id: String = "",
    val code: String = "",
    val name: String = "",
    val billingPeriod: String = "MONTHLY",
    val priceInPaise: Int = 0,
    val currency: String = "INR",
)

@Serializable
data class SubscriptionDto(
    val id: String = "",
    val status: String = "ACTIVE",
    val provider: String = "GOOGLE_PLAY",
    val plan: SubscriptionPlanSummaryDto = SubscriptionPlanSummaryDto(),
    val autoRenewing: Boolean = false,
    val cancelAtPeriodEnd: Boolean = false,
    val startedAt: String? = null,
    val currentPeriodStart: String? = null,
    val currentPeriodEnd: String? = null,
    val canceledAt: String? = null,
    val endedAt: String? = null,
    val lastVerifiedAt: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

@Serializable
data class PurchaseSummaryDto(
    val id: String = "",
    val productId: String = "",
    val orderId: String? = null,
    val status: String = "VERIFIED",
    val purchaseTime: String? = null,
    val priceInPaise: Int? = null,
    val currency: String = "INR",
    val verifiedAt: String? = null,
)

@Serializable
data class SubscriptionMeDto(
    val entitlement: EntitlementDto = EntitlementDto(),
    val subscription: SubscriptionDto? = null,
    val purchases: List<PurchaseSummaryDto> = emptyList(),
    val billingEnabled: Boolean = false,
)

@Serializable
data class VerifyPurchaseRequest(
    val productId: String,
    val purchaseToken: String,
)

@Serializable
data class VerifyPurchaseDto(
    val subscription: SubscriptionDto? = null,
    val entitlement: EntitlementDto = EntitlementDto(),
    val restored: Boolean = false,
)

@Serializable
data class RestorePurchaseEntryDto(
    val productId: String,
    val purchaseToken: String,
)

@Serializable
data class RestorePurchasesRequest(val purchases: List<RestorePurchaseEntryDto>)

@Serializable
data class RestoreFailureDto(
    val productId: String = "",
    val code: String = "",
)

@Serializable
data class RestorePurchasesDto(
    val entitlement: EntitlementDto = EntitlementDto(),
    val subscription: SubscriptionDto? = null,
    val restoredCount: Int = 0,
    val failures: List<RestoreFailureDto> = emptyList(),
    val billingEnabled: Boolean = false,
)
