package com.smartme.app.feature.auth.signin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.MailOutline
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smartme.app.R
import com.smartme.app.core.designsystem.component.PrimaryButton
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.feature.auth.AuthHeader
import com.smartme.app.feature.auth.AuthSeparator
import com.smartme.app.feature.auth.AuthTextField
import com.smartme.app.feature.auth.AuthTopBar
import com.smartme.app.feature.auth.FormError
import com.smartme.app.feature.auth.GoogleConsentDialog
import com.smartme.app.feature.auth.GoogleSignInButton
import com.smartme.app.feature.auth.PasswordVisibilityToggle
import com.smartme.app.feature.auth.findActivity
import com.smartme.app.feature.auth.passwordTransformation

@Composable
fun SignInScreen(
    onBack: () -> Unit,
    onCreateAccount: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: SignInViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val focusManager = LocalFocusManager.current

    if (state.consentRequired) {
        GoogleConsentDialog(
            onAccept = viewModel::acceptGoogleConsent,
            onDismiss = viewModel::dismissGoogleConsent,
        )
    }

    Scaffold(modifier = modifier) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.screen, vertical = Spacing.lg),
            verticalArrangement = Arrangement.spacedBy(Spacing.lg),
        ) {
            AuthTopBar(onBack = onBack)

            AuthHeader(
                title = stringResource(R.string.auth_sign_in_title),
                subtitle = stringResource(R.string.auth_sign_in_subtitle),
            )

            state.formError?.let { FormError(message = it) }

            AuthTextField(
                value = state.email,
                onValueChange = viewModel::onEmailChange,
                label = stringResource(R.string.auth_email_label),
                errorRes = state.emailError,
                enabled = !state.busy,
                leadingIcon = Icons.Outlined.MailOutline,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next,
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) },
                ),
            )

            AuthTextField(
                value = state.password,
                onValueChange = viewModel::onPasswordChange,
                label = stringResource(R.string.auth_password_label),
                errorRes = state.passwordError,
                enabled = !state.busy,
                leadingIcon = Icons.Outlined.Lock,
                visualTransformation = passwordTransformation(state.passwordVisible),
                trailingIcon = {
                    PasswordVisibilityToggle(
                        visible = state.passwordVisible,
                        onClick = viewModel::togglePasswordVisibility,
                    )
                },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(
                    onDone = {
                        focusManager.clearFocus()
                        viewModel.submit()
                    },
                ),
            )

            PrimaryButton(
                text = stringResource(R.string.auth_sign_in_action),
                onClick = {
                    focusManager.clearFocus()
                    viewModel.submit()
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !state.googleLoading,
                loading = state.submitting,
            )

            if (state.googleAvailable) {
                AuthSeparator()

                GoogleSignInButton(
                    onClick = { activity?.let(viewModel::signInWithGoogle) },
                    loading = state.googleLoading,
                    enabled = activity != null && !state.submitting,
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.auth_no_account),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                TextButton(onClick = onCreateAccount) {
                    Text(text = stringResource(R.string.auth_create_account))
                }
            }
        }
    }
}
