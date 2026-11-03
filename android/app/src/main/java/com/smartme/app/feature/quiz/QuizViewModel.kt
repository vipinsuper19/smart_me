package com.smartme.app.feature.quiz

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.smartme.app.R
import com.smartme.app.core.model.UiState
import com.smartme.app.core.network.ApiResult
import com.smartme.app.core.network.LessonQuizDto
import com.smartme.app.core.network.QuizAttemptDto
import com.smartme.app.core.network.QuizSubmissionDto
import com.smartme.app.data.learning.LearningRepository
import com.smartme.app.feature.common.UiText
import com.smartme.app.feature.learning.toLearningMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** A quiz plus the learner's resumable attempt and saved selections. */
data class QuizContent(
    val quiz: LessonQuizDto,
    val attempt: QuizAttemptDto,
    val answers: Map<String, String>,
    val lessonId: String,
)

data class QuizUiState(
    val content: UiState<QuizContent> = UiState.Loading,
    val index: Int = 0,
    val savingQuestionId: String? = null,
    val submitting: Boolean = false,
    val result: QuizSubmissionDto? = null,
    val lessonCompleted: Boolean = false,
    val message: UiText? = null,
) {
    val quizContent: QuizContent? get() = (content as? UiState.Content)?.data
    val isSaving: Boolean get() = savingQuestionId != null
}

/** Restores the selections saved on an interrupted attempt. */
internal fun savedAnswersToMap(
    answers: List<com.smartme.app.core.network.QuizSavedAnswerDto>,
): Map<String, String> = answers
    .mapNotNull { saved -> saved.selectedOptionId?.let { saved.questionId to it } }
    .toMap()

/**
 * Quiz flow from PRD §6.3 and docs/API-QUIZ.md.
 *
 * The attempt is created or resumed on entry, each answer is saved immediately
 * (last write wins server-side), and submission is scored on the server. A
 * passing submission also completes the lesson so a quiz-gated lesson never
 * asks the learner for a second confirmation.
 */
@HiltViewModel
class QuizViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val repository: LearningRepository,
) : ViewModel() {

    private val lessonId: String = checkNotNull(savedStateHandle["lessonId"])

    private val _state = MutableStateFlow(QuizUiState())
    val state: StateFlow<QuizUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.value = QuizUiState(content = UiState.Loading)

            when (val quizResult = repository.lessonQuiz(lessonId)) {
                is ApiResult.Failure -> {
                    _state.update {
                        it.copy(content = UiState.Error(quizResult.error.message, quizResult.error.code))
                    }
                    return@launch
                }

                is ApiResult.Success -> {
                    val quiz = quizResult.data
                    if (quiz.questions.isEmpty()) {
                        _state.update { it.copy(content = UiState.Empty) }
                        return@launch
                    }

                    when (val attemptResult = repository.startQuizAttempt(quiz.id)) {
                        is ApiResult.Failure -> _state.update {
                            it.copy(
                                content = UiState.Error(
                                    attemptResult.error.message,
                                    attemptResult.error.code,
                                ),
                            )
                        }

                        is ApiResult.Success -> _state.update {
                            it.copy(
                                content = UiState.Content(
                                    QuizContent(
                                        quiz = quiz,
                                        attempt = attemptResult.data.attempt,
                                        answers = savedAnswersToMap(attemptResult.data.answers),
                                        lessonId = lessonId,
                                    ),
                                ),
                                index = 0,
                            )
                        }
                    }
                }
            }
        }
    }

    fun selectAnswer(questionId: String, optionId: String) {
        val current = _state.value.quizContent ?: return
        if (_state.value.submitting || _state.value.savingQuestionId != null) return
        if (current.answers[questionId] == optionId) return

        val previous = current.answers[questionId]
        _state.update { state ->
            val content = state.quizContent ?: return@update state
            state.copy(
                content = UiState.Content(
                    content.copy(answers = content.answers + (questionId to optionId)),
                ),
                savingQuestionId = questionId,
            )
        }

        viewModelScope.launch {
            when (val result = repository.saveQuizAnswer(current.attempt.id, questionId, optionId)) {
                is ApiResult.Success -> _state.update { state ->
                    val content = state.quizContent ?: return@update state
                    state.copy(
                        content = UiState.Content(content.copy(attempt = result.data)),
                        savingQuestionId = null,
                    )
                }

                is ApiResult.Failure -> _state.update { state ->
                    val content = state.quizContent ?: return@update state
                    val restored = content.answers.toMutableMap().apply {
                        if (get(questionId) == optionId) {
                            if (previous == null) remove(questionId) else put(questionId, previous)
                        }
                    }
                    state.copy(
                        content = UiState.Content(content.copy(answers = restored)),
                        savingQuestionId = null,
                        message = UiText.Resource(R.string.quiz_answer_save_error),
                    )
                }
            }
        }
    }

    fun next() {
        val content = _state.value.quizContent ?: return
        _state.update {
            it.copy(index = (it.index + 1).coerceAtMost(content.quiz.questions.lastIndex))
        }
    }

    fun previous() {
        _state.update { it.copy(index = (it.index - 1).coerceAtLeast(0)) }
    }

    fun submit() {
        val current = _state.value
        val content = current.quizContent ?: return
        if (current.submitting || current.savingQuestionId != null) return

        viewModelScope.launch {
            _state.update { it.copy(submitting = true) }
            when (val result = repository.submitQuizAttempt(content.attempt.id)) {
                is ApiResult.Failure -> _state.update {
                    it.copy(
                        submitting = false,
                        message = result.error.toLearningMessage(),
                    )
                }

                is ApiResult.Success -> {
                    _state.update {
                        it.copy(
                            content = UiState.Content(
                                content.copy(attempt = result.data.attempt),
                            ),
                            submitting = false,
                            result = result.data,
                        )
                    }
                    if (result.data.attempt.passed) {
                        completeLessonAfterPass()
                    }
                }
            }
        }
    }

    fun retry() {
        val content = _state.value.quizContent ?: return
        val previous = _state.value
        viewModelScope.launch {
            _state.update { it.copy(content = UiState.Loading, result = null, lessonCompleted = false) }
            when (val result = repository.startQuizAttempt(content.quiz.id)) {
                is ApiResult.Success -> _state.update {
                    it.copy(
                        content = UiState.Content(
                            content.copy(
                                attempt = result.data.attempt,
                                answers = savedAnswersToMap(result.data.answers),
                            ),
                        ),
                        index = 0,
                    )
                }

                is ApiResult.Failure -> _state.value = previous.copy(
                    message = UiText.Resource(R.string.quiz_retry_error),
                )
            }
        }
    }

    fun onMessageShown() {
        _state.update { it.copy(message = null) }
    }

    private suspend fun completeLessonAfterPass() {
        when (val result = repository.completeLesson(lessonId)) {
            is ApiResult.Success -> _state.update { it.copy(lessonCompleted = true) }
            is ApiResult.Failure -> _state.update {
                it.copy(message = UiText.Resource(R.string.quiz_result_completion_error))
            }
        }
    }
}
