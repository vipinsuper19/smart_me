package com.smartme.app.feature.progress

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.AchievementsDto
import com.smartme.app.core.network.ApiResult
import com.smartme.app.data.progress.ProgressRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AchievementsViewModel @Inject constructor(
    private val repository: ProgressRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<AchievementsDto>>(UiState.Loading)
    val state: StateFlow<UiState<AchievementsDto>> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            if (_state.value !is UiState.Content) {
                _state.value = UiState.Loading
            }
            when (val result = repository.achievements()) {
                is ApiResult.Success -> _state.value = if (result.data.items.isEmpty()) {
                    UiState.Empty
                } else {
                    UiState.Content(result.data)
                }

                is ApiResult.Failure -> _state.value = UiState.Error(
                    message = result.error.message,
                    code = result.error.code,
                )
            }
        }
    }
}
