package com.smartme.app.feature.profile.edit

import com.smartme.app.R
import com.smartme.app.data.account.ProfileField
import com.smartme.app.data.account.ProfileUpdate
import java.net.URI
import java.time.LocalDate

/** Editable values as they appear in the form. Blank strings clear the field. */
data class EditProfileForm(
    val name: String = "",
    val headline: String = "",
    val occupation: String = "",
    val city: String = "",
    val bio: String = "",
    val dateOfBirth: String = "",
    val avatarUrl: String = "",
)

fun validateProfileForm(
    form: EditProfileForm,
    today: LocalDate = LocalDate.now(),
): Map<ProfileField, Int> = buildMap {
    if (form.name.trim().length > 80) put(ProfileField.NAME, R.string.edit_profile_error_name)
    if (form.headline.trim().length > 120) {
        put(ProfileField.HEADLINE, R.string.edit_profile_error_headline)
    }
    if (form.occupation.trim().length > 100) {
        put(ProfileField.OCCUPATION, R.string.edit_profile_error_occupation)
    }
    if (form.city.trim().length > 100) put(ProfileField.CITY, R.string.edit_profile_error_city)
    if (form.bio.trim().length > 500) put(ProfileField.BIO, R.string.edit_profile_error_bio)

    val date = form.dateOfBirth.trim()
    if (date.isNotEmpty()) {
        val parsed = runCatching { LocalDate.parse(date) }.getOrNull()
        if (parsed == null || parsed.isAfter(today)) {
            put(ProfileField.DATE_OF_BIRTH, R.string.edit_profile_error_date)
        }
    }

    val avatar = form.avatarUrl.trim()
    if (avatar.isNotEmpty() && !isValidAvatarUrl(avatar)) {
        put(ProfileField.AVATAR_URL, R.string.edit_profile_error_avatar)
    }
}

fun isValidAvatarUrl(value: String): Boolean {
    if (value.length > 500) return false
    return runCatching {
        val uri = URI(value)
        (uri.scheme == "http" || uri.scheme == "https") && !uri.host.isNullOrBlank()
    }.getOrDefault(false)
}

/** Converts the form to an API patch, clearing every blank field explicitly. */
fun EditProfileForm.toUpdate(): ProfileUpdate {
    val cleared = mutableSetOf<ProfileField>()
    fun value(raw: String, field: ProfileField): String? {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) {
            cleared += field
            return null
        }
        return trimmed
    }

    return ProfileUpdate(
        name = value(name, ProfileField.NAME),
        avatarUrl = value(avatarUrl, ProfileField.AVATAR_URL),
        headline = value(headline, ProfileField.HEADLINE),
        occupation = value(occupation, ProfileField.OCCUPATION),
        city = value(city, ProfileField.CITY),
        bio = value(bio, ProfileField.BIO),
        dateOfBirth = value(dateOfBirth, ProfileField.DATE_OF_BIRTH),
        clear = cleared,
    )
}
