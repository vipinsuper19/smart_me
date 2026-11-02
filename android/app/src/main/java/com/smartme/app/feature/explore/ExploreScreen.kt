package com.smartme.app.feature.explore

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.smartme.app.R
import com.smartme.app.feature.common.PlaceholderScreen

@Composable
fun ExploreScreen(modifier: Modifier = Modifier) {
    PlaceholderScreen(
        icon = Icons.Outlined.Explore,
        title = stringResource(R.string.explore_title),
        description = stringResource(R.string.explore_placeholder),
        modifier = modifier,
    )
}
