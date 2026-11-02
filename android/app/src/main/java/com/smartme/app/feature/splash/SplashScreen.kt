package com.smartme.app.feature.splash

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.smartme.app.R
import com.smartme.app.core.designsystem.theme.Spacing
import kotlinx.coroutines.delay

/**
 * Branded launch screen shown while the stored session is restored.
 *
 * It follows the splash reference: the mark above the wordmark and tagline,
 * centred a little above the middle, soft blue blobs bleeding out of the top
 * right and bottom left corners, and an indeterminate spinner low on the
 * screen. The spinner only appears if startup takes noticeably longer than one
 * frame, so a warm start never flashes one.
 */
@Composable
fun SplashScreen(modifier: Modifier = Modifier) {
    var showSpinner by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(SpinnerDelayMillis)
        showSpinner = true
    }

    val darkTheme = isSystemInDarkTheme()
    val blobColor = if (darkTheme) {
        MaterialTheme.colorScheme.primary.copy(alpha = 0.16f)
    } else {
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.65f)
    }

    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface),
    ) {
        val width = maxWidth
        val height = maxHeight

        // Soft blue blobs, mostly off-screen so only the rounded corner shows.
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .offset(x = width * 0.42f, y = -(height * 0.26f))
                .size(width * 0.9f)
                .background(color = blobColor, shape = CircleShape),
        )
        Box(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .offset(x = -(width * 0.45f), y = height * 0.26f)
                .size(width * 0.9f)
                .background(color = blobColor, shape = CircleShape),
        )

        Column(
            modifier = Modifier
                .align(Alignment.Center)
                .offset(y = -(height * 0.09f))
                .padding(horizontal = Spacing.screen),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Image(
                painter = painterResource(R.drawable.ic_splash_mark),
                contentDescription = null,
                modifier = Modifier.size(width * 0.52f),
            )
            Spacer(modifier = Modifier.height(Spacing.xl))
            Text(
                text = stringResource(R.string.app_name),
                style = MaterialTheme.typography.displaySmall.copy(
                    fontSize = 46.sp,
                    lineHeight = 52.sp,
                ),
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(Spacing.sm))
            Text(
                text = stringResource(R.string.splash_tagline),
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                ),
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.72f),
                textAlign = TextAlign.Center,
            )
        }

        if (showSpinner) {
            CircularProgressIndicator(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = height * 0.25f)
                    .size(34.dp),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.18f),
                strokeWidth = 3.dp,
            )
        }
    }
}

private const val SpinnerDelayMillis = 400L
