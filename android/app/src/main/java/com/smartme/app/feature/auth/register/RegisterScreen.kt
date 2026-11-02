package com.smartme.app.feature.auth.register

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.MailOutline
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Checkbox
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
import androidx.compose.ui.semantics.Role
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
fun RegisterScreen(
    onBack: () -> Unit,
    onSignIn: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: RegisterViewModel = hiltViewModel(),
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

    RegisterContent(
        state = state,
        onBack = onBack,
        onSignIn = onSignIn,
        onNameChange = viewModel::onNameChange,
        onEmailChange = viewModel::onEmailChange,
        onPasswordChange = viewModel::onPasswordChange,
        onConfirmPasswordChange = viewModel::onConfirmPasswordChange,
        onTogglePasswordVisibility = viewModel::togglePasswordVisibility,
        onAcceptTermsChange = viewModel::onAcceptTermsChange,
        onAcceptPrivacyChange = viewModel::onAcceptPrivacyChange,
        onSubmit = viewModel::submit,
        onGoogleSignUp = { activity?.let(viewModel::signUpWithGoogle) },
        googleEnabled = activity != null,
        modifier = modifier,
    )
}

/**
 * Stateless body of the registration form, shared by the screen and its previews.
 */
@Composable
internal fun RegisterContent(
    state: RegisterUiState,
    onBack: () -> Unit,
    onSignIn: () -> Unit,
    onNameChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onConfirmPasswordChange: (String) -> Unit,
    onTogglePasswordVisibility: () -> Unit,
    onAcceptTermsChange: (Boolean) -> Unit,
    onAcceptPrivacyChange: (Boolean) -> Unit,
    onSubmit: () -> Unit,
    onGoogleSignUp: () -> Unit,
    modifier: Modifier = Modifier,
    googleEnabled: Boolean = true,
) {
    val focusManager = LocalFocusManager.current

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
                title = stringResource(R.string.auth_register_title),
                subtitle = stringResource(R.string.auth_register_subtitle),
            )

            state.formError?.let { FormError(message = it) }

            AuthTextField(
                value = state.name,
                onValueChange = onNameChange,
                label = stringResource(R.string.auth_name_label),
                errorRes = state.nameError,
                enabled = !state.busy,
                leadingIcon = Icons.Outlined.Person,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Text,
                    imeAction = ImeAction.Next,
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) },
                ),
            )

            AuthTextField(
                value = state.email,
                onValueChange = onEmailChange,
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
                onValueChange = onPasswordChange,
                label = stringResource(R.string.auth_password_label),
                errorRes = state.passwordError,
                helperRes = R.string.auth_password_helper,
                enabled = !state.busy,
                leadingIcon = Icons.Outlined.Lock,
                visualTransformation = passwordTransformation(state.passwordVisible),
                trailingIcon = {
                    PasswordVisibilityToggle(
                        visible = state.passwordVisible,
                        onClick = onTogglePasswordVisibility,
                    )
                },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Next,
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) },
                ),
            )

            AuthTextField(
                value = state.confirmPassword,
                onValueChange = onConfirmPasswordChange,
                label = stringResource(R.string.auth_confirm_password_label),
                errorRes = state.confirmPasswordError,
                enabled = !state.busy,
                leadingIcon = Icons.Outlined.Lock,
                visualTransformation = passwordTransformation(state.passwordVisible),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(
                    onDone = {
                        focusManager.clearFocus()
                        onSubmit()
                    },
                ),
            )

            ConsentCheckbox(
                checked = state.acceptTerms,
                onCheckedChange = onAcceptTermsChange,
                label = stringResource(R.string.auth_accept_terms),
                enabled = !state.busy,
            )
            ConsentCheckbox(
                checked = state.acceptPrivacy,
                onCheckedChange = onAcceptPrivacyChange,
                label = stringResource(R.string.auth_accept_privacy),
                enabled = !state.busy,
            )

            if (state.termsError) {
                Text(
                    text = stringResource(R.string.auth_error_accept_terms),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }

            PrimaryButton(
                text = stringResource(R.string.auth_register_action),
                onClick = {
                    focusManager.clearFocus()
                    onSubmit()
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !state.googleLoading,
                loading = state.submitting,
            )

            if (state.googleAvailable) {
                AuthSeparator()

                GoogleSignInButton(
                    onClick = onGoogleSignUp,
                    loading = state.googleLoading,
                    enabled = googleEnabled && !state.submitting,
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = stringResource(R.string.auth_have_account),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                TextButton(onClick = onSignIn) {
                    Text(text = stringResource(R.string.auth_sign_in_action))
                }
            }
        }
    }
}

@Composable
private fun ConsentCheckbox(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    label: String,
    enabled: Boolean,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .toggleable(
                value = checked,
                enabled = enabled,
                role = Role.Checkbox,
                onValueChange = onCheckedChange,
            ),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.xs),
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = null,
            enabled = enabled,
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}
