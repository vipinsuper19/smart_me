package com.smartme.app.feature.explore

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
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ExploreUiState(
    val paths: UiState<List<LearningPathDto>> = UiState.Loading,
    val query: String = "",
) {
    /** Search is local until the content API adds full-text search. */
    val visiblePaths: List<LearningPathDto>
        get() {
            val items = (paths as? UiState.Content)?.data.orEmpty()
            val term = query.trim()
            if (term.isEmpty()) return items
            return items.filter { path ->
                path.title.contains(term, ignoreCase = true) ||
                    path.description.contains(term, ignoreCase = true)
            }
        }
}

@HiltViewModel
class ExploreViewModel @Inject constructor(
    private val repository: LearningRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ExploreUiState())
    val state: StateFlow<ExploreUiState> = _state.asStateFlow()

    private var hasResumedOnce = false

    init {
        load()
    }

    /** Refreshes catalogue progress after returning from a path or lesson. */
    fun onResumed() {
        if (!hasResumedOnce) {
            hasResumedOnce = true
            return
        }
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.update { state ->
                if (state.paths is UiState.Content) state else state.copy(paths = UiState.Loading)
            }
            _state.update {
                when (val result = repository.learningPaths()) {
                    is ApiResult.Success -> it.copy(
                        paths = if (result.data.isEmpty()) {
                            UiState.Empty
                        } else {
                            UiState.Content(result.data)
                        },
                    )

                    is ApiResult.Failure -> it.copy(
                        paths = UiState.Error(result.error.message, result.error.code),
                    )
                }
            }
        }
    }

    fun onQueryChange(value: String) {
        _state.update { it.copy(query = value) }
    }
}
