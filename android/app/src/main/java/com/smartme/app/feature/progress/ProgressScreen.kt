package com.smartme.app.feature.progress

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.smartme.app.R
import com.smartme.app.feature.common.PlaceholderScreen

@Composable
fun ProgressScreen(modifier: Modifier = Modifier) {
    PlaceholderScreen(
        icon = Icons.Outlined.Insights,
        title = stringResource(R.string.progress_title),
        description = stringResource(R.string.progress_placeholder),
        modifier = modifier,
    )
}
