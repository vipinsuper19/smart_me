package com.smartme.app.feature.auth.welcome

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.smartme.app.R
import com.smartme.app.core.designsystem.component.PrimaryButton
import com.smartme.app.core.designsystem.theme.Spacing

/**
 * First screen of a fresh install.
 *
 * Mirrors the design reference: the welcome illustration, the value proposition
 * and two entry points (start onboarding or sign in to an existing account).
 */
@Composable
fun WelcomeScreen(
    onGetStarted: () -> Unit,
    onSignIn: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.surface,
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .imePadding()
                .padding(horizontal = Spacing.screen)
                .padding(top = Spacing.md, bottom = Spacing.xl),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // The illustration has a transparent background, so it can float on
            // either theme without a white canvas behind it.
            Image(
                painter = painterResource(R.drawable.welcome_avatar),
                contentDescription = null,
                modifier = Modifier
                    .weight(1f, fill = false)
                    .fillMaxWidth()
                    .padding(vertical = Spacing.md),
                contentScale = ContentScale.Fit,
            )

            Text(
                text = stringResource(R.string.welcome_title),
                style = MaterialTheme.typography.displaySmall,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
            )

            Spacer(modifier = Modifier.height(Spacing.md))

            Text(
                text = stringResource(R.string.welcome_tagline),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )

            Spacer(modifier = Modifier.height(Spacing.xl))

            PrimaryButton(
                text = stringResource(R.string.welcome_get_started),
                onClick = onGetStarted,
                modifier = Modifier.fillMaxWidth(),
                trailingIcon = Icons.AutoMirrored.Outlined.ArrowForward,
            )

            Spacer(modifier = Modifier.height(Spacing.xs))

            TextButton(
                onClick = onSignIn,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(text = stringResource(R.string.welcome_have_account))
            }
        }
    }
}
