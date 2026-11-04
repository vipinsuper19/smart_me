package com.smartme.app.feature.privacy

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.DeletionRequestDto
import com.smartme.app.data.account.AccountRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PrivacyUiState(
    val loading: Boolean = true,
    val loadError: String? = null,
    val request: DeletionRequestDto? = null,
    val requesting: Boolean = false,
    val requestError: String? = null,
    val justRequested: Boolean = false,
    val cancelling: Boolean = false,
    val cancelError: String? = null,
    val canceled: Boolean = false,
)

/**
 * Reads the account-deletion status and drives request/cancel.
 *
 * The backend revokes sessions as soon as a request is accepted, so the screen
 * shows the server's scheduled date and then sends the learner back to sign in.
 */
@HiltViewModel
class PrivacyViewModel @Inject constructor(
    private val repository: AccountRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(PrivacyUiState())
    val state: StateFlow<PrivacyUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, loadError = null)
            when (val result = repository.deletionRequest()) {
                is ApiResult.Success -> _state.value = _state.value.copy(
                    loading = false,
                    request = result.data,
                )

                is ApiResult.Failure -> _state.value = _state.value.copy(
                    loading = false,
                    loadError = result.error.message,
                )
            }
        }
    }

    fun requestDeletion(reason: String?) {
        val current = _state.value
        if (current.requesting) return

        viewModelScope.launch {
            _state.value = current.copy(
                requesting = true,
                requestError = null,
                canceled = false,
            )
            when (val result = repository.requestDeletion(reason)) {
                is ApiResult.Success -> _state.value = _state.value.copy(
                    requesting = false,
                    request = result.data,
                    justRequested = true,
                )

                is ApiResult.Failure -> _state.value = _state.value.copy(
                    requesting = false,
                    requestError = result.error.message,
                )
            }
        }
    }

    fun cancelDeletion() {
        val current = _state.value
        if (current.cancelling) return

        viewModelScope.launch {
            _state.value = current.copy(cancelling = true, cancelError = null, canceled = false)
            when (val result = repository.cancelDeletion()) {
                is ApiResult.Success -> _state.value = _state.value.copy(
                    cancelling = false,
                    request = result.data.takeUnless { it.isPending },
                    canceled = true,
                )

                is ApiResult.Failure -> _state.value = _state.value.copy(
                    cancelling = false,
                    cancelError = result.error.message,
                )
            }
        }
    }

    /** Called once the learner has acknowledged the scheduled deletion. */
    fun acknowledgeRequest() {
        _state.value = _state.value.copy(justRequested = false)
    }
}
