package com.smartme.app.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.ContinueLearningItemDto
import com.smartme.app.core.network.GamificationSummaryDto
import com.smartme.app.core.network.RecommendedLessonDto
import com.smartme.app.data.learning.LearningRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Everything the dashboard needs after a single refresh. */
data class HomeData(
    val summary: GamificationSummaryDto,
    val continueLearning: ContinueLearningItemDto?,
    val recommended: RecommendedLessonDto?,
)

/**
 * Loads the learner's gamification summary, the most recent unfinished lesson
 * and a recommendation. The summary is required; the two content cards degrade
 * to absent on their own failures so one missing recommendation never hides the
 * streak and goal.
 */
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val repository: LearningRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<HomeData>>(UiState.Loading)
    val state: StateFlow<UiState<HomeData>> = _state.asStateFlow()

    private var hasResumedOnce = false

    init {
        load()
    }

    /** Refreshes streak/XP/continue cards after returning from a lesson. */
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
            val summary = repository.gamificationSummary()
            if (summary is ApiResult.Failure) {
                _state.value = UiState.Error(
                    message = summary.error.message,
                    code = summary.error.code,
                )
                return@launch
            }

            val summaryData = (summary as ApiResult.Success).data
            val (continueLearning, recommended) = coroutineScope {
                val continueDeferred = async { repository.continueLearning() }
                val recommendedDeferred = async { repository.recommendedLesson() }
                (continueDeferred.await() as? ApiResult.Success)?.data to
                    (recommendedDeferred.await() as? ApiResult.Success)?.data
            }

            _state.value = UiState.Content(
                HomeData(
                    summary = summaryData,
                    continueLearning = continueLearning,
                    recommended = recommended,
                ),
            )
        }
    }
}
