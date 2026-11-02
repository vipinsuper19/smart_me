package com.smartme.app.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.ApiExecutor
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.SmartMeApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class BackendStatus(
    val service: String,
    val version: String?,
)

/**
 * Task 12 connectivity check. Proves the network layer, error mapping and the
 * shared loading/error components end to end; Task 14 replaces it with the real
 * home payload.
 */
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val api: SmartMeApi,
    private val apiExecutor: ApiExecutor,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<BackendStatus>>(UiState.Loading)
    val state: StateFlow<UiState<BackendStatus>> = _state.asStateFlow()

    init {
        checkConnection()
    }

    fun checkConnection() {
        viewModelScope.launch {
            _state.value = UiState.Loading
            _state.value = when (val result = apiExecutor.call { api.health() }) {
                is ApiResult.Success -> {
                    val health = result.data
                    if (health.status.equals("ok", ignoreCase = true)) {
                        UiState.Content(
                            BackendStatus(
                                service = health.service ?: "SmartMe API",
                                version = health.version,
                            ),
                        )
                    } else {
                        UiState.Error(
                            message = "The API reported status \"${health.status}\".",
                            code = "UNHEALTHY",
                        )
                    }
                }

                is ApiResult.Failure -> UiState.Error(
                    message = result.error.message,
                    code = result.error.code,
                )
            }
        }
    }
}
