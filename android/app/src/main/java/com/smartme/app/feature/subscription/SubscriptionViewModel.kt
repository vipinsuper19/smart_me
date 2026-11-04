package com.smartme.app.feature.subscription

import android.app.Activity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.R
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.EntitlementDto
import com.smartme.app.core.network.RestorePurchaseEntryDto
import com.smartme.app.core.network.SubscriptionMeDto
import com.smartme.app.core.network.SubscriptionPlanDto
import com.smartme.app.data.billing.BillingFailure
import com.smartme.app.data.billing.BillingPurchaseOutcome
import com.smartme.app.data.billing.BillingRestoreOutcome
import com.smartme.app.data.billing.PlayBillingManager
import com.smartme.app.data.subscription.SubscriptionRepository
import com.smartme.app.feature.common.UiText
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SubscriptionUiState(
    val loading: Boolean = true,
    val loadError: String? = null,
    val plans: List<SubscriptionPlanDto> = emptyList(),
    val me: SubscriptionMeDto? = null,
    val selectedPlanId: String? = null,
    val busy: Boolean = false,
    val actionMessage: UiText? = null,
)

sealed interface SubscriptionEvent {
    data object PurchaseSucceeded : SubscriptionEvent
    data object PurchasePending : SubscriptionEvent
    data class PurchaseFailed(
        val failure: BillingFailure?,
        val serverMessage: String? = null,
    ) : SubscriptionEvent
}

@HiltViewModel
class SubscriptionViewModel @Inject constructor(
    private val repository: SubscriptionRepository,
    private val billing: PlayBillingManager,
) : ViewModel() {

    private val _state = MutableStateFlow(SubscriptionUiState())
    val state: StateFlow<SubscriptionUiState> = _state.asStateFlow()

    private val eventChannel = Channel<SubscriptionEvent>(Channel.BUFFERED)
    val events = eventChannel.receiveAsFlow()

    private var hasResumedOnce = false
    private var reconciledOnce = false
    private var reconcileOnResume = false

    init {
        load()
    }

    fun onResumed() {
        if (!hasResumedOnce) {
            hasResumedOnce = true
            return
        }
        load(showLoading = false)
        if (reconcileOnResume) {
            viewModelScope.launch { reconcilePendingPurchases() }
        }
    }

    fun load(showLoading: Boolean = true) {
        viewModelScope.launch {
            if (showLoading || _state.value.me == null) {
                _state.value = _state.value.copy(loading = true, loadError = null)
            }

            val plans = repository.plans()
            if (plans is ApiResult.Failure) {
                _state.value = _state.value.copy(
                    loading = false,
                    loadError = plans.error.message,
                )
                return@launch
            }

            val me = repository.me()
            if (me is ApiResult.Failure) {
                _state.value = _state.value.copy(
                    loading = false,
                    loadError = me.error.message,
                )
                return@launch
            }

            val planList = (plans as ApiResult.Success).data
            val meData = (me as ApiResult.Success).data
            val selected = _state.value.selectedPlanId
                ?.takeIf { id -> planList.any { it.id == id } }
                ?: planList.firstOrNull()?.id

            _state.value = _state.value.copy(
                loading = false,
                loadError = null,
                plans = planList,
                me = meData,
                selectedPlanId = selected,
            )

            // A previous purchase may have completed in Play but failed backend
            // verification (for example the network dropped at the worst
            // moment). Reconcile silently once per process before the learner
            // has to tap "Restore".
            if (!reconciledOnce) {
                reconciledOnce = true
                reconcilePendingPurchases()
            }
        }
    }

    fun selectPlan(planId: String) {
        _state.value = _state.value.copy(
            selectedPlanId = planId,
            actionMessage = null,
        )
    }

    fun consumeActionMessage() {
        _state.value = _state.value.copy(actionMessage = null)
    }

    fun subscribe(activity: Activity?, userId: String) {
        val current = _state.value
        if (current.busy || current.loading) return
        val me = current.me ?: return
        if (activity == null) {
            _state.value = current.copy(
                actionMessage = UiText.Resource(R.string.subscription_billing_unavailable),
            )
            return
        }
        if (!me.billingEnabled) {
            _state.value = current.copy(
                actionMessage = UiText.Resource(R.string.subscription_billing_disabled),
            )
            return
        }
        val plan = current.plans.firstOrNull { it.id == current.selectedPlanId } ?: return
        val productId = plan.googlePlayProductId
        if (productId.isNullOrBlank()) {
            _state.value = current.copy(
                actionMessage = UiText.Resource(R.string.subscription_unavailable),
            )
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, actionMessage = null)
            when (val outcome = billing.purchase(activity, productId, userId)) {
                is BillingPurchaseOutcome.Purchased -> verifyPurchase(outcome)
                is BillingPurchaseOutcome.Pending -> {
                    refreshEntitlement()
                    _state.value = _state.value.copy(busy = false)
                    eventChannel.send(SubscriptionEvent.PurchasePending)
                }

                BillingPurchaseOutcome.Canceled -> {
                    _state.value = _state.value.copy(busy = false)
                }

                is BillingPurchaseOutcome.Failed -> {
                    _state.value = _state.value.copy(busy = false)
                    eventChannel.send(
                        SubscriptionEvent.PurchaseFailed(outcome.reason),
                    )
                }
            }
        }
    }

    fun restore() {
        val current = _state.value
        if (current.busy || current.loading) return
        if (current.me?.billingEnabled == false) {
            _state.value = current.copy(
                actionMessage = UiText.Resource(R.string.subscription_billing_disabled),
            )
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(busy = true, actionMessage = null)
            when (val store = billing.restore()) {
                is BillingRestoreOutcome.Failed -> {
                    _state.value = _state.value.copy(
                        busy = false,
                        actionMessage = UiText.Resource(billingFailureRes(store.reason)),
                    )
                }

                is BillingRestoreOutcome.Success -> {
                    if (store.purchases.isEmpty()) {
                        _state.value = _state.value.copy(
                            busy = false,
                            actionMessage = UiText.Resource(R.string.subscription_restore_none),
                        )
                        return@launch
                    }

                    val result = repository.restore(
                        store.purchases.map {
                            RestorePurchaseEntryDto(
                                productId = it.productId,
                                purchaseToken = it.purchaseToken,
                            )
                        },
                    )
                    when (result) {
                        is ApiResult.Success -> {
                            refreshEntitlement()
                            _state.value = _state.value.copy(
                                busy = false,
                                actionMessage = if (result.data.restoredCount > 0) {
                                    UiText.Resource(R.string.subscription_restore_success)
                                } else {
                                    UiText.Resource(R.string.subscription_restore_none)
                                },
                            )
                        }

                        is ApiResult.Failure -> _state.value = _state.value.copy(
                            busy = false,
                            actionMessage = UiText.Plain(result.error.message),
                        )
                    }
                }
            }
        }
    }

    private suspend fun verifyPurchase(outcome: BillingPurchaseOutcome.Purchased) {
        when (val result = repository.verifyPurchase(outcome.productId, outcome.purchaseToken)) {
            is ApiResult.Success -> {
                _state.value = _state.value.copy(
                    busy = false,
                    me = _state.value.me?.copy(
                        entitlement = result.data.entitlement,
                        subscription = result.data.subscription ?: _state.value.me?.subscription,
                    ),
                )
                refreshEntitlement()
                eventChannel.send(SubscriptionEvent.PurchaseSucceeded)
            }

            is ApiResult.Failure -> {
                // Play has taken the money; a failed verification is a retryable
                // server/network problem, not a failed purchase. Report it as
                // pending and reconcile on the next resume instead of telling
                // the learner the purchase failed.
                reconcileOnResume = true
                _state.value = _state.value.copy(busy = false)
                eventChannel.send(SubscriptionEvent.PurchasePending)
            }
        }
    }

    private suspend fun refreshEntitlement() {
        when (val me = repository.me()) {
            is ApiResult.Success -> _state.value = _state.value.copy(me = me.data)
            is ApiResult.Failure -> Unit
        }
    }

    /**
     * Re-sends every active Play purchase to the backend without surfacing
     * dialogs. Safe to call repeatedly because restore is idempotent.
     */
    private suspend fun reconcilePendingPurchases() {
        if (_state.value.me?.billingEnabled != true) return

        val store = billing.restore()
        if (store !is BillingRestoreOutcome.Success || store.purchases.isEmpty()) return

        val result = repository.restore(
            store.purchases.map {
                RestorePurchaseEntryDto(
                    productId = it.productId,
                    purchaseToken = it.purchaseToken,
                )
            },
        )
        if (result is ApiResult.Success) {
            reconcileOnResume = false
            refreshEntitlement()
        }
    }
}
