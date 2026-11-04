package com.smartme.app.data.subscription

import com.smartme.app.core.network.ApiExecutor
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.RestorePurchaseEntryDto
import com.smartme.app.core.network.RestorePurchasesDto
import com.smartme.app.core.network.RestorePurchasesRequest
import com.smartme.app.core.network.SmartMeApi
import com.smartme.app.core.network.SubscriptionMeDto
import com.smartme.app.core.network.SubscriptionPlanDto
import com.smartme.app.core.network.VerifyPurchaseDto
import com.smartme.app.core.network.VerifyPurchaseRequest
import javax.inject.Inject
import javax.inject.Singleton

/** Plans, server entitlements and purchase verification. */
@Singleton
class SubscriptionRepository @Inject constructor(
    private val api: SmartMeApi,
    private val apiExecutor: ApiExecutor,
) {

    suspend fun plans(): ApiResult<List<SubscriptionPlanDto>> = apiExecutor.call {
        api.subscriptionPlans().items.sortedBy { it.order }
    }

    suspend fun me(): ApiResult<SubscriptionMeDto> = apiExecutor.call {
        api.subscriptionMe()
    }

    suspend fun verifyPurchase(productId: String, purchaseToken: String): ApiResult<VerifyPurchaseDto> =
        apiExecutor.call {
            api.verifyPurchase(VerifyPurchaseRequest(productId, purchaseToken))
        }

    suspend fun restore(
        purchases: List<RestorePurchaseEntryDto>,
    ): ApiResult<RestorePurchasesDto> = apiExecutor.call {
        api.restorePurchases(RestorePurchasesRequest(purchases))
    }
}
