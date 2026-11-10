package com.smartme.app.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.toRoute
import com.smartme.app.core.model.UserSummary
import com.smartme.app.feature.explore.CourseDetailScreen
import com.smartme.app.feature.explore.ExploreScreen
import com.smartme.app.feature.explore.PathDetailScreen
import com.smartme.app.feature.home.HomeScreen
import com.smartme.app.feature.lesson.LessonScreen
import com.smartme.app.feature.practice.PracticeScreen
import com.smartme.app.feature.privacy.PrivacyScreen
import com.smartme.app.feature.profile.ProfileScreen
import com.smartme.app.feature.profile.edit.EditProfileScreen
import com.smartme.app.feature.profile.notifications.NotificationSettingsScreen
import com.smartme.app.feature.profile.preferences.LearningPreferencesScreen
import com.smartme.app.feature.progress.AchievementsScreen
import com.smartme.app.feature.progress.ProgressScreen
import com.smartme.app.feature.quiz.QuizScreen
import com.smartme.app.feature.subscription.PurchaseResultScreen
import com.smartme.app.feature.subscription.SubscriptionScreen
import com.smartme.app.feature.support.SupportScreen

@Composable
fun SmartMeNavHost(
    navController: NavHostController,
    user: UserSummary?,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    NavHost(
        navController = navController,
        startDestination = HomeRoute,
        modifier = modifier,
    ) {
        composable<HomeRoute> {
            HomeScreen(
                userName = user?.displayName.orEmpty(),
                onOpenLesson = { lessonId ->
                    navController.navigate(LessonRoute(lessonId))
                },
                onOpenPath = { pathId ->
                    navController.navigate(PathDetailRoute(pathId))
                },
                onSeeAllPaths = {
                    navController.navigateToTopLevel(TopLevelDestination.EXPLORE)
                },
                onOpenNotifications = {
                    navController.navigate(NotificationSettingsRoute)
                },
            )
        }
        composable<ExploreRoute> {
            ExploreScreen(
                onOpenPath = { pathId ->
                    navController.navigate(PathDetailRoute(pathId))
                },
            )
        }
        composable<PracticeRoute> { PracticeScreen() }
        composable<ProgressRoute> {
            ProgressScreen(
                onOpenAchievements = { navController.navigate(AchievementsRoute) },
            )
        }
        composable<ProfileRoute> {
            ProfileScreen(
                fallbackUser = user,
                onSignOut = onSignOut,
                onEditProfile = { navController.navigate(EditProfileRoute) },
                onLearningPreferences = { navController.navigate(LearningPreferencesRoute) },
                onNotificationSettings = { navController.navigate(NotificationSettingsRoute) },
                onSubscription = { navController.navigate(SubscriptionRoute) },
                onSupport = { navController.navigate(SupportRoute) },
                onPrivacy = { navController.navigate(PrivacyRoute) },
            )
        }

        composable<PathDetailRoute> {
            PathDetailScreen(
                onBack = { navController.popBackStack() },
                onOpenCourse = { courseId ->
                    navController.navigate(CourseDetailRoute(courseId))
                },
                onOpenAchievements = { navController.navigate(AchievementsRoute) },
            )
        }
        composable<CourseDetailRoute> {
            CourseDetailScreen(
                onBack = { navController.popBackStack() },
                onOpenLesson = { lessonId ->
                    navController.navigate(LessonRoute(lessonId))
                },
            )
        }
        composable<LessonRoute> {
            LessonScreen(
                onBack = { navController.popBackStack() },
                onOpenQuiz = { lessonId ->
                    navController.navigate(QuizRoute(lessonId))
                },
                onOpenLesson = { lessonId ->
                    // Replace the finished lesson so "Next lesson" never stacks
                    // the whole course into the back stack.
                    navController.navigate(LessonRoute(lessonId)) {
                        popUpTo<LessonRoute> { inclusive = true }
                    }
                },
                onDone = { navController.popBackStack() },
            )
        }
        composable<QuizRoute> {
            QuizScreen(onBack = { navController.popBackStack() })
        }

        composable<AchievementsRoute> {
            AchievementsScreen(onBack = { navController.popBackStack() })
        }
        composable<EditProfileRoute> {
            EditProfileScreen(
                onBack = { navController.popBackStack() },
                onSaved = { navController.popBackStack() },
            )
        }
        composable<LearningPreferencesRoute> {
            LearningPreferencesScreen(onBack = { navController.popBackStack() })
        }
        composable<NotificationSettingsRoute> {
            NotificationSettingsScreen(onBack = { navController.popBackStack() })
        }
        composable<SubscriptionRoute> {
            SubscriptionScreen(
                userId = user?.id.orEmpty(),
                onBack = { navController.popBackStack() },
                onPurchaseResult = { status, reason ->
                    navController.navigate(PurchaseResultRoute(status, reason))
                },
            )
        }
        composable<PurchaseResultRoute> { entry ->
            val route = entry.toRoute<PurchaseResultRoute>()
            PurchaseResultScreen(
                status = route.status,
                reason = route.reason,
                // Success returns to Profile; a failure pops back to the plan
                // screen so the learner can retry without stacking screens.
                onDone = { navController.popBackStack(SubscriptionRoute, inclusive = true) },
                onTryAgain = { navController.popBackStack() },
            )
        }
        composable<SupportRoute> {
            SupportScreen(onBack = { navController.popBackStack() })
        }
        composable<PrivacyRoute> {
            PrivacyScreen(
                onBack = { navController.popBackStack() },
                onSignedOut = onSignOut,
            )
        }
    }
}
