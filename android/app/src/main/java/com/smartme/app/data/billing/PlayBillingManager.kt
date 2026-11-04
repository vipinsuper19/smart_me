package com.smartme.app.data.billing

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.queryProductDetails
import com.android.billingclient.api.queryPurchasesAsync
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.concurrent.atomic.AtomicReference
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

/** Why the Play flow could not start or complete. Mapped to UI copy by callers. */
enum class BillingFailure {
    UNAVAILABLE,
    PRODUCT_NOT_FOUND,
    FLOW_FAILED,
    NETWORK,
    TIMEOUT,
    UNKNOWN,
}

/** The result of opening the Play purchase flow for one subscription product. */
sealed interface BillingPurchaseOutcome {
    data class Purchased(val productId: String, val purchaseToken: String) : BillingPurchaseOutcome
    data class Pending(val productId: String) : BillingPurchaseOutcome
    data object Canceled : BillingPurchaseOutcome
    data class Failed(val reason: BillingFailure) : BillingPurchaseOutcome
}

/** Active store purchases returned by a restore query. */
sealed interface BillingRestoreOutcome {
    data class Success(val purchases: List<StorePurchase>) : BillingRestoreOutcome
    data class Failed(val reason: BillingFailure) : BillingRestoreOutcome
}

data class StorePurchase(val productId: String, val purchaseToken: String)

/**
 * Thin wrapper around Google Play Billing.
 *
 * The client only opens the store flow and reports tokens. It never grants
 * premium access: every purchase token is sent to the backend, which verifies it
 * with Google Play and returns the authoritative entitlement.
 */
@Singleton
class PlayBillingManager @Inject constructor(@ApplicationContext context: Context) {

    private val appContext = context.applicationContext
    private val purchaseContinuation =
        AtomicReference<CancellableContinuation<BillingPurchaseOutcome>?>(null)

    private val purchasesUpdatedListener = PurchasesUpdatedListener { result, purchases ->
        val continuation = purchaseContinuation.getAndSet(null)
        if (continuation != null && continuation.isActive) {
            continuation.resume(outcomeFor(result, purchases.orEmpty()))
        }
    }

    private val client: BillingClient by lazy {
        BillingClient.newBuilder(appContext)
            .setListener(purchasesUpdatedListener)
            .enableAutoServiceReconnection()
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .enablePrepaidPlans()
                    .build(),
            )
            .build()
    }

    /**
     * Opens the Play purchase sheet for [productId] and waits for the store
     * callback. [obfuscatedAccountId] lets an RTDN arriving before verification
     * be attributed to the same learner.
     */
    suspend fun purchase(
        activity: Activity,
        productId: String,
        obfuscatedAccountId: String,
    ): BillingPurchaseOutcome {
        purchaseContinuation.getAndSet(null)?.cancel()
        return try {
            withTimeout(PURCHASE_TIMEOUT_MILLIS) {
                withContext(Dispatchers.Main) {
                    val billing = ensureConnected()
                    val details = queryProductDetails(billing, productId)
                    val offerToken = details.subscriptionOfferDetails
                        ?.firstOrNull { !it.offerToken.isNullOrBlank() }
                        ?.offerToken
                        ?: throw BillingException(BillingFailure.PRODUCT_NOT_FOUND)
                    val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(details)
                        .setOfferToken(offerToken)
                        .build()
                    val flowParams = BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(listOf(productParams))
                        .setObfuscatedAccountId(obfuscatedAccountId)
                        .build()

                    // Listen before launching: Play can deliver the update very
                    // quickly, and a late continuation would be lost.
                    suspendCancellableCoroutine { continuation ->
                        purchaseContinuation.set(continuation)
                        continuation.invokeOnCancellation {
                            purchaseContinuation.compareAndSet(continuation, null)
                        }

                        val launch = billing.launchBillingFlow(activity, flowParams)
                        if (launch.responseCode != BillingClient.BillingResponseCode.OK &&
                            purchaseContinuation.compareAndSet(continuation, null) &&
                            continuation.isActive
                        ) {
                            continuation.resume(
                                BillingPurchaseOutcome.Failed(mapResponse(launch.responseCode)),
                            )
                        }
                    }
                }
            }
        } catch (timeout: TimeoutCancellationException) {
            BillingPurchaseOutcome.Failed(BillingFailure.TIMEOUT)
        } catch (failure: BillingException) {
            BillingPurchaseOutcome.Failed(failure.reason)
        } catch (unexpected: Exception) {
            BillingPurchaseOutcome.Failed(BillingFailure.UNKNOWN)
        }
    }

    /** Returns purchases Play still considers active for this account. */
    suspend fun restore(): BillingRestoreOutcome = try {
        withContext(Dispatchers.Main) {
            val billing = ensureConnected()
            val params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
            val result = billing.queryPurchasesAsync(params)
            if (result.billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                BillingRestoreOutcome.Failed(mapResponse(result.billingResult.responseCode))
            } else {
                val purchases = result.purchasesList
                    .filter { it.purchaseState == Purchase.PurchaseState.PURCHASED }
                    .mapNotNull { purchase ->
                        purchase.products.firstOrNull()?.let { productId ->
                            StorePurchase(productId, purchase.purchaseToken)
                        }
                    }
                BillingRestoreOutcome.Success(purchases)
            }
        }
    } catch (failure: BillingException) {
        BillingRestoreOutcome.Failed(failure.reason)
    } catch (unexpected: Exception) {
        BillingRestoreOutcome.Failed(BillingFailure.UNKNOWN)
    }

    private suspend fun ensureConnected(): BillingClient {
        val billing = client
        if (billing.isReady) return billing

        val result = suspendCancellableCoroutine<BillingResult> { continuation ->
            billing.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(billingResult: BillingResult) {
                    if (continuation.isActive) continuation.resume(billingResult)
                }

                override fun onBillingServiceDisconnected() {
                    // Auto service reconnection is enabled; the next call retries.
                }
            })
        }
        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
            throw BillingException(mapResponse(result.responseCode))
        }
        return billing
    }

    private suspend fun queryProductDetails(
        billing: BillingClient,
        productId: String,
    ): ProductDetails {
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                listOf(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(productId)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build(),
                ),
            )
            .build()

        val result = billing.queryProductDetails(params)
        if (result.billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
            throw BillingException(mapResponse(result.billingResult.responseCode))
        }
        return result.productDetailsList.orEmpty().firstOrNull { it.productId == productId }
            ?: throw BillingException(BillingFailure.PRODUCT_NOT_FOUND)
    }

    private fun outcomeFor(
        result: BillingResult,
        purchases: List<Purchase>,
    ): BillingPurchaseOutcome = when (result.responseCode) {
        BillingClient.BillingResponseCode.OK -> {
            val purchased = purchases.firstOrNull {
                it.purchaseState == Purchase.PurchaseState.PURCHASED &&
                    it.products.isNotEmpty()
            }
            val pending = purchases.firstOrNull {
                it.purchaseState == Purchase.PurchaseState.PENDING
            }
            when {
                purchased != null -> BillingPurchaseOutcome.Purchased(
                    productId = purchased.products.first(),
                    purchaseToken = purchased.purchaseToken,
                )
                pending != null -> BillingPurchaseOutcome.Pending(
                    productId = pending.products.firstOrNull().orEmpty(),
                )
                else -> BillingPurchaseOutcome.Failed(BillingFailure.UNKNOWN)
            }
        }
        BillingClient.BillingResponseCode.USER_CANCELED -> BillingPurchaseOutcome.Canceled
        else -> BillingPurchaseOutcome.Failed(mapResponse(result.responseCode))
    }

    private fun mapResponse(responseCode: Int): BillingFailure = when (responseCode) {
        BillingClient.BillingResponseCode.BILLING_UNAVAILABLE,
        BillingClient.BillingResponseCode.SERVICE_DISCONNECTED,
        BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE,
        -> BillingFailure.UNAVAILABLE

        BillingClient.BillingResponseCode.ITEM_UNAVAILABLE,
        BillingClient.BillingResponseCode.ITEM_NOT_OWNED,
        -> BillingFailure.PRODUCT_NOT_FOUND

        BillingClient.BillingResponseCode.NETWORK_ERROR -> BillingFailure.NETWORK
        else -> BillingFailure.FLOW_FAILED
    }

    private class BillingException(val reason: BillingFailure) : Exception()

    private companion object {
        const val PURCHASE_TIMEOUT_MILLIS = 5 * 60 * 1000L
    }
}
