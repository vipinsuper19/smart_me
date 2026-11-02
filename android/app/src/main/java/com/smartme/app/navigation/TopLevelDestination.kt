package com.smartme.app.navigation

import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Quiz
import androidx.compose.ui.graphics.vector.ImageVector
import com.smartme.app.R

/**
 * The five destinations required by PRD §6.1, in bottom-bar order.
 *
 * [route] holds the serializable route object so the same value drives both
 * navigation and selected-state detection.
 */
enum class TopLevelDestination(
    val route: Any,
    @param:StringRes val labelRes: Int,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
) {
    HOME(HomeRoute, R.string.tab_home, Icons.Filled.Home, Icons.Outlined.Home),
    EXPLORE(ExploreRoute, R.string.tab_explore, Icons.Filled.Explore, Icons.Outlined.Explore),
    PRACTICE(PracticeRoute, R.string.tab_practice, Icons.Filled.Quiz, Icons.Outlined.Quiz),
    PROGRESS(ProgressRoute, R.string.tab_progress, Icons.Filled.Insights, Icons.Outlined.Insights),
    PROFILE(ProfileRoute, R.string.tab_profile, Icons.Filled.Person, Icons.Outlined.Person),
}
