package com.smartme.app.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.smartme.app.core.model.UserSummary
import com.smartme.app.feature.explore.ExploreScreen
import com.smartme.app.feature.home.HomeScreen
import com.smartme.app.feature.practice.PracticeScreen
import com.smartme.app.feature.profile.ProfileScreen
import com.smartme.app.feature.progress.ProgressScreen

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
        composable<HomeRoute> { HomeScreen() }
        composable<ExploreRoute> { ExploreScreen() }
        composable<PracticeRoute> { PracticeScreen() }
        composable<ProgressRoute> { ProgressScreen() }
        composable<ProfileRoute> {
            ProfileScreen(
                user = user,
                onSignOut = onSignOut,
            )
        }
    }
}
