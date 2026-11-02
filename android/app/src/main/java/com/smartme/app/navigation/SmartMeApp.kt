package com.smartme.app.navigation

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.smartme.app.AppViewModel
import com.smartme.app.R
import com.smartme.app.core.designsystem.component.OfflineBanner
import com.smartme.app.core.model.UserSummary
import com.smartme.app.feature.onboarding.OnboardingMode
import com.smartme.app.feature.onboarding.OnboardingScreen
import com.smartme.app.feature.onboarding.OnboardingViewModel
import com.smartme.app.feature.session.SessionState
import com.smartme.app.feature.session.SessionViewModel
import com.smartme.app.feature.splash.SplashScreen

/**
 * Application shell.
 *
 * The session gate chooses between restoring, the signed-out auth flow,
 * onboarding for an account that has not finished it, and the five-tab main
 * application. Keeping this decision in one place means no tab screen ever has
 * to know whether a learner is signed in.
 */
@Composable
fun SmartMeApp(
    appViewModel: AppViewModel = hiltViewModel(),
    sessionViewModel: SessionViewModel = hiltViewModel(),
) {
    val isOnline by appViewModel.isOnline.collectAsStateWithLifecycle()
    val session by sessionViewModel.state.collectAsStateWithLifecycle()

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        when (val current = session) {
            SessionState.Restoring -> SplashScreen()

            SessionState.SignedOut -> AuthNavHost()

            is SessionState.NeedsOnboarding -> {
                // Keyed so a different account never inherits a stale wizard.
                val onboardingViewModel: OnboardingViewModel = hiltViewModel(
                    key = "post-auth-onboarding-${current.user?.id ?: "unknown"}",
                )
                OnboardingScreen(
                    mode = OnboardingMode.POST_AUTH,
                    onRequireAuth = {},
                    onFinished = sessionViewModel::onOnboardingCompleted,
                    viewModel = onboardingViewModel,
                )
            }

            is SessionState.Ready -> MainScaffold(
                user = current.user,
                isOnline = isOnline,
                onSignOut = sessionViewModel::signOut,
            )
        }
    }
}

@Composable
private fun MainScaffold(
    user: UserSummary?,
    isOnline: Boolean,
    onSignOut: () -> Unit,
) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()

    Scaffold(
        bottomBar = {
            SmartMeBottomBar(
                currentDestination = backStackEntry?.destination,
                onSelect = navController::navigateToTopLevel,
            )
        },
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) {
            OfflineBanner(visible = !isOnline)
            SmartMeNavHost(
                navController = navController,
                user = user,
                onSignOut = onSignOut,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

private fun NavHostController.navigateToTopLevel(destination: TopLevelDestination) {
    navigate(destination.route) {
        // Keep one instance per tab and restore each tab's own scroll/state.
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}
