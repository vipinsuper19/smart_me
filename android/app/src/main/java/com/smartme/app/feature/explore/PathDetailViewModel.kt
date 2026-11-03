package com.smartme.app.feature.explore

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.LearningPathDto
import com.smartme.app.data.learning.LearningRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PathDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val repository: LearningRepository,
) : ViewModel() {

    private val pathId: String = checkNotNull(savedStateHandle["pathId"])

    private val _state = MutableStateFlow<UiState<LearningPathDto>>(UiState.Loading)
    val state: StateFlow<UiState<LearningPathDto>> = _state.asStateFlow()

    private var hasResumedOnce = false

    init {
        load()
    }

    /** Refreshes path progress after returning from a course or lesson. */
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
            _state.value = when (val result = repository.learningPath(pathId)) {
                is ApiResult.Success -> UiState.Content(result.data)
                is ApiResult.Failure -> UiState.Error(result.error.message, result.error.code)
            }
        }
    }
}
