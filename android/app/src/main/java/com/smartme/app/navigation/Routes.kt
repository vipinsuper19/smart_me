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
