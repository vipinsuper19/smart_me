package com.smartme.app.feature.practice

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Quiz
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.smartme.app.R
import com.smartme.app.feature.common.PlaceholderScreen

@Composable
fun PracticeScreen(modifier: Modifier = Modifier) {
    PlaceholderScreen(
        icon = Icons.Outlined.Quiz,
        title = stringResource(R.string.practice_title),
        description = stringResource(R.string.practice_placeholder),
        modifier = modifier,
    )
}
