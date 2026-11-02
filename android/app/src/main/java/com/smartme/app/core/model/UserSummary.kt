package com.smartme.app.core.model

/** The signed-in learner, as far as the app needs it outside the profile screens. */
data class UserSummary(
    val id: String,
    val email: String,
    val name: String?,
    val avatarUrl: String?,
    val onboardingCompleted: Boolean,
) {
    /** Falls back to the local part of the email so greetings never show "null". */
    val displayName: String
        get() = name?.takeIf { it.isNotBlank() } ?: email.substringBefore('@')
}
