package com.smartme.app.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.smartme.app.feature.auth.createaccount.CreateAccountScreen
import com.smartme.app.feature.auth.register.RegisterScreen
import com.smartme.app.feature.auth.signin.SignInScreen
import com.smartme.app.feature.auth.welcome.WelcomeScreen
import com.smartme.app.feature.onboarding.OnboardingMode
import com.smartme.app.feature.onboarding.OnboardingScreen

/**
 * The signed-out flow: welcome, the pre-auth onboarding questions, the
 * sign-up provider chooser and the email/Google account screens.
 *
 * The session gate removes this whole graph as soon as a session appears, so
 * successful auth needs no navigation callback here.
 */
@Composable
fun AuthNavHost(modifier: Modifier = Modifier) {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = WelcomeRoute,
        modifier = modifier,
    ) {
        composable<WelcomeRoute> {
            WelcomeScreen(
                onGetStarted = {
                    navController.navigate(OnboardingRoute) { launchSingleTop = true }
                },
                onSignIn = {
                    navController.navigate(SignInRoute) { launchSingleTop = true }
                },
            )
        }

        // Kept on the back stack while the learner registers so returning to the
        // wizard reopens the step they left.
        composable<OnboardingRoute> {
            OnboardingScreen(
                mode = OnboardingMode.PRE_AUTH,
                onRequireAuth = {
                    navController.navigate(CreateAccountRoute) { launchSingleTop = true }
                },
                onFinished = {},
                onClose = { navController.popBackStack() },
            )
        }

        composable<SignInRoute> {
            SignInScreen(
                onBack = { navController.popBackStack() },
                onCreateAccount = {
                    navController.navigate(CreateAccountRoute) { launchSingleTop = true }
                },
            )
        }

        // Provider chooser: email continues into the full registration form.
        composable<CreateAccountRoute> {
            CreateAccountScreen(
                onBack = { navController.popBackStack() },
                onContinueWithEmail = {
                    navController.navigate(RegisterRoute) { launchSingleTop = true }
                },
                onSignIn = { navController.returnToSignIn() },
            )
        }

        composable<RegisterRoute> {
            RegisterScreen(
                onBack = { navController.popBackStack() },
                onSignIn = { navController.returnToSignIn() },
            )
        }
    }
}

/**
 * Returns to an existing sign-in screen when there is one underneath, otherwise
 * replaces the account-creation screens with sign-in so back does not bounce
 * between the form and the chooser.
 */
private fun NavHostController.returnToSignIn() {
    val previous = previousBackStackEntry?.destination
    when {
        previous?.hasRoute(SignInRoute::class) == true -> popBackStack()

        previous?.hasRoute(CreateAccountRoute::class) == true -> navigate(SignInRoute) {
            // Drops both the chooser and the form sitting on top of it.
            popUpTo<CreateAccountRoute> { inclusive = true }
            launchSingleTop = true
        }

        previous == null -> navigate(SignInRoute) { launchSingleTop = true }

        else -> navigate(SignInRoute) {
            popUpTo<RegisterRoute> { inclusive = true }
            launchSingleTop = true
        }
    }
}
