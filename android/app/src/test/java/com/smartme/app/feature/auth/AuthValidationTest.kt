package com.smartme.app.feature.auth

import com.smartme.app.R
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AuthValidationTest {

    @Test
    fun `email is required`() {
        assertEquals(R.string.auth_error_email_required, AuthValidation.emailError(null))
        assertEquals(R.string.auth_error_email_required, AuthValidation.emailError(""))
        assertEquals(R.string.auth_error_email_required, AuthValidation.emailError("   "))
    }

    @Test
    fun `malformed emails are rejected`() {
        assertEquals(R.string.auth_error_email_invalid, AuthValidation.emailError("asha"))
        assertEquals(R.string.auth_error_email_invalid, AuthValidation.emailError("asha@example"))
        assertEquals(R.string.auth_error_email_invalid, AuthValidation.emailError("asha @example.com"))
        assertEquals(R.string.auth_error_email_invalid, AuthValidation.emailError("@example.com"))
    }

    @Test
    fun `valid emails are accepted and surrounding whitespace is ignored`() {
        assertNull(AuthValidation.emailError("asha@example.com"))
        assertNull(AuthValidation.emailError("  asha@example.co.in  "))
    }

    @Test
    fun `password is required`() {
        assertEquals(R.string.auth_error_password_required, AuthValidation.passwordError(""))
    }

    @Test
    fun `password length is enforced`() {
        assertEquals(R.string.auth_error_password_length, AuthValidation.passwordError("a1"))
        assertNull(AuthValidation.passwordError("a1".repeat(64)))
        assertEquals(
            R.string.auth_error_password_too_long,
            AuthValidation.passwordError("a1".repeat(64) + "a"),
        )
    }

    @Test
    fun `password needs a letter and a number`() {
        assertEquals(
            R.string.auth_error_password_complexity,
            AuthValidation.passwordError("abcdefgh"),
        )
        assertEquals(
            R.string.auth_error_password_complexity,
            AuthValidation.passwordError("12345678"),
        )
        assertNull(AuthValidation.passwordError("password1"))
        assertNull(AuthValidation.passwordError("Password123"))
    }

    @Test
    fun `confirmation must match`() {
        assertEquals(
            R.string.auth_error_confirm_required,
            AuthValidation.confirmPasswordError("Password123", ""),
        )
        assertEquals(
            R.string.auth_error_password_mismatch,
            AuthValidation.confirmPasswordError("Password123", "Password124"),
        )
        assertNull(AuthValidation.confirmPasswordError("Password123", "Password123"))
    }

    @Test
    fun `names are limited to the backend maximum`() {
        assertNull(AuthValidation.nameError("A".repeat(80)))
        assertEquals(R.string.auth_error_name_too_long, AuthValidation.nameError("A".repeat(81)))
        assertNull(AuthValidation.nameError("   "))
    }
}
