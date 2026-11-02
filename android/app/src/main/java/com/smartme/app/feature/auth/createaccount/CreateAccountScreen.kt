package com.smartme.app.feature.auth.createaccount

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.MailOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smartme.app.R
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.feature.auth.AuthSeparator
import com.smartme.app.feature.auth.AuthTopBar
import com.smartme.app.feature.auth.FormError
import com.smartme.app.feature.auth.GoogleConsentDialog
import com.smartme.app.feature.auth.findActivity

/**
 * Provider chooser shown before the email registration form.
 *
 * It mirrors the design reference: a short value proposition, one outlined row
 * per supported sign-up provider, then the email call to action below an "or"
 * divider. Phone sign-up is intentionally absent: phone OTP is not part of the
 * MVP, so only Google and email are offered.
 */
@Composable
fun CreateAccountScreen(
    onBack: () -> Unit,
    onContinueWithEmail: () -> Unit,
    onSignIn: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: CreateAccountViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }

    if (state.consentRequired) {
        GoogleConsentDialog(
            onAccept = viewModel::acceptGoogleConsent,
            onDismiss = viewModel::dismissGoogleConsent,
        )
    }

    CreateAccountContent(
        state = state,
        onBack = onBack,
        onContinueWithEmail = onContinueWithEmail,
        onSignIn = onSignIn,
        onGoogleClick = { activity?.let(viewModel::signUpWithGoogle) },
        googleEnabled = activity != null,
        modifier = modifier,
    )
}

/**
 * Stateless body of the provider chooser. Kept separate from the Hilt-backed
 * entry point so previews (and future screenshot tests) can render every state
 * without constructing a ViewModel.
 */
@Composable
internal fun CreateAccountContent(
    state: CreateAccountUiState,
    onBack: () -> Unit,
    onContinueWithEmail: () -> Unit,
    onSignIn: () -> Unit,
    onGoogleClick: () -> Unit,
    modifier: Modifier = Modifier,
    googleEnabled: Boolean = true,
) {
    Scaffold(
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.surface,
        bottomBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = Spacing.screen, vertical = Spacing.lg),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.auth_have_account),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                TextButton(onClick = onSignIn) {
                    Text(
                        text = stringResource(R.string.auth_login),
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
            }
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen)
                .padding(top = Spacing.sm, bottom = Spacing.xl),
        ) {
            AuthTopBar(onBack = onBack)

            Spacer(modifier = Modifier.height(Spacing.md))

            Text(
                text = stringResource(R.string.auth_register_title),
                style = MaterialTheme.typography.displaySmall,
                color = MaterialTheme.colorScheme.onSurface,
            )

            Spacer(modifier = Modifier.height(Spacing.sm))

            Text(
                text = stringResource(R.string.auth_create_subtitle),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(modifier = Modifier.height(Spacing.xl))

            state.formError?.let { message ->
                FormError(message = message)
                Spacer(modifier = Modifier.height(Spacing.lg))
            }

            if (state.googleAvailable) {
                ProviderButton(
                    text = stringResource(R.string.auth_continue_google),
                    onClick = onGoogleClick,
                    loading = state.googleLoading,
                    enabled = googleEnabled,
                    icon = {
                        Image(
                            painter = painterResource(R.drawable.ic_google),
                            contentDescription = null,
                            modifier = Modifier.size(20.dp),
                        )
                    },
                )
                Spacer(modifier = Modifier.height(Spacing.md))
            }

            ProviderButton(
                text = stringResource(R.string.auth_continue_email),
                onClick = onContinueWithEmail,
                enabled = !state.googleLoading,
                icon = { ProviderIcon(Icons.Outlined.MailOutline) },
            )

            Spacer(modifier = Modifier.height(Spacing.xl))

            AuthSeparator()

            Spacer(modifier = Modifier.height(Spacing.lg))

            Button(
                onClick = onContinueWithEmail,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 52.dp),
                enabled = !state.googleLoading,
                shape = CircleShape,
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
            ) {
                Text(
                    text = stringResource(R.string.auth_sign_up_email),
                    style = MaterialTheme.typography.labelLarge,
                )
            }
        }
    }
}

/** Pill-shaped outlined row matching the provider chooser reference. */
@Composable
private fun ProviderButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    icon: (@Composable () -> Unit)? = null,
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp),
        enabled = enabled && !loading,
        shape = CircleShape,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface,
        ),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
    ) {
        if (loading) {
            CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                strokeWidth = 2.dp,
            )
        } else {
            icon?.invoke()
        }
        Spacer(modifier = Modifier.width(Spacing.md))
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge,
        )
    }
}

@Composable
private fun ProviderIcon(icon: ImageVector) {
    Icon(
        imageVector = icon,
        contentDescription = null,
        modifier = Modifier.size(20.dp),
        tint = MaterialTheme.colorScheme.onSurface,
    )
}
