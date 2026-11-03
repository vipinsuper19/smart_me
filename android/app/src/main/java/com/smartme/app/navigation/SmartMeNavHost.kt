package com.smartme.app.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.smartme.app.core.model.UserSummary
import com.smartme.app.feature.explore.CourseDetailScreen
import com.smartme.app.feature.explore.ExploreScreen
import com.smartme.app.feature.explore.PathDetailScreen
import com.smartme.app.feature.home.HomeScreen
import com.smartme.app.feature.lesson.LessonScreen
import com.smartme.app.feature.practice.PracticeScreen
import com.smartme.app.feature.profile.ProfileScreen
import com.smartme.app.feature.progress.ProgressScreen
import com.smartme.app.feature.quiz.QuizScreen

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
        composable<ProgressRoute> { ProgressScreen() }
        composable<ProfileRoute> {
            ProfileScreen(
                user = user,
                onSignOut = onSignOut,
            )
        }

        composable<PathDetailRoute> {
            PathDetailScreen(
                onBack = { navController.popBackStack() },
                onOpenCourse = { courseId ->
                    navController.navigate(CourseDetailRoute(courseId))
                },
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
    }
}
