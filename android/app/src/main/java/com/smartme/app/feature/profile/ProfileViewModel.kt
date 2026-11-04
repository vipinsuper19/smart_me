package com.smartme.app.feature.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.ProfileDto
import com.smartme.app.data.account.AccountRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val repository: AccountRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<ProfileDto>>(UiState.Loading)
    val state: StateFlow<UiState<ProfileDto>> = _state.asStateFlow()

    private var hasResumedOnce = false

    init {
        load()
    }

    /** Refreshes after returning from the edit screen. */
    fun onResumed() {
        if (!hasResumedOnce) {
            hasResumedOnce = true
            return
        }
        load()
    }

    fun load() {
        viewModelScope.launch {
            if (_state.value !is UiState.Content) {
                _state.value = UiState.Loading
            }
            when (val result = repository.profile()) {
                is ApiResult.Success -> _state.value = UiState.Content(result.data)
                is ApiResult.Failure -> _state.value = UiState.Error(
                    message = result.error.message,
                    code = result.error.code,
                )
            }
        }
    }
}
