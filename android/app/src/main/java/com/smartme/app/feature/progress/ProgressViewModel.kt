package com.smartme.app.feature.progress

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.AchievementsDto
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.ProgressOverviewDto
import com.smartme.app.core.network.WeeklyProgressDto
import com.smartme.app.data.progress.ProgressRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The overview is the dashboard's spine; the weekly chart is required alongside it. */
data class ProgressData(
    val overview: ProgressOverviewDto,
    val weekly: WeeklyProgressDto,
    val achievements: AchievementsDto? = null,
)

@HiltViewModel
class ProgressViewModel @Inject constructor(
    private val repository: ProgressRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<ProgressData>>(UiState.Loading)
    val state: StateFlow<UiState<ProgressData>> = _state.asStateFlow()

    private var hasResumedOnce = false

    init {
        load()
    }

    /** Refreshes the dashboard after a lesson or quiz was completed. */
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

            val overview = repository.overview()
            if (overview is ApiResult.Failure) {
                _state.value = UiState.Error(
                    message = overview.error.message,
                    code = overview.error.code,
                )
                return@launch
            }

            val weekly = repository.weekly()
            if (weekly is ApiResult.Failure) {
                _state.value = UiState.Error(
                    message = weekly.error.message,
                    code = weekly.error.code,
                )
                return@launch
            }

            val achievements = coroutineScope {
                val deferred = async { repository.achievements() }
                (deferred.await() as? ApiResult.Success)?.data
            }

            _state.value = UiState.Content(
                ProgressData(
                    overview = (overview as ApiResult.Success).data,
                    weekly = (weekly as ApiResult.Success).data,
                    achievements = achievements,
                ),
            )
        }
    }
}
