package com.smartme.app.feature.lesson

import android.os.SystemClock
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.R
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.LessonCompletionDto
import com.smartme.app.core.network.LessonDetailDto
import com.smartme.app.core.network.LessonProgressDto
import com.smartme.app.data.learning.LearningRepository
import com.smartme.app.feature.common.UiText
import com.smartme.app.feature.learning.toLearningMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LessonUiState(
    val content: UiState<LessonDetailDto> = UiState.Loading,
    val completing: Boolean = false,
    val completion: LessonCompletionDto? = null,
    val message: UiText? = null,
    val saveFailed: Boolean = false,
) {
    val lesson: LessonDetailDto? get() = (content as? UiState.Content)?.data
    val isCompleted: Boolean get() = lesson?.progress?.isCompleted == true
}

/**
 * Lesson player state.
 *
 * Reading position is checkpointed with a short debounce while scrolling and
 * flushed when the screen pauses, so leaving the player never loses the last
 * block. Every progress write is fire-and-forget with a single inline failure
 * message; a transient network error must not interrupt reading.
 */
@HiltViewModel
class LessonViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val repository: LearningRepository,
) : ViewModel() {

    private val lessonId: String = checkNotNull(savedStateHandle["lessonId"])

    private val _state = MutableStateFlow(LessonUiState())
    val state: StateFlow<LessonUiState> = _state.asStateFlow()

    private var lastSavedPercent = 0
    private var lastSavedBlockOrder: Int? = null

    private var pendingPercent = 0
    private var pendingBlockOrder: Int? = null

    private var checkpointJob: Job? = null
    private var hasResumedOnce = false

    private var activityStartedAt = SystemClock.elapsedRealtime()
    private var reportedSeconds = 0

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            checkpointJob?.cancel()
            _state.update { state ->
                if (state.content is UiState.Content) state else state.copy(content = UiState.Loading)
            }

            when (val result = repository.lesson(lessonId)) {
                is ApiResult.Failure -> _state.update {
                    it.copy(content = UiState.Error(result.error.message, result.error.code))
                }

                is ApiResult.Success -> {
                    val lesson = result.data
                    startSession()
                    _state.update {
                        it.copy(
                            content = UiState.Content(lesson),
                            saveFailed = false,
                        )
                    }
                    // Record the visit and pick up the server's latest progress.
                    when (val started = repository.startLesson(lessonId)) {
                        is ApiResult.Success -> applyProgress(started.data)
                        is ApiResult.Failure -> Unit
                    }
                }
            }
        }
    }

    /** Called from `LifecycleResumeEffect`; refreshes after returning from the quiz. */
    fun onResumed() {
        if (!hasResumedOnce) {
            hasResumedOnce = true
            return
        }
        load()
    }

    fun onScrollChanged(blockOrder: Int, progressPercent: Int) {
        pendingBlockOrder = blockOrder
        pendingPercent = progressPercent
        if (checkpointJob?.isActive == true) return
        checkpointJob = viewModelScope.launch {
            delay(CHECKPOINT_DEBOUNCE_MS)
            checkpoint()
        }
    }

    /** Sends the last pending checkpoint now. Safe to call on every pause. */
    fun flushProgress() {
        checkpointJob?.cancel()
        checkpointJob = null
        if (pendingBlockOrder == null && pendingPercent <= lastSavedPercent) return
        viewModelScope.launch { checkpoint() }
    }

    fun complete() {
        val current = _state.value
        if (current.completing || current.completion != null) return
        val lesson = current.lesson ?: return
        if (lesson.requiresQuiz && lesson.quiz?.passed != true) {
            _state.update { it.copy(message = UiText.Resource(R.string.lesson_quiz_required_message)) }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(completing = true) }
            flushPendingBlocking()
            when (val result = repository.completeLesson(lessonId)) {
                is ApiResult.Success -> _state.update {
                    it.copy(
                        completing = false,
                        completion = result.data,
                        content = it.content.withCompleted(result.data),
                    )
                }

                is ApiResult.Failure -> _state.update {
                    it.copy(
                        completing = false,
                        message = result.error.toLearningMessage(),
                    )
                }
            }
        }
    }

    fun dismissCompletion() {
        _state.update { it.copy(completion = null) }
    }

    fun onSaveErrorShown() {
        _state.update { it.copy(saveFailed = false) }
    }

    fun onMessageShown() {
        _state.update { it.copy(message = null) }
    }

    private suspend fun checkpoint() {
        val order = pendingBlockOrder ?: return
        val percent = pendingPercent.coerceIn(0, 100)
        val elapsed = elapsedSecondsSinceLastReport()
        val movedPercent = percent > lastSavedPercent
        val movedBlock = order != lastSavedBlockOrder
        if (!movedPercent && !movedBlock && elapsed <= 0) return

        val result = repository.updateLessonProgress(
            lessonId = lessonId,
            progressPercent = percent,
            lastBlockOrder = order,
            timeSpentSeconds = elapsed.takeIf { it > 0 },
        )
        when (result) {
            is ApiResult.Success -> {
                lastSavedPercent = result.data.progressPercent
                lastSavedBlockOrder = result.data.lastBlockOrder
                _state.update { it.copy(saveFailed = false) }
            }

            is ApiResult.Failure -> _state.update { it.copy(saveFailed = true) }
        }
    }

    private suspend fun flushPendingBlocking() {
        checkpointJob?.cancel()
        checkpointJob = null
        pendingBlockOrder?.let { checkpoint() }
    }

    private fun elapsedSecondsSinceLastReport(): Int {
        val elapsedMs = SystemClock.elapsedRealtime() - activityStartedAt
        val elapsedSeconds = (elapsedMs / 1000).toInt()
        val delta = (elapsedSeconds - reportedSeconds).coerceIn(0, MAX_REPORTED_SECONDS)
        if (delta > 0) reportedSeconds = elapsedSeconds
        return delta
    }

    private fun startSession() {
        activityStartedAt = SystemClock.elapsedRealtime()
        reportedSeconds = 0
    }

    private fun applyProgress(progress: LessonProgressDto) {
        lastSavedPercent = progress.progressPercent
        lastSavedBlockOrder = progress.lastBlockOrder
        pendingPercent = progress.progressPercent
        pendingBlockOrder = progress.lastBlockOrder
        _state.update { state ->
            val lesson = state.lesson ?: return@update state
            state.copy(content = UiState.Content(lesson.copy(progress = progress)))
        }
    }

    private fun UiState<LessonDetailDto>.withCompleted(
        completion: LessonCompletionDto,
    ): UiState<LessonDetailDto> {
        val lesson = (this as? UiState.Content)?.data ?: return this
        val progress = LessonProgressDto(
            lessonId = lesson.id,
            status = "COMPLETED",
            progressPercent = 100,
            lastBlockOrder = completion.lastBlockOrder ?: lesson.progress?.lastBlockOrder,
            startedAt = completion.startedAt ?: lesson.progress?.startedAt,
            lastAccessedAt = completion.lastAccessedAt ?: lesson.progress?.lastAccessedAt,
            completedAt = completion.completedAt,
            timeSpentSeconds = completion.timeSpentSeconds,
        )
        return UiState.Content(lesson.copy(progress = progress))
    }

    private companion object {
        const val CHECKPOINT_DEBOUNCE_MS = 1_200L
        const val MAX_REPORTED_SECONDS = 3_600
    }
}
