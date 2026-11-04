package com.smartme.app.feature.profile.edit

import androidx.compose.runtime.Composable
import com.smartme.app.core.designsystem.preview.PreviewContainer
import com.smartme.app.core.designsystem.preview.ScreenPreviews
import com.smartme.app.data.account.ProfileField

@ScreenPreviews
@Composable
private fun EditProfilePreview() {
    PreviewContainer {
        EditProfileForm(
            state = EditProfileUiState(
                loading = false,
                form = EditProfileForm(
                    name = "Aarav Sharma",
                    headline = "Learning every day",
                    occupation = "Product designer",
                    city = "Delhi",
                    bio = "Working on my English for interviews and client conversations.",
                    dateOfBirth = "1995-08-15",
                    avatarUrl = "",
                ),
            ),
            onFormChange = {},
            onSave = {},
        )
    }
}

@ScreenPreviews
@Composable
private fun EditProfileErrorsPreview() {
    PreviewContainer {
        EditProfileForm(
            state = EditProfileUiState(
                loading = false,
                form = EditProfileForm(
                    name = "Aarav Sharma",
                    bio = "A very long bio that is deliberately over the allowed length so the error state is visible in this preview.",
                    dateOfBirth = "2035-01-01",
                    avatarUrl = "not-a-url",
                ),
                errors = mapOf(
                    ProfileField.DATE_OF_BIRTH to com.smartme.app.R.string.edit_profile_error_date,
                    ProfileField.AVATAR_URL to com.smartme.app.R.string.edit_profile_error_avatar,
                ),
            ),
            onFormChange = {},
            onSave = {},
        )
    }
}
