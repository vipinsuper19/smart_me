package com.smartme.app

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * On-device smoke tests for the signed-out flow.
 *
 * These run against the real app (no Hilt overrides) on a clean install, so the
 * stored session is empty and the app always lands on Welcome after the splash.
 * They deliberately stop before any network call, which keeps them independent
 * of a backend and stable on CI emulators.
 */
@RunWith(AndroidJUnit4::class)
class AuthFlowTest {

    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    @Test
    fun welcomeScreenIsShownForSignedOutLaunch() {
        rule.waitForText(rule.activity.getString(R.string.welcome_title))
        rule.onNodeWithText(rule.activity.getString(R.string.welcome_title)).assertIsDisplayed()
        rule.onNodeWithText(rule.activity.getString(R.string.welcome_get_started)).assertIsDisplayed()
        rule.onNodeWithText(rule.activity.getString(R.string.welcome_have_account)).assertIsDisplayed()
    }

    @Test
    fun createAccountChooserOpensTheEmailForm() {
        rule.waitForText(rule.activity.getString(R.string.welcome_title))

        rule.onNodeWithText(rule.activity.getString(R.string.welcome_have_account)).performClick()
        rule.waitForText(rule.activity.getString(R.string.auth_sign_in_title))

        rule.onNodeWithText(rule.activity.getString(R.string.auth_create_account)).performClick()
        rule.waitForText(rule.activity.getString(R.string.auth_create_subtitle))

        rule.onNodeWithText(rule.activity.getString(R.string.auth_register_title)).assertIsDisplayed()
        rule.onNodeWithText(rule.activity.getString(R.string.auth_continue_email)).assertIsDisplayed()
        rule.onNodeWithText(rule.activity.getString(R.string.auth_sign_up_email)).assertIsDisplayed()
        rule.onNodeWithText(rule.activity.getString(R.string.auth_login)).assertIsDisplayed()

        rule.onNodeWithText(rule.activity.getString(R.string.auth_continue_email)).performClick()
        rule.waitForText(rule.activity.getString(R.string.auth_register_subtitle))

        rule.onNodeWithText(rule.activity.getString(R.string.auth_register_action)).assertIsDisplayed()
    }

    @Test
    fun signUpWithEmailOpensTheEmailForm() {
        rule.waitForText(rule.activity.getString(R.string.welcome_title))

        rule.onNodeWithText(rule.activity.getString(R.string.welcome_have_account)).performClick()
        rule.waitForText(rule.activity.getString(R.string.auth_sign_in_title))

        rule.onNodeWithText(rule.activity.getString(R.string.auth_create_account)).performClick()
        rule.waitForText(rule.activity.getString(R.string.auth_create_subtitle))

        rule.onNodeWithText(rule.activity.getString(R.string.auth_sign_up_email)).performClick()
        rule.waitForText(rule.activity.getString(R.string.auth_register_subtitle))

        rule.onNodeWithText(rule.activity.getString(R.string.auth_register_action)).assertIsDisplayed()
    }
}

/**
 * The first frame after launch is the branded splash, which stays for at least
 * 900 ms before the session gate publishes Welcome. Waiting on the text is more
 * reliable than fixed sleeps on a cold emulator.
 */
private fun ComposeContentTestRule.waitForText(text: String, timeoutMillis: Long = 20_000) {
    waitUntil(timeoutMillis) {
        onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty()
    }
}
