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
