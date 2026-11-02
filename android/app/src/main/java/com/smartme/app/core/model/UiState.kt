package com.smartme.app.core.model

/**
 * The single loading/empty/error vocabulary used by every screen, so each feature
 * renders the shared state components instead of inventing its own booleans.
 */
sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Content<T>(val data: T) : UiState<T>
    data object Empty : UiState<Nothing>
    data class Error(val message: String, val code: String? = null) : UiState<Nothing>
}
