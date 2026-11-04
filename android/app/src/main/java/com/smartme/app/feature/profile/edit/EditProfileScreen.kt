package com.smartme.app.feature.profile.edit

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.smartme.app.R
import com.smartme.app.core.designsystem.component.ErrorState
import com.smartme.app.core.designsystem.component.LoadingState
import com.smartme.app.core.designsystem.theme.Spacing
import com.smartme.app.data.account.ProfileField
import com.smartme.app.feature.learning.LearningTopBar

@Composable
fun EditProfileScreen(
    onBack: () -> Unit,
    onSaved: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: EditProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.saved) {
        if (state.saved) onSaved()
    }

    Column(modifier = modifier.fillMaxSize()) {
        LearningTopBar(
            title = stringResource(R.string.edit_profile_title),
            onBack = onBack,
        )
        when {
            state.loading -> LoadingState()
            state.loadError != null -> ErrorState(
                title = stringResource(R.string.edit_profile_load_error_title),
                message = state.loadError.orEmpty(),
                onRetry = viewModel::load,
            )

            else -> EditProfileForm(
                state = state,
                onFormChange = viewModel::updateForm,
                onSave = viewModel::save,
            )
        }
    }
}

@Composable
internal fun EditProfileForm(
    state: EditProfileUiState,
    onFormChange: ((EditProfileForm) -> EditProfileForm) -> Unit,
    onSave: () -> Unit,
) {
    val form = state.form
    val errors = state.errors

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = Spacing.screen,
            end = Spacing.screen,
            top = Spacing.md,
            bottom = Spacing.xl,
        ),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        item {
            Text(
                text = stringResource(R.string.edit_profile_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        item {
            ProfileTextField(
                value = form.name,
                onValueChange = { value -> onFormChange { it.copy(name = value) } },
                label = stringResource(R.string.edit_profile_name),
                errorRes = errors[ProfileField.NAME],
                maxLength = 80,
            )
        }
        item {
            ProfileTextField(
                value = form.headline,
                onValueChange = { value -> onFormChange { it.copy(headline = value) } },
                label = stringResource(R.string.edit_profile_headline),
                errorRes = errors[ProfileField.HEADLINE],
                maxLength = 120,
            )
        }
        item {
            ProfileTextField(
                value = form.occupation,
                onValueChange = { value -> onFormChange { it.copy(occupation = value) } },
                label = stringResource(R.string.edit_profile_occupation),
                errorRes = errors[ProfileField.OCCUPATION],
                maxLength = 100,
            )
        }
        item {
            ProfileTextField(
                value = form.city,
                onValueChange = { value -> onFormChange { it.copy(city = value) } },
                label = stringResource(R.string.edit_profile_city),
                errorRes = errors[ProfileField.CITY],
                maxLength = 100,
            )
        }
        item {
            ProfileTextField(
                value = form.bio,
                onValueChange = { value -> onFormChange { it.copy(bio = value) } },
                label = stringResource(R.string.edit_profile_bio),
                errorRes = errors[ProfileField.BIO],
                maxLength = 500,
                singleLine = false,
                minLines = 3,
            )
        }
        item {
            ProfileTextField(
                value = form.dateOfBirth,
                onValueChange = { value -> onFormChange { it.copy(dateOfBirth = value) } },
                label = stringResource(R.string.edit_profile_date_of_birth),
                errorRes = errors[ProfileField.DATE_OF_BIRTH],
                placeholder = "YYYY-MM-DD",
                maxLength = 10,
                keyboardType = KeyboardType.Ascii,
            )
        }
        item {
            ProfileTextField(
                value = form.avatarUrl,
                onValueChange = { value -> onFormChange { it.copy(avatarUrl = value) } },
                label = stringResource(R.string.edit_profile_avatar_url),
                errorRes = errors[ProfileField.AVATAR_URL],
                placeholder = "https://",
                maxLength = 500,
                keyboardType = KeyboardType.Uri,
            )
        }

        state.saveError?.let { message ->
            item {
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }

        item {
            Button(
                onClick = onSave,
                enabled = !state.saving,
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
            ) {
                if (state.saving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                    )
                    Text(
                        text = stringResource(R.string.edit_profile_saving),
                        modifier = Modifier.padding(start = Spacing.sm),
                    )
                } else {
                    Text(text = stringResource(R.string.edit_profile_save))
                }
            }
        }
    }
}

@Composable
private fun ProfileTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    errorRes: Int?,
    maxLength: Int,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    singleLine: Boolean = true,
    minLines: Int = 1,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    val trimmed = value.trim()
    val counter = "${trimmed.length}/$maxLength"

    OutlinedTextField(
        value = value,
        onValueChange = { next ->
            if (next.length <= maxLength) onValueChange(next)
        },
        modifier = modifier.fillMaxWidth(),
        label = { Text(text = label) },
        placeholder = if (placeholder != null) {
            { Text(text = placeholder) }
        } else {
            null
        },
        isError = errorRes != null,
        supportingText = {
            Text(
                text = errorRes?.let { stringResource(it) } ?: counter,
                color = if (errorRes != null) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
            )
        },
        singleLine = singleLine,
        minLines = minLines,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = MaterialTheme.shapes.medium,
    )
}
