package com.smartme.app.navigation

import kotlinx.serialization.Serializable

// Auth gate routes. These are never mixed into the tab graph.
@Serializable
data object WelcomeRoute

@Serializable
data object OnboardingRoute

@Serializable
data object SignInRoute

@Serializable
data object CreateAccountRoute

@Serializable
data object RegisterRoute

// Main application tabs.
@Serializable
data object HomeRoute

@Serializable
data object ExploreRoute

@Serializable
data object PracticeRoute

@Serializable
data object ProgressRoute

@Serializable
data object ProfileRoute

// Catalogue and player destinations. These sit above the tab graph, so the
// bottom bar is hidden while they are on top of the back stack.
@Serializable
data class PathDetailRoute(val pathId: String)

@Serializable
data class CourseDetailRoute(val courseId: String)

@Serializable
data class LessonRoute(val lessonId: String)

@Serializable
data class QuizRoute(val lessonId: String)

// Progress, profile settings and monetization screens. These also sit above the
// tab graph and use the shared back affordance.
@Serializable
data object AchievementsRoute

@Serializable
data object EditProfileRoute

@Serializable
data object LearningPreferencesRoute

@Serializable
data object NotificationSettingsRoute

@Serializable
data object SubscriptionRoute

@Serializable
data class PurchaseResultRoute(val status: String, val reason: String? = null)

@Serializable
data object SupportRoute

@Serializable
data object PrivacyRoute
