package com.smartme.app.feature.profile.edit

import com.smartme.app.R
import com.smartme.app.data.account.ProfileField
import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EditProfileValidationTest {

    private val today = LocalDate.of(2026, 11, 4)

    @Test
    fun `a complete valid form has no errors`() {
        val errors = validateProfileForm(
            EditProfileForm(
                name = "Aarav Sharma",
                headline = "Learning every day",
                occupation = "Product designer",
                city = "Delhi",
                bio = "Working on my English for interviews.",
                dateOfBirth = "1995-08-15",
                avatarUrl = "https://cdn.smartme.app/avatar.jpg",
            ),
            today = today,
        )

        assertTrue(errors.isEmpty())
    }

    @Test
    fun `future dates and malformed dates are rejected`() {
        val future = validateProfileForm(
            EditProfileForm(dateOfBirth = "2026-11-05"),
            today = today,
        )
        val malformed = validateProfileForm(
            EditProfileForm(dateOfBirth = "15-08-1995"),
            today = today,
        )

        assertEquals(R.string.edit_profile_error_date, future[ProfileField.DATE_OF_BIRTH])
        assertEquals(R.string.edit_profile_error_date, malformed[ProfileField.DATE_OF_BIRTH])
    }

    @Test
    fun `today is an allowed date of birth`() {
        val errors = validateProfileForm(
            EditProfileForm(dateOfBirth = "2026-11-04"),
            today = today,
        )

        assertFalse(errors.containsKey(ProfileField.DATE_OF_BIRTH))
    }

    @Test
    fun `avatar links must be absolute http or https urls`() {
        assertTrue(isValidAvatarUrl("https://example.com/a.png"))
        assertTrue(isValidAvatarUrl("http://example.com/a.png"))
        assertFalse(isValidAvatarUrl("ftp://example.com/a.png"))
        assertFalse(isValidAvatarUrl("not-a-url"))
        assertFalse(isValidAvatarUrl("https://"))
        assertFalse(isValidAvatarUrl("https://example.com/${"a".repeat(500)}"))
    }

    @Test
    fun `long fields report their own errors`() {
        val errors = validateProfileForm(
            EditProfileForm(
                name = "a".repeat(81),
                headline = "a".repeat(121),
                occupation = "a".repeat(101),
                city = "a".repeat(101),
                bio = "a".repeat(501),
            ),
            today = today,
        )

        assertEquals(R.string.edit_profile_error_name, errors[ProfileField.NAME])
        assertEquals(R.string.edit_profile_error_headline, errors[ProfileField.HEADLINE])
        assertEquals(R.string.edit_profile_error_occupation, errors[ProfileField.OCCUPATION])
        assertEquals(R.string.edit_profile_error_city, errors[ProfileField.CITY])
        assertEquals(R.string.edit_profile_error_bio, errors[ProfileField.BIO])
    }

    @Test
    fun `blank fields are sent as explicit clears`() {
        val update = EditProfileForm(
            name = "  Aarav  ",
            headline = "   ",
            occupation = "",
            city = "Delhi",
            bio = "",
            dateOfBirth = " ",
            avatarUrl = "",
        ).toUpdate()

        assertEquals("Aarav", update.name)
        assertEquals("Delhi", update.city)
        assertNull(update.headline)
        assertNull(update.occupation)
        assertNull(update.bio)
        assertNull(update.dateOfBirth)
        assertNull(update.avatarUrl)
        assertEquals(
            setOf(
                ProfileField.AVATAR_URL,
                ProfileField.HEADLINE,
                ProfileField.OCCUPATION,
                ProfileField.BIO,
                ProfileField.DATE_OF_BIRTH,
            ),
            update.clear,
        )
    }
}
