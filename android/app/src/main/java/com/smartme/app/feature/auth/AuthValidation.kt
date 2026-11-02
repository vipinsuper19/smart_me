package com.smartme.app.feature.auth

import androidx.annotation.StringRes
import com.smartme.app.R

/**
 * Client-side mirror of the backend's auth rules.
 *
 * The API remains the authority; these checks only keep obvious mistakes from
 * making a round trip. Resource ids are returned so screens can render localised
 * copy and tests can assert the exact rule that failed.
 */
object AuthValidation {

    const val MIN_PASSWORD_LENGTH = 8
    const val MAX_PASSWORD_LENGTH = 128
    const val MAX_NAME_LENGTH = 80

    private val EMAIL = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
    private val HAS_LETTER = Regex("[A-Za-z]")
    private val HAS_DIGIT = Regex("\\d")

    @StringRes
    fun emailError(email: String?): Int? = when {
        email.isNullOrBlank() -> R.string.auth_error_email_required
        !EMAIL.matches(email.trim()) -> R.string.auth_error_email_invalid
        else -> null
    }

    @StringRes
    fun passwordError(password: String): Int? = when {
        password.isEmpty() -> R.string.auth_error_password_required
        password.length < MIN_PASSWORD_LENGTH -> R.string.auth_error_password_length
        password.length > MAX_PASSWORD_LENGTH -> R.string.auth_error_password_too_long
        !HAS_LETTER.containsMatchIn(password) || !HAS_DIGIT.containsMatchIn(password) ->
            R.string.auth_error_password_complexity

        else -> null
    }

    @StringRes
    fun confirmPasswordError(password: String, confirmation: String): Int? = when {
        confirmation.isEmpty() -> R.string.auth_error_confirm_required
        confirmation != password -> R.string.auth_error_password_mismatch
        else -> null
    }

    @StringRes
    fun nameError(name: String): Int? =
        if (name.trim().length > MAX_NAME_LENGTH) R.string.auth_error_name_too_long else null
}
